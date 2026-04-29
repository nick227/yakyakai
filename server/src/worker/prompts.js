import { BLUEPRINT_STYLE_PROMPTS } from './blueprints.js'
import { CHART_TYPES_PROMPTS } from './charts.js'

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

// Used by the process agent to generate final HTML content.
const PROCESS_SYSTEM = `
You create premium HTML content about the user submitted subject. 

Rules: 
- Return clean minimal HTML fragment only (no markdown, no explanations).
- Prioritize scanability and consistency. 
- Always use full width of the container.
- Avoid generic, consultant-speak or jargon language. 
- Avoid background or font colors except for intended emphasis.
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
  return {
    system: PROCESS_SYSTEM + '\n\n' + instructions.join('\n\n'),
    user: `Generate html about: ${prompt}`
  };
}

// Extra prompt: generates extra instructions for process prompt
function generateExtraPrompt(position) {
  let chart = CHART_TYPES_PROMPTS[position % CHART_TYPES_PROMPTS.length]
  let blueprint = BLUEPRINT_STYLE_PROMPTS[(position * 2) % BLUEPRINT_STYLE_PROMPTS.length]

  return [chart, blueprint]
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