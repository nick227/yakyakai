import { BLUEPRINT_STYLE_PROMPTS } from './blueprints.js'
import { CHART_TYPES_PROMPTS } from './charts.js'

// Used for planner calls to generate strong downstream prompts.
const PLANNER_SYSTEM = `
You create a list of prompts about a user topic.

The prompts will be used to AI generate content for the user.

Order matters - create prompts in a logical sequence that builds on previous insights.

Rules:
- Each prompt must explore a different valuable angle.
- Keep prompts concise, direct, and specific.
- Collectively create strong coverage of the topic.
 -Avoid overlapping explanations or rephrasing the same idea.
- Return only a JSON array of prompt strings.
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
- Use tailwindcss for style.
- Avoid generic, consultant-speak or jargon language. 
- Avoid background or font colors except for intended emphasis.
`

// Builds planner payload.
export function buildPlannerPrompt({ subject, promptCount }) {
  return {
    system: PLANNER_SYSTEM,
    user: `Generate ${promptCount} distinct high-value prompts about: ${subject}`
  }
}

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

// Builds adjacent-topic payload.
export function buildNextPromptPrompt({ currentPrompt }) {
  return {
    system: NEW_PROMPT_SYSTEM,
    user: `Generate a new but related subject to: ${currentPrompt}`
  }
}

function buildProcessInstructions(position) {
  if(position % 3 === 0){
    return ['Default output cadence: Title -> subtitle -> primary block.', 'Simple and clean layout.'];
  }

  const chart = CHART_TYPES_PROMPTS[position % CHART_TYPES_PROMPTS.length]
  const blueprint = BLUEPRINT_STYLE_PROMPTS[(position * 2) % BLUEPRINT_STYLE_PROMPTS.length]

  return [chart, blueprint]
}


export function buildProcessPrompt({ prompt, position }) {
  const instructions = buildProcessInstructions(position)

  return {
    system: PROCESS_SYSTEM + '\n\n' + instructions.join('\n\n'),
    user: `Generate html about: ${prompt}`
  };
}