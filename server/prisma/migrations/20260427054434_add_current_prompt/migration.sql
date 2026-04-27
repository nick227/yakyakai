/*
  Warnings:

  - You are about to drop the `agentoutput` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `explorationprompt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessionevent` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `AiSession` ADD COLUMN `currentPrompt` TEXT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `avatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `creditBalance` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `googleId` VARCHAR(191) NULL,
    ADD COLUMN `resetToken` VARCHAR(191) NULL,
    ADD COLUMN `resetTokenAt` DATETIME(3) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;

-- DropTable
DROP TABLE IF EXISTS `agentoutput`;

-- DropTable
DROP TABLE IF EXISTS `explorationprompt`;

-- DropTable
DROP TABLE IF EXISTS `session`;

-- DropTable
DROP TABLE IF EXISTS `sessionevent`;

-- CreateIndex
CREATE INDEX `ChatMessage_sessionId_role_idx` ON `ChatMessage`(`sessionId`, `role`);

-- CreateIndex
CREATE INDEX `Job_userId_status_idx` ON `Job`(`userId`, `status`);

-- CreateIndex
CREATE INDEX `UsageLedger_userId_sessionId_createdAt_idx` ON `UsageLedger`(`userId`, `sessionId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);

-- CreateIndex
CREATE UNIQUE INDEX `User_resetToken_key` ON `User`(`resetToken`);
