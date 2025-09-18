import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.device.create({
    data: { id: "123", name: "Test Device" , status:"OK"},
  });

  await prisma.client.create({
    data: { id: "client-1", name: "Test Client", apiKey: "test-api-key" },
  });

  console.log("Database seeded");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
