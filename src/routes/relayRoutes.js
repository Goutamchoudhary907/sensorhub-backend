import { PrismaClient } from "@prisma/client";
import axios from "axios"
import { rateLimit } from "../utils/rateLimit.js";
const prisma=new PrismaClient();

export default async function relayRoutes(fastify,options){
 // Mock relay endpoint -  random provider failure
  fastify.post("/mock-relay/receive", async (request, reply) => {
      request.log.info({
    reqId: request.id,
    body: request.body
  }, "Relay receive request");
    const fail = Math.random() < 0.3; // 30% chance of failure
    if (fail) {
      return reply.code(500).send({ error: "Mock provider failed" });
    }
    return { success: true };
  });

  fastify.post("/relay/publish", async (request, reply) => {
    try {
      const apiKey = request.headers["x-api-key"];
      if (!apiKey) {
        return reply.code(401).send({ error: "Missing API key" });
      }

      const client = await prisma.client.findUnique({
        where: { apiKey },
      });

      if (!client) {
        return reply.code(403).send({ error: "Invalid API key" });
      }
      
      const { clientId, message, meta, idempotencyKey } = request.body;

      if (!clientId || !message || !idempotencyKey) {
        return reply.code(400).send({ error: "Missing required fields" });
      }
      // Log relay info
        request.log.info({
         reqId: request.id,
         clientId,
         message
       }, "Relay publish request");

      // Redis-based rate limiting: max 5 requests per 1 second per client
      const allowed = await rateLimit(`client:${clientId}`, 5, 1);
      if (!allowed) {
         request.log.warn({reqId: request.id,clientId }, "Rate limit exceeded for relay publish");
        return reply.code(429).send({ error: "Rate limit exceeded" });
      }


      // Idempotency check
      const existing = await prisma.relayLog.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        return reply.code(200).send({ message: "Already processed" });
      }

      let attempt = 0;
      let success = false;
      const maxRetries = 3;
      const backoff = [1000, 2000, 4000];

      while (attempt < maxRetries && !success) {
        attempt++;

         const res = await axios.post(
          "http://localhost:3000/mock-relay/receive",
          { message, meta },
          { validateStatus: () => true } 
        );

        if (res.status >= 500) {
          request.log.warn({
            reqId:request.id ,
            clientId , 
            attempt,
            status:res.status
          }, "Relay attempt failed, retrying...")
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, backoff[attempt - 1]));
          }
        } else {
          success = true;
        }
      }

      // Log the result
      await prisma.relayLog.create({
        data: {
          clientId,
          message,
         meta: typeof meta === "string" ? meta : JSON.stringify(meta),
          idempotencyKey,
          status: success ? "success" : "failed",
          retries: attempt - 1,
        },
      });

      if (!success) {
        return reply.code(502).send({ error: "Failed after retries" });
      }

      return reply.code(201).send({ message: "Relay successful" });
    }catch(error){
      request.log.error({
      reqId: request.id,
      clientId,
      error
    }, "Internal server error");
    return reply.code(500).send({error:"Internal server error"});
    }
});
}