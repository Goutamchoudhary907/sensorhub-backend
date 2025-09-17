import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
import {rateLimit} from "../utils/rateLimit.js"

export default async function telemetryRoutes(fastify, options){
    fastify.post("/telemetry/ping" , async (request, reply) => {
        try {
            const {deviceId, metric, value, status , ts, eventId}= request.body;

            if(!deviceId || !metric || value==undefined || !status || !ts || !eventId){
                return reply.code(400).send({error:"Missing required fields"});
            }
            // Log telemetry info
              request.log.info({
              reqId: request.id,
              deviceId,
              metric,
              value
            }, "Telemetry ping received");
 // Redis-based rate limiting: max 5 requests per second per device
            const allowed=await rateLimit(`device:${deviceId}`,5,1);
            if(!allowed){
                request.log.warn({ reqId: request.id, deviceId }, "Rate limit exceeded");
                return reply.code(429).send({error:"Rate limit exceeded"});
            }
        
            const device=await prisma.device.findUnique({
                where:{
                    id:deviceId
                }
            });

            if(!device) return reply.code(404).send({error:"Device not found"});

            const subscription=await prisma.subscription.findFirst({
                where:{
                    deviceId ,
                    status:"active" ,
                    startDate: {lte:new Date() },
                    endDate:{gte: new Date()},
                },
            })

            if(!subscription){
                return reply.code(403).send({error:"Device has no active subscription"});
            }

            const existingTelemetry=await prisma.telemetry.findUnique({
                where:{
                    eventId
                },
            });

            if(existingTelemetry){
                return reply.code(200).send({message:"Already processed"});
            }

            await prisma.telemetry.create({
                data:{
                    deviceId,
                    metric,
                    value,
                    status,
                    ts:new Date(ts),
                    eventId
                },
            })

            await prisma.device.update({
                where:{id:deviceId},
                data:{
                    status,
                    lastMetric: metric,     
                    lastValue: value,       
                    lastUpdatedAt: new Date(ts), 
                }
            })
            return reply.code(201).send({ message: "Telemetry recorded successfully" });
        } catch (err) {
           request.log.error({
           reqId: request.id,
           deviceId,
           error: err
         }, "Internal server error");

            return reply.code(500).send({error:"Internal server error"});
        };
    })
}