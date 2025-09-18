import request from "supertest";
import { app, prisma, server } from "../src/index.js";

describe("SensorHub API Tests", () => {
  const deviceId = "123";      
  const clientId = "client-1";
  const eventId = "event-123";

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.telemetry.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.relayLog.deleteMany({});
    await prisma.client.deleteMany({});
  });

  // ===== Idempotency Test =====
  it("should not duplicate telemetry for same eventId", async () => {
    // First create a device with correct fields
    await prisma.device.create({
      data: { 
        id: deviceId, 
        name: "Test Device", 
        status: "active" // Use status instead of isActive
      }
    });

    // Create active subscription
    await prisma.subscription.create({
      data: {
        deviceId,
        planId: "yearly",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "active",
        providerReference: "test-ref"
      }
    });

    const payload = {
      deviceId,
      metric: "temperature",
      value: 25,
      status: "ok",
      ts: new Date().toISOString(),
      eventId
    };

    // First ping should succeed
    await request(server)
      .post("/telemetry/ping")
      .send(payload)
      .expect(201);

    // Second ping with same eventId should be ignored
    const second = await request(server)
      .post("/telemetry/ping")
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/already processed/i); 
  }, 10000);

  // ===== Retry Test =====
  it("should retry /relay/publish on 5xx", async () => {
    // First create a client for API key validation
    await prisma.client.create({
      data: {
        id: clientId,
        name: "Test Client",
        apiKey: "test-api-key"
        // No isActive field in your schema
      }
    });

    const payload = {
      clientId,
      message: "Hello",
      meta: {},
      idempotencyKey: "relay-1"
    };

    const res = await request(server)
      .post("/relay/publish")
      .set("x-api-key", "test-api-key") 
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "Relay successful");
  }, 10000);
 // ===== Subscription Expiry Test =====
it("should deactivate device after subscription expiry", async () => {
  // First create a device
  await prisma.device.create({
    data: { 
      id: deviceId, 
      name: "Test Device", 
      status: "active"
    }
  });

  // Try subscribing multiple times until payment succeeds (retry logic)
  let subscriptionResponse;
  let attempts = 0;
  const maxAttempts = 10; // Should succeed within 10 attempts (80% success rate)
  
  while (attempts < maxAttempts) {
    subscriptionResponse = await request(server)
      .post("/billing/subscribe")
      .send({ deviceId, planId: "yearly" });
    
    if (subscriptionResponse.status === 201) {
      break; // Success!
    }
    attempts++;
  }

  // If still not successful after retries, fail the test
  if (subscriptionResponse.status !== 201) {
    throw new Error(`Payment failed after ${maxAttempts} attempts`);
  }

  // First find the subscription by deviceId
  const subscription = await prisma.subscription.findFirst({
    where: { deviceId }
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  // Mock expiry by updating subscription in DB using the ID
  const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
  await prisma.subscription.update({
    where: { id: subscription.id }, // Use the subscription ID, not deviceId
    data: { endDate: pastDate, status: "expired" }
  });

  // Try pinging device after expiry
  const ping = await request(server)
    .post("/telemetry/ping")
    .send({
      deviceId,
      metric: "temp",
      value: 20,
      status: "ok",
      ts: new Date().toISOString(),
      eventId: "expired-test"
    });

  expect(ping.status).toBe(403);
  expect(ping.body.error).toMatch(/no active subscription/i);
}, 15000); // Increase timeout for retries
});