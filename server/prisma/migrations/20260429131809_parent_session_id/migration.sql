-- AlterTable
ALTER TABLE `AiSession` ADD COLUMN `parentSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AiSession_parentSessionId_idx` ON `AiSession`(`parentSessionId`);
