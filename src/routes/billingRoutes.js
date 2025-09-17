import { PrismaClient } from "@prisma/client";
import crypto from"crypto"
const prisma=new PrismaClient();

export default async function billiingRoutes(fastify , options){
    // Random payment provider (80% success, 20% failure)
    fastify.post("/mock-pay/charge" , async(request , reply) =>{
       request.log.info({
    reqId: request.id,
    deviceId: request.body.deviceId,
    planId: request.body.planId
  }, "Mock payment charge request");
        const success=Math.random() > 0.2;
        if(!success){
            return reply.code(500).send({error:"Payment provider failed"});
        }
        return {success:true , providerReference:crypto.randomUUID()};
    });

// main billing route
fastify.post("/billing/subscribe" , async (request,reply) =>{
    try {
      
        const {deviceId , planId} =request.body;

        if(!deviceId || !planId){
            return reply.code(400).send({error:"Missing required fields"});
        }
      request.log.info({
      reqId: request.id,
      deviceId: request.body.deviceId,
      planId: request.body.planId
    }, "Subscription request received");

        // Check if device exists
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device) {
         request.log.warn({reqId: request.id,deviceId}, "Subscription failed: device not found");
        return reply.code(404).send({ error: "Device not found" });
      }

      // Call mock payment provider
      const paymentResponse = await fastify.inject({
        method: "POST",
        url: "/mock-pay/charge",
        payload: { deviceId, planId },
      });

      if (paymentResponse.statusCode !== 200) {
        return reply.code(402).send({ error: "Payment failed" });
      }

      const { providerReference } = paymentResponse.json();

      // Create subscription
      const now = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const subscription = await prisma.subscription.create({
        data: {
          deviceId,
          planId,
          startDate: now,
          endDate,
          status: "active",
          providerReference,
        },
      });

      return reply.code(201).send({
        message: "Subscription created successfully",
        subscription,
      });
    } catch (error) {
           request.log.error({ reqId: request.id, error }, "Internal server error in billing");
        return reply.code(500).send({error:"Internal server error"})
    }
})
}