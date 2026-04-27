import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const client = apiKey ? new OpenAI({ apiKey }) : null

export async function callAI({ system, user, temperature = 0.4, signal }) {
  if (!client) return mockAI({ system, user })

  const response = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }, signal ? { signal } : undefined)

  return response.choices?.[0]?.message?.content?.trim() || ''
}

// Returns { text, usage, model } so callers can record actual token counts.
export async function callAIRich({ system, user, temperature = 0.4, signal }) {
  if (!client) {
    return { text: mockAI({ system, user }), usage: null, model }
  }

  const response = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }, signal ? { signal } : undefined)

  return {
    text: response.choices?.[0]?.message?.content?.trim() || '',
    usage: response.usage,
    model: response.model || model,
  }
}

export async function callPlannerStructured({
  system,
  user,
  temperature = 0.4,
  signal,
  count = 6,
  toolName = 'submit_plan',
  toolDescription = 'Submit the generated plan prompts.',
  responseSchema,
}) {
  if (!client) {
    const areas = ['Build', 'Conversion', 'Pricing', 'Retention', 'Trust', 'Risk', 'Operations']
    return {
      prompts: areas.slice(0, count).map((area) =>
        `From a ${area.toLowerCase()} perspective, produce a concrete deliverable for: ${user.slice(0, 120)}`
      ),
      usage: null,
      model,
    }
  }

  const response = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    tools: [{
      type: 'function',
      function: {
        name: toolName,
        description: toolDescription,
        parameters: responseSchema || {
          type: 'object',
          additionalProperties: false,
          properties: {
            prompts: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: Math.max(1, count),
            },
          },
          required: ['prompts'],
        },
      },
    }],
    tool_choice: {
      type: 'function',
      function: { name: toolName },
    },
  }, signal ? { signal } : undefined)

  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0]
  const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : {}

  return {
    prompts: Array.isArray(args.prompts) ? args.prompts : [],
    usage: response.usage,
    model: response.model || model,
  }
}

function mockAI({ system, user }) {
  const seed = user.slice(0, 180).replace(/\s+/g, ' ')
  if (system.includes('planner')) {
    const areas = ['Build', 'Conversion', 'Pricing', 'Retention', 'Trust', 'Risk']
    const prompts = areas.map((area) =>
      `From a ${area.toLowerCase()} perspective: write a concrete action plan for "${seed.slice(0, 60)}". Deliver a specific framework, not an overview. Include decision criteria and one next step.`
    )
    return JSON.stringify({ prompts }, null, 2)
  }

  if (system.includes('modification')) {
    const areas = ['Build', 'Conversion', 'Pricing', 'Retention', 'Trust', 'Risk']
    const prompts = areas.map((area) =>
      `Given the modification context, produce a revised ${area.toLowerCase()} deliverable. Address the updated direction concretely. ${seed.slice(0, 60)}`
    )
    return JSON.stringify({ title: `Revised plan`, prompts }, null, 2)
  }

  return `<section><h2>AI Result</h2><p>${seed}</p><ul><li>Key angle clarified.</li><li>Tradeoffs identified.</li><li>Next decision made explicit.</li></ul></section>`
}
