// Used for planner calls to generate strong downstream prompts.
const PLANNER_SYSTEM = `
You create a list of prompts about a user topic.

The prompts will be used to generate final content for the user.

Goal:
Create prompts that lead to sharp, useful, non-obvious outputs.

Rules:
- Each prompt must explore a different valuable angle.
- Prefer hidden opportunities, practical execution, mistakes, traps, tradeoffs, strategy, money, growth, edge, systems, psychology, or contrarian truths.
- Focus on what matters in the real world.
- Avoid beginner topics, filler, summaries, definitions, and obvious advice.
- Avoid corporate or consultant language.
- Avoid repeating the user's wording.
- Each prompt should feel like something worth paying to read.
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
- Stay connected to the original topic.
- Prefer practical, profitable, strategic, psychological, technical, historical, or contrarian directions.
- Avoid generic, repetitive, vague, or unrealistic ideas.
- Keep it concise.
- Return only the subject text.
`

const chartPrompts = [
  'Use Frappe Charts to create a full-width bar chart using <div class="yk-chart" data-type="bar" data-labels=\'["Label1","Label2","Label3"]\' data-values=\'[10,20,30]\' data-title="Chart Title">. Use 3–5 meaningful categories related to the subject. Values must show clear relative differences (larger vs smaller). The chart should communicate one clear comparison or tradeoff at a glance. Do not modify the HTML structure.',

    'Use Frappe Charts to create a line chart using <div class="yk-chart" data-type="line" data-labels=\'["T1","T2","T3"]\' data-values=\'[5,15,25]\'>. Show a simple, clear trend or progression related to the subject using realistic directional data.',

    'Use Mermaid to create a flow diagram using <pre class="mermaid">. Write a valid graph TD diagram inside the block with clear labeled nodes and connections representing the subject.</pre>',

    'Use Frappe Charts to create a pie chart using <div class="yk-chart" data-type="pie" data-labels=\'["Part1","Part2"]\' data-values=\'[60,40]\'>. Show how the subject is divided into parts using clear proportions and meaningful categories.',

    'Use Mermaid to create a relationship diagram using <pre class="mermaid">. Write a valid graph LR diagram with clearly labeled nodes and connections representing key elements.</pre>'
  ]

const effectPrompts = [
'Use Typed.js to create a bold hero headline using <div class="yk-typed" data-strings=\'["Phrase1","Phrase2","Phrase3"]\'>. Replace phrases with 3–5 short, meaningful statements that express key ideas about the subject. Keep phrases concise and impactful.',

'Create an old computer terminal style retro screen using rough.js lo-fi pixel art vibe style. Use large print text and stacked lines for a classic terminal look.',

'Create a table of data points that clearly illustrates the concept with labeled rows and columns.',
  
'Use a bold typographic hero with large font sizes to emphasize a key idea.'
]

// Used by the process agent to generate final HTML content.
const PROCESS_SYSTEM = `
You design premium content about the user submitted subject. 

Rules: 
- Return HTML fragment only (no markdown, no explanations).. 
- Use Tailwind classes for styling. 
- Default output cadence: Title -> subtitle -> primary block.
- Prioritize scanability and consistency. 
- Avoid generic, consultant-speak, jargon-heavy, or unrealistic ideas. 
- Always do a final font color contrast check to ensure readability.
`

// Builds planner payload.
export function buildPlannerPrompt({ subject, promptCount }) {
  return {
    system: PLANNER_SYSTEM,
    user: `Generate ${promptCount} distinct high-value prompts about: ${subject}`
  }
}

// Builds process payload.
let counter = 0;
export function buildProcessPrompt({ prompt }) {
  const chartIndex = counter % chartPrompts.length
  const effectIndex = Math.floor(counter / 2) % effectPrompts.length
  const extraInstructions =
  chartPrompts[chartIndex] +
  (counter % 2
    ? '\n\n' + effectPrompts[effectIndex]
    : '')

  counter++;
  return {
    system: PROCESS_SYSTEM + '\n\n' + extraInstructions,
    user: `Design a page about: ${prompt}`
  }
}

// Builds adjacent-topic payload.
export function buildNextPromptPrompt({ currentPrompt }) {
  return {
    system: NEW_PROMPT_SYSTEM,
    user: `Generate new related subject to explore: ${currentPrompt}`
  }
}