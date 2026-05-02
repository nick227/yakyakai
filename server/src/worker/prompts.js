import { getExtraInstructions } from './layouts.js'

// Used for planner calls to generate strong downstream prompts.
const PLANNER_SYSTEM = `
You create a list of very distinct detailed and high-value prompt paragraphs about a user topic.

Each prompt should get specific about a distinct idea.

Order matters - create prompt paragraphs in a logical sequence that builds on previous insights.

Rules:
- Each prompt must explore a different valuable angle.
- Keep language concise, direct, and specific.
- Collectively create strong coverage of the topic.
`

// Used to generate one fresh adjacent subject for the next cycle.
const NEW_PROMPT_SYSTEM = `
Given a topic, generate one adjacent subject that moves the conversation in a smart new direction.

Goal:
Keep it relevant, interesting, and non-obvious.

Rules:
- Stay near the original topic.
- Keep it concise.
- Return only the subject text.
`

// Used for fast intro message - enthusiastic and reassuring
const FAST_INTRO_SYSTEM = `
You write a single enthusiastic, reassuring paragraph that introduces the user's idea in a very positive way.

Goal:
Make the user feel excited and confident about their idea.

Rules:
- Be genuinely enthusiastic and warm.
- Acknowledge the value and potential of their idea.
- Keep it to one paragraph only.
- Be concise but impactful.
- No markdown, no formatting, just plain text.
`

// Used by the process agent to generate final HTML content.
const PROCESS_SYSTEM = `
You create premium HTML content about the user submitted subject. 

Rules: 
- Use huge, bold, and impactful titles, type scale 48/24/16.
- Use full width of the container, avoid outer padding.
- Create visual diversity with lists and tables.
- Design for mobile first.
- Avoid conclusions and summaries.
- Avoid consultant speak or generic text.
- Avoid over-promising or hyperbole.
- Avoid background or font colors.
- Emoticons can add humor.
- Return standard HTML fragments.
`

// Planner prompt: the initial cycle builder prompt
export function buildPlannerPrompt({ subject, promptCount }) {
  return {
    system: PLANNER_SYSTEM,
    user: `Generate ${promptCount} distinct high-value prompts about: ${subject}`
  }
}

// Process prompt: the internal cycle handling prompt
export function buildProcessPrompt({ prompt, position }) {
  const instructions = generateExtraPrompt(position)
  const system = PROCESS_SYSTEM + '\n\n' + instructions.join('\n\n')
  const user = `Generate html about: ${prompt}`
  console.log("------------------------------------------------------------------------------------------------")
  console.log("[buildProcessPrompt]")
  console.log(system, user);
  console.log("------------------------------------------------------------------------------------------------")
  return {
    system,
    user
  };
}

// Extra prompt: generates extra instructions for process prompt
function generateExtraPrompt(position) {
  return getExtraInstructions(position)
}

// Builds adjacent-topic payload.
export function buildNextPromptPrompt({ currentPrompt }) {
  return {
    system: NEW_PROMPT_SYSTEM,
    user: `Generate a new but related subject to: ${currentPrompt}`
  }
}

// Restart planner prompt: the prompt for the next cycle after a restart
export function buildRestartPlannerPrompt({
  previousPrompt,
  restartInstruction,
  promptCount
}) {
  return {
    system: PLANNER_SYSTEM,
    user: `Generate ${promptCount} distinct high-value prompts that continue this session.

Previous session focus: ${previousPrompt}
New instruction (PRIORITY): ${restartInstruction}

Continue the work, strongly applying the new instruction.`
  }
}

// Fast intro prompt: generates an enthusiastic introduction
export function buildFastIntroPrompt({ subject }) {
  return {
    system: FAST_INTRO_SYSTEM,
    user: `Write an enthusiastic introduction for: ${subject}`
  }
}