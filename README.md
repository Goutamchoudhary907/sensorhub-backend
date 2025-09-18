# SensorHub & Relay Mini Backend

![Node.js](https://img.shields.io/badge/Node.js-18-green)
![Fastify](https://img.shields.io/badge/Fastify-5.6-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Redis](https://img.shields.io/badge/Redis-7-orange)
![Jest](https://img.shields.io/badge/Jest-30-red)

A lightweight backend service that demonstrates device telemetry ingestion, subscription management, and relay notifications with idempotency, retries, rate limiting, and structured logging.

---

## Table of Contents

* [Features](#features)
* [Tech Stack](#tech-stack)
* [Setup](#setup)
* [Running the Server](#running-the-server)
* [Seeding the Database](#seeding-the-database)
* [API Endpoints](#api-endpoints)
* [Testing](#testing)
* [Postman Collection](#postman-collection)
* [Environment Variables](#environment-variables)
* [Notes / Implementation Details](#notes--implementation-details)

---

## Features

* **Device Telemetry** with idempotent pings
* **Subscription Management** with yearly plans
* **Relay Notifications** with retries and backoff
* **Rate Limiting** on telemetry and relay endpoints (Redis-backed)
* **Structured Logs** with request IDs
* **Health & Ready Endpoints**
* **Mock Providers** for payments and relay delivery

---

## Tech Stack

* **Node.js** + **Fastify**
* **PostgreSQL** via **Prisma ORM**
* **Redis** for TTLs and rate limiting
* **Jest** + **Supertest** for testing

---

## Setup

1. Clone the repository:

```bash
git clone https://github.com/Goutamchoudhary907/sensorhub-backend.git
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example` and set your environment variables.

---

## Running the Server

```bash
npm start
```

The server runs at:

```bash
http://localhost:3000
```

### Health endpoints:

* `/health` → returns `{ status: "ok" }`
* `/ready` → checks database connection

---

## Seeding the Database

```bash
npm run seed
```

Seeds devices, clients, and subscriptions for testing.

---

## API Endpoints

### Telemetry

**POST** `/telemetry/ping`

Payload:

```json
{
  "deviceId": "string",
  "metric": "string",
  "value": "number",
  "status": "string",
  "ts": "timestamp",
  "eventId": "string"
}
```

* Updates device snapshot
* Ignores duplicate `eventId`
* Rejects inactive devices

### Billing

**POST** `/billing/subscribe`

Payload:

```json
{
  "deviceId": "string",
  "planId": "string"
}
```

* Calls mock provider `/mock-pay/charge`
* Stores subscription with `startDate`, `endDate`, `status`, `providerReference`

### Relay

**POST** `/relay/publish`

Headers:

```http
x-api-key: <client-key>
```

Payload:

```json
{
  "clientId": "string",
  "message": "string",
  "meta": "object",
  "idempotencyKey": "string"
}
```

* Calls `/mock-relay/receive`
* Retries on `5xx` errors with backoff

### Mock Endpoints

* **POST** `/mock-pay/charge` → Simulates payment success/failure
* **POST** `/mock-relay/receive` → Simulates relay delivery success/failure

---

## Testing

Run all tests:

```bash
npm test
```

Test coverage includes:

* Telemetry idempotency
* Relay retries on failure
* Subscription expiry handling

---

## Postman Collection

Import the Postman collection from:

```bash
https://web.postman.co/workspace/My-Workspace~9c6cd87d-6878-420a-8ad6-c04bf90dd964/collection/39799039-281ed100-a10f-4368-ae33-d6b3da17f744?action=share&source=copy-link&creator=39799039
```

to test all endpoints.

---

## Environment Variables

Example `.env`:

```env
PORT=3000
DATABASE_URL=your postgresql database url
REDIS_URL=redis://localhost:6379
MOCK_RELAY_KEY=test-api-key
```

---

## Notes / Implementation Details

* Telemetry and relay endpoints are rate-limited via Redis.
* Structured logs include request IDs for tracing.
* Mock endpoints intentionally simulate random failures to test retry logic.
* Database snapshots are updated on each telemetry ping.
* Subscription expiry disables device pings automatically.
* Idempotency is enforced on telemetry and relay endpoints.
