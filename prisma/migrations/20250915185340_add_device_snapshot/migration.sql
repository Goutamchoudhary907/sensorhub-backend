-- AlterTable
ALTER TABLE "public"."Device" ADD COLUMN     "lastMetric" TEXT,
ADD COLUMN     "lastUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lastValue" DOUBLE PRECISION;
