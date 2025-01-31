/*
  Warnings:

  - A unique constraint covering the columns `[roomId]` on the table `Code` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomCreator` to the `Code` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Code" ADD COLUMN     "roomCreator" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Code_roomId_key" ON "Code"("roomId");
