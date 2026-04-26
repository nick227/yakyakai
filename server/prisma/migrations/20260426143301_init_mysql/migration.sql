-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `plan` ENUM('FREE', 'PRO', 'TEAM') NOT NULL DEFAULT 'FREE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `originalPrompt` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'created',
    `promptCount` INTEGER NOT NULL DEFAULT 0,
    `cycleCount` INTEGER NOT NULL DEFAULT 0,
    `pace` VARCHAR(191) NOT NULL DEFAULT 'steady',
    `nextEligibleAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastHeartbeatAt` DATETIME(3) NULL,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiSession_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AiSession_status_isVisible_nextEligibleAt_idx`(`status`, `isVisible`, `nextEligibleAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiOutput` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `cycle` INTEGER NOT NULL DEFAULT 1,
    `index` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `html` VARCHAR(191) NOT NULL,
    `formatType` VARCHAR(191) NOT NULL DEFAULT 'strategy_card',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiOutput_sessionId_cycle_index_idx`(`sessionId`, `cycle`, `index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT') NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `metadata` VARCHAR(191) NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSessionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiSessionEvent_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `initialPrompt` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'created',
    `runVersion` INTEGER NOT NULL DEFAULT 1,
    `cycle` INTEGER NOT NULL DEFAULT 1,
    `totalRequested` INTEGER NOT NULL DEFAULT 0,
    `totalSent` INTEGER NOT NULL DEFAULT 0,
    `currentIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExplorationPrompt` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `runVersion` INTEGER NOT NULL,
    `cycle` INTEGER NOT NULL,
    `index` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `valueStatement` VARCHAR(191) NOT NULL,
    `connectionNote` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentOutput` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `promptId` VARCHAR(191) NULL,
    `agent` VARCHAR(191) NOT NULL,
    `runVersion` INTEGER NOT NULL,
    `cycle` INTEGER NOT NULL,
    `index` INTEGER NULL,
    `html` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageLedger` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `jobId` VARCHAR(191) NULL,
    `phase` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `promptPreview` VARCHAR(191) NULL,
    `promptChars` INTEGER NOT NULL DEFAULT 0,
    `estimatedPromptTokens` INTEGER NOT NULL DEFAULT 0,
    `actualPromptTokens` INTEGER NULL,
    `actualCompletionTokens` INTEGER NULL,
    `actualTotalTokens` INTEGER NULL,
    `status` ENUM('STARTED', 'SUCCESS', 'ESTIMATED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'STARTED',
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `durationMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UsageLedger_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `UsageLedger_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    INDEX `UsageLedger_phase_idx`(`phase`),
    INDEX `UsageLedger_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` ENUM('queued', 'running', 'paused', 'complete', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `payloadJson` VARCHAR(191) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `runAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastError` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Job_status_runAt_idx`(`status`, `runAt`),
    INDEX `Job_lockedAt_idx`(`lockedAt`),
    INDEX `Job_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobEvent` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NULL,
    `metaJson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobEvent_jobId_createdAt_idx`(`jobId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `qualityScore` INTEGER NOT NULL DEFAULT 0,
    `distinctScore` INTEGER NOT NULL DEFAULT 0,
    `tokenRiskScore` INTEGER NOT NULL DEFAULT 0,
    `duplicationRisk` INTEGER NOT NULL DEFAULT 0,
    `issuesJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `suggestionsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromptAnalysis_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PromptAnalysis_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionMemory` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `factsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `decisionsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `openLoopsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `sourceCount` INTEGER NOT NULL DEFAULT 0,
    `tokenEstimate` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SessionMemory_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunAnalytics` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `value` INTEGER NULL,
    `metaJson` VARCHAR(191) NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunAnalytics_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `RunAnalytics_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    INDEX `RunAnalytics_eventType_idx`(`eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavedOutput` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `format` VARCHAR(191) NOT NULL DEFAULT 'markdown',
    `body` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SavedOutput_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `SavedOutput_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiSession` ADD CONSTRAINT `AiSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiOutput` ADD CONSTRAINT `AiOutput_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSessionEvent` ADD CONSTRAINT `AiSessionEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExplorationPrompt` ADD CONSTRAINT `ExplorationPrompt_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentOutput` ADD CONSTRAINT `AgentOutput_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionEvent` ADD CONSTRAINT `SessionEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageLedger` ADD CONSTRAINT `UsageLedger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageLedger` ADD CONSTRAINT `UsageLedger_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
