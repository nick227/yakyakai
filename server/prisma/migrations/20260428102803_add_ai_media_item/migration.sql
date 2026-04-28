-- CreateTable
CREATE TABLE `AiMediaItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` VARCHAR(191) NOT NULL,
    `cycle` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `query` VARCHAR(191) NOT NULL,
    `providerAssetId` VARCHAR(191) NOT NULL,
    `assetJson` LONGTEXT NOT NULL,
    `htmlContent` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiMediaItem_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `AiMediaItem_sessionId_cycle_kind_key`(`sessionId`, `cycle`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
