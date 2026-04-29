// Used for planner calls to generate strong downstream prompts.
const PLANNER_SYSTEM = `
You create a list of prompts about a user topic.

The prompts will be used to AI generate content for the user.

Order matters - create prompts in a logical sequence that builds on previous insights.

Rules:
- Each prompt must explore a different valuable angle.
- Keep prompts concise, direct, and specific.
- Collectively create strong coverage of the topic.
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

// Used to generate page blueprints
const pageBlueprints = [
  `
Hero Text:

- MASSIVE extra-large fonts and bold typographical text to make a strong visual impact.
- Followed by a short, compelling paragraph.
`,

  `
4-square Grid Layout:

- Four equal squares arranged in a 2x2 grid
- Each square contains a centered, middle text stack that summarizes a key point.
- Good proportions and spacing for visual balance.
`,

  `
Comparison Table:

- Compare two key concepts, approaches, or options related to the subject.
- Use a clean, bold modern design.
- Create two column stylistic layout.
- Use big fonts and interesting visualizations.
`,

  `
Fast Flow:

- Short, dense, high-impact content
- Powerful titles and single sentence descriptions
- Easy to read and understand
`,

  `
Call to action Card Stack:

- Identify a clear call to action or next step for the user
- Insistently promote the user to take action
- Be inspirational and blunt
`,

  `
Genius Explainer:

- Title
- Well-written thoughtful writing
- Suprising insights
- Expert level tips and advice
`,
  `
- Default output cadence: Title -> subtitle -> primary block.
`
]

const chartPrompts = [
  'Use Frappe Charts to create a full-width bar chart using <div class="yk-chart" data-type="bar" data-labels=\'["Label1","Label2","Label3"]\' data-values=\'[10,20,30]\' data-title="Chart Title">. Use 3–5 meaningful categories related to the subject. Values must show clear relative differences (larger vs smaller). The chart should communicate one clear comparison or tradeoff at a glance. Do not modify the HTML structure.',

  'Use Frappe Charts to create a line chart using <div class="yk-chart" data-type="line" data-labels=\'["T1","T2","T3"]\' data-values=\'[5,15,25]\'>. Show a simple, clear trend or progression related to the subject using realistic directional data.',

  'Use Mermaid to create a flow diagram using <pre class="mermaid">. Write a valid graph TD diagram inside the block with clear labeled nodes and connections representing the subject. Always quote node text if it contains special characters like parentheses, brackets, or quotes using double quotes: Node["Text with (parentheses)"].</pre>',

  'Use Frappe Charts to create a pie chart using <div class="yk-chart" data-type="pie" data-labels=\'["Part1","Part2"]\' data-values=\'[60,40]\'>. Show how the subject is divided into parts using clear proportions and meaningful categories.',

  'Create a spacious beautiful and informative table of data points that clearly illustrates the concept with labeled rows and columns.',

  'Use Typed.js to create a bold hero headline using <div class="yk-typed" data-strings=\'["Phrase1","Phrase2","Phrase3"]\'>. Replace phrases with 3–5 short, meaningful statements that express key ideas about the subject. Keep phrases concise and impactful.',

]

// Used by the process agent to generate final HTML content.
const PROCESS_SYSTEM = `
You create premium HTML content about the user submitted subject. 

Rules: 
- Return clean minimal HTML fragment only (no markdown, no explanations).
- Prioritize scanability and consistency. 
- Use tailwindcss for layouts.
- Avoid generic, consultant-speak or jargon language. 
- Avoid changing background or font colors except for intended emphasis.
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
  const chart = chartPrompts[position % chartPrompts.length]
  const blueprint = pageBlueprints[(position * 2) % pageBlueprints.length]

  return [chart, blueprint]
}

// Builds process payload.
const rules = {
  chartEvery: 1,        // always
  blueprintEvery: 1,    // always
  effectEvery: 2,       // every other
  heavyEvery: 4         // rare big layouts
}

export function buildProcessPrompt({ prompt, position }) {
  const instructions = buildProcessInstructions(position)

  return {
    system: PROCESS_SYSTEM + '\n\n' + instructions.join('\n\n'),
    user: `Generate html about: ${prompt}`
  };
}