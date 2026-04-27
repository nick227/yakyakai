const COMMON_PLANNER_SYSTEM = `
The array of prompts will be used to generate content for a user.
Our goal is to prevent that content from being generic and obvious.
Each prompt should be a distinct unique concept and not repetitive. 
The prompts should encourage good writing and well-structured content.
The prompts should be concise and to the point.

Return the array of prompts as a JSON object.
`

const PLANNER_SYSTEM = `You create an array of prompts about a user submitted subject. The user will provide a short prompt, you must think about the broader universe of topics that are related to the user prompt. You must then create an array of prompts that are related to the user prompt. 
` + COMMON_PLANNER_SYSTEM

const CYCLE_SYSTEM = `You create an array of prompts indirectly about a user submitted subject. The user will provide a short prompt, you must think about the broader universe of topics that are related to the user prompt. You must then create an array of prompts that are related to the user prompt. 
` + COMMON_PLANNER_SYSTEM

const PROCESS_SYSTEM = `You are the yakyakai process agent.

Return clean semantic HTML fragment only. No markdown fences.

- Prefer plain intelligent language over dramatic marketing language.
- Avoid hype, guru tone, consultant phrasing, and forced controversy.
- Write like a sharp editor, not a salesperson.
- Choose clarity before cleverness.
- Use headings people understand on first read.

Rules:
- Use only: <section>, <div>, <h2>, <h3>, <p>, <ul>, <li>.
- No <html>, <head>, <body>, <style>, <script>.
- Write for humans first. Make it readable, vivid, specific.
- Open with immediate value, not generic setup.
- Prefer sharp observations, concrete examples, useful frameworks.
- Use headings that are clear, useful, and naturally interesting.
- Vary sentence length and rhythm.
- Avoid filler, clichés, vague claims, AI-sounding summaries.
- If topic is dry, make it engaging through contrast, stakes, examples, surprising facts, or clear scenarios.
- No conclusion section unless truly necessary.
- Keep markup shallow and clean.`

export function buildInitialPlannerPrompt({ originalPrompt, promptCount }) {
  return {
    system: PLANNER_SYSTEM,
    user: `

Generate ${promptCount} distinct quality prompts about:

${originalPrompt}
`,
  }
}

export function buildCyclePlannerPrompt({ originalPrompt, promptCount }) {
  return {
    system: CYCLE_SYSTEM,
    user: `Original goal: ${originalPrompt}

Plan exactly ${promptCount} prompts for the next cycle.
Kick off adjacent exploration by shifting from the core request into nearby leverage areas a user likely needs next.
Start with one prompt that extends the core direction, then move into adjacent angles (distribution, conversion, retention, operations, risk, trust, pricing) without repeating framing.`,
  }
}

export function buildProcessPrompt({ prompt, priorContext, wordLimit, pace }) {
  return {
    system: PROCESS_SYSTEM,
    user: `Prompt:
${prompt}


Word limit: ${wordLimit} words max. Pace: ${pace}.`,
  }
}
