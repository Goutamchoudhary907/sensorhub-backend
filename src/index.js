import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import telemetryRoutes from './routes/telemetry.js'
import { deviceRoutes } from './routes/device.js'
import billingRoutes from './routes/billingRoutes.js'
import relayRoutes from './routes/relayRoutes.js'


const fastify = Fastify({ logger: true })
const prisma = new PrismaClient()

fastify.addHook("onRequest", async (request, reply) => {
  request.log.info({ reqId: request.id, method: request.method, url: request.url }, "Incoming request");
});

fastify.get('/health', async () => {
  return { status: 'ok' }
})

fastify.get('/ready', async () => {
  return { status: 'ready' }
})


fastify.register(telemetryRoutes);
fastify.register(deviceRoutes);
fastify.register(billingRoutes);
fastify.register(relayRoutes);

fastify.listen({ port: 3000 })
  .then(() => console.log('Server running on http://localhost:3000'))
  .catch(err => {
    fastify.log.error(err,"Failed to start server")
    process.exit(1)
  })
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  fastify.log.info("Prisma disconnected. Shutting down server.");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  fastify.log.info("Prisma disconnected. Shutting down server.");
  process.exit(0);
});
