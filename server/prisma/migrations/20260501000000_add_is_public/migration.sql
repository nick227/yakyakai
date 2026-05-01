ALTER TABLE `AiSession` ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX `AiSession_isPublic_updatedAt_idx` ON `AiSession`(`isPublic`, `updatedAt`);
