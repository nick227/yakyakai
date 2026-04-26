ALTER TABLE `AiSession`
    MODIFY `originalPrompt` TEXT NOT NULL;

ALTER TABLE `AiOutput`
    MODIFY `html` LONGTEXT NOT NULL;

ALTER TABLE `ChatMessage`
    MODIFY `content` LONGTEXT NOT NULL,
    MODIFY `metadata` TEXT NULL;

ALTER TABLE `AiSessionEvent`
    MODIFY `payload` LONGTEXT NOT NULL;

ALTER TABLE `Session`
    MODIFY `initialPrompt` TEXT NOT NULL;

ALTER TABLE `ExplorationPrompt`
    MODIFY `prompt` TEXT NOT NULL,
    MODIFY `valueStatement` TEXT NOT NULL,
    MODIFY `connectionNote` TEXT NOT NULL;

ALTER TABLE `AgentOutput`
    MODIFY `html` LONGTEXT NOT NULL;

ALTER TABLE `SessionEvent`
    MODIFY `payload` LONGTEXT NULL;

ALTER TABLE `UsageLedger`
    MODIFY `promptPreview` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;

ALTER TABLE `Job`
    MODIFY `payloadJson` LONGTEXT NOT NULL,
    MODIFY `lastError` TEXT NULL;

ALTER TABLE `JobEvent`
    MODIFY `message` TEXT NULL,
    MODIFY `metaJson` TEXT NULL;

ALTER TABLE `PromptAnalysis`
    MODIFY `prompt` TEXT NOT NULL,
    MODIFY `issuesJson` TEXT NOT NULL,
    MODIFY `suggestionsJson` TEXT NOT NULL;

ALTER TABLE `SessionMemory`
    MODIFY `summary` TEXT NOT NULL,
    MODIFY `factsJson` TEXT NOT NULL,
    MODIFY `decisionsJson` TEXT NOT NULL,
    MODIFY `openLoopsJson` TEXT NOT NULL;

ALTER TABLE `RunAnalytics`
    MODIFY `metaJson` TEXT NOT NULL;

ALTER TABLE `SavedOutput`
    MODIFY `body` LONGTEXT NOT NULL;
