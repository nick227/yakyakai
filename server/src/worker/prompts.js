// Shared planner guidance reused by both first-cycle and follow-up planning calls.
const COMMON_PLANNER_SYSTEM = `
The array of prompts will be used to generate content for a user.
Our goal is to prevent generic and obvious content.
Avoid beginner-level or filler topics.
Prefer prompts that create specific outputs, decisions, frameworks, examples, or useful assets.
Each prompt should be a distinct unique concept and not repetitive.
The prompts should encourage good writing and well-structured content.
The prompts should be concise and to the point.
Return the array of prompts as a JSON object.
`

// Used only for the very first planner call in a session to map the core request.
const PLANNER_SYSTEM = `
You create an array of prompts about a user submitted subject.
Think about the broader universe of related topics.
Each prompt must cover a different aspect of the subject.
` + COMMON_PLANNER_SYSTEM

// Used for subsequent cycle planning calls to expand into adjacent directions.
const CYCLE_SYSTEM = `
You create an array of prompts related to a user submitted subject.
Think of a new related adjacent subject.
Create prompts about that creative new direction.
` + COMMON_PLANNER_SYSTEM

// Used by the process agent for each planned prompt to produce HTML output.
const PROCESS_SYSTEM = `
You write premium and useful content about the user submitted subject.

Rules:
- Return as html fragment tags only.
- Use only: <section>, <div>, <h2>, <h3>, <p>, <ul>, <li>.
- Make smart use of headings and subheadings to guide the reader.
- Use short lists as examples and summaries.
- Use tailwind css classes for styling and layout.
- Let the information determine structure. Prefer clarity over decoration.
- No conclusion blocks, no generic intros, no repeated advice.
- Avoid filler content, focus on commercially useful content.
- Prefer sharp elucidating deep-dives into the subject.
- The writing style should readable and easy to digest.
`

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
    user: `Generate ${promptCount} prompts adjacent to: ${originalPrompt}.
    Be creative and think about an interesting new direction.`,
  }
}

// Builds the process-agent payload for a single planned prompt item.
export function buildProcessPrompt({ prompt }) {
  return {
    system: PROCESS_SYSTEM,
    user: prompt,
  }
}
