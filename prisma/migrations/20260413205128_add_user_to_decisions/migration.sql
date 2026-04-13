/*
  Warnings:

  - Added the required column `userId` to the `Decision` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "emotionalWeight" INTEGER,
ADD COLUMN     "timePressure" INTEGER,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "emotionalWeight" INTEGER,
ADD COLUMN     "timePressure" INTEGER;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
