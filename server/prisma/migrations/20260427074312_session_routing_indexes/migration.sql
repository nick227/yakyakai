-- CreateIndex
CREATE INDEX `AiSession_userId_updatedAt_id_idx` ON `AiSession`(`userId`, `updatedAt`, `id`);

-- CreateIndex
CREATE INDEX `AiSessionEvent_sessionId_id_idx` ON `AiSessionEvent`(`sessionId`, `id`);
