export const usageLimits = {
  freeMonthlyTokenLimit: Number(process.env.FREE_MONTHLY_TOKEN_LIMIT || 100_000),
  freeMonthlyPromptLimit: Number(process.env.FREE_MONTHLY_PROMPT_LIMIT || 100),
  hardMaxPromptChars: Number(process.env.HARD_MAX_PROMPT_CHARS || 24_000),
  hardMaxPlannerTasks: Number(process.env.HARD_MAX_PLANNER_TASKS || 7),
}
