import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import telemetryRoutes from './routes/telemetry.js';
import { deviceRoutes } from './routes/device.js';
import billingRoutes from './routes/billingRoutes.js';
import relayRoutes from './routes/relayRoutes.js';

export const app = Fastify({ logger: true });
export const prisma = new PrismaClient();

// Log incoming requests
app.addHook("onRequest", async (request, reply) => {
  request.log.info({ reqId: request.id, method: request.method, url: request.url }, "Incoming request");
});

// Health endpoints
app.get('/health', async () => {
  return { status: 'ok' };
});

app.get('/ready', async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  } catch (err) {
    reply.code(503);
    return { status: 'not-ready' };
  }
});

app.register(telemetryRoutes);
app.register(deviceRoutes);
app.register(billingRoutes);
app.register(relayRoutes);

// Only start the server if NOT in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen({ port: 3000 })
    .then(() => console.log('Server running on http://localhost:3000'))
    .catch(err => {
      app.log.error(err, "Failed to start server");
      process.exit(1);
    });
}

const shutdown = async () => {
  await prisma.$disconnect();
  await app.close(); // Add this line
  app.log.info("Prisma disconnected. Shutting down server.");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
export const server = app.server;
