// Shared planner guidance reused by both first-cycle and follow-up planning calls.
const COMMON_PLANNER_SYSTEM = `
The array of prompts will be used to generate content for a user.
Our goal is to prevent that content from being generic and obvious.
Each prompt should be a distinct unique concept and not repetitive.
The prompts should encourage good writing and well-structured content.
The prompts should be concise and to the point.
Return the array of prompts as a JSON object.
`

// Used only for the very first planner call in a session to map the core request.
const PLANNER_SYSTEM = `
You create an array of prompts about a user submitted subject.

The user will provide a short prompt.
Think about the broader universe of related topics.
Create prompts directly related to the subject.
` + COMMON_PLANNER_SYSTEM

// Used for subsequent cycle planning calls to expand into adjacent directions.
const CYCLE_SYSTEM = `
You create an array of prompts related to a user submitted subject.

The user will provide a short prompt.
Think of one useful adjacent direction connected to the subject.
Create prompts about that adjacent direction.
Keep the connection clear and natural.
Avoid repeating obvious direct topics.
` + COMMON_PLANNER_SYSTEM

// Builds the first-cycle planner payload (core topic exploration).
export function buildInitialPlannerPrompt({ originalPrompt, promptCount }) {
  return {
    system: PLANNER_SYSTEM,
    user: `Generate ${promptCount} distinct quality prompts about: ${originalPrompt}
`,
  }
}

// Builds later-cycle planner payloads (adjacent-topic expansion).
export function buildCyclePlannerPrompt({ originalPrompt, promptCount }) {
  return {
    system: CYCLE_SYSTEM,
    user: `Generate ${promptCount} distinct prompts in an adjacent direction related to: ${originalPrompt}`,
  }
}

// Builds the process-agent payload for a single planned prompt item.
export function buildProcessPrompt({ prompt }) {
  return {
    system: PROCESS_SYSTEM,
    user: `${prompt}`,
  }
}
