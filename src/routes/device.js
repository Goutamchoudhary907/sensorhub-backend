import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();

export async function deviceRoutes(fastify){
    fastify.get("/device/latest" , async(request , reply) =>{
        try {
          // Log request
          request.log.info({
          reqId: request.id,
          deviceId: request.query.deviceId || "all"
        }, "Fetching device(s)");

          const deviceId=request.query.deviceId;
          if(deviceId){
           const device=await prisma.device.findUnique({
            where:{id:deviceId},
            include:{subscription:true},
           });

           if(!device){
            return reply.status(404).send({error:"Device not found"});
           }
          //  return device info
           return reply.send({
            id:device.id , 
            name:device.name,
            latestStatus:device.status,
            latestMetric:device.lastMetric,
            latestValue:device.lastValue,
            latestTimestamp: device.lastUpdatedAt,
            subscriptionActive:
            device.subscription?.some(
              (sub) =>
                sub.status === "active" &&
                sub.startDate <= new Date() &&
                sub.endDate >= new Date()
            ) || false,
           });
        }
           const device=await prisma.device.findMany({
            include:{subscription:true},
           });

           return reply.send(
            device.map((device) =>({
            id: device.id,
            name: device.name,
            status: device.status,
            lastMetric: device.lastMetric,
            lastValue: device.lastValue,
            lastUpdatedAt: device.lastUpdatedAt,
            subscriptionActive:
            device.subscription?.some(
              (sub) =>
                sub.status === "active" &&
                sub.startDate <= new Date() &&
                sub.endDate >= new Date()
            ) || false,
            }))
           )
           
        } catch (error) {
          request.log.error({
          reqId: request.id,
          error
        }, "Failed to fetch devices");

            return reply.code(500).send({error:"Failed to fetch devices"})
        }
    })
}