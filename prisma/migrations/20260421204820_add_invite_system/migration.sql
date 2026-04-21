/*
  Warnings:

  - You are about to drop the column `emotionalWeight` on the `Evaluation` table. All the data in the column will be lost.
  - You are about to drop the column `timePressure` on the `Evaluation` table. All the data in the column will be lost.
  - The `frequencyOfUse` column on the `Evaluation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "emotionalWeight",
DROP COLUMN "timePressure",
DROP COLUMN "frequencyOfUse",
ADD COLUMN     "frequencyOfUse" INTEGER,
ALTER COLUMN "wouldBuyAgain" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
