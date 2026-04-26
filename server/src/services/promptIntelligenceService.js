import { prisma } from '../db/prisma.js'
import { estimateTokens } from '../utils/tokenEstimate.js'

const CATEGORY_PATTERNS = [
  ['coding', /code|repo|component|api|database|bug|refactor|typescript|react|node|prisma/i],
  ['business', /business|market|pricing|strategy|customer|revenue|saas|product/i],
  ['research', /research|sources|analyze|compare|find|investigate|evidence/i],
  ['writing', /write|rewrite|draft|article|script|copy|email|post/i],
  ['planning', /plan|roadmap|objectives|milestones|steps|architecture/i],
]

export function classifyPrompt(prompt='') {
  const match = CATEGORY_PATTERNS.find(([, regex]) => regex.test(prompt))
  return match?.[0] || 'general'
}

export function analyzePromptShape(prompt='', siblingPrompts=[]) {
  const text = String(prompt || '').trim()
  const tokenEstimate = estimateTokens(text)
  const issues = []
  const suggestions = []

  let qualityScore = 70
  let distinctScore = 80
  let tokenRiskScore = 0
  let duplicationRisk = 0

  if (text.length < 40) {
    qualityScore -= 25
    issues.push('too_short')
    suggestions.push('Add goal, constraints, audience, and desired output shape.')
  }

  if (!/[?.!]/.test(text)) {
    qualityScore -= 8
    issues.push('weak_sentence_structure')
  }

  if (!/output|return|format|deliver|create|generate|summarize|build/i.test(text)) {
    qualityScore -= 12
    issues.push('missing_output_intent')
    suggestions.push('Specify the expected output format.')
  }

  if (tokenEstimate > 2500) {
    tokenRiskScore = 80
    qualityScore -= 10
    issues.push('high_token_prompt')
    suggestions.push('Compress background context before sending to the model.')
  } else if (tokenEstimate > 1200) {
    tokenRiskScore = 45
    suggestions.push('Consider summarizing long context.')
  }

  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const currentWords = new Set(normalized)

  for (const sibling of siblingPrompts) {
    const words = new Set(String(sibling || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean))
    const overlap = [...currentWords].filter(w => words.has(w)).length
    const denom = Math.max(1, Math.min(currentWords.size, words.size))
    const ratio = overlap / denom
    if (ratio > 0.72) {
      duplicationRisk = Math.max(duplicationRisk, Math.round(ratio * 100))
      distinctScore -= 30
      issues.push('possible_duplicate')
      suggestions.push('Make this prompt target a different angle or outcome.')
      break
    }
  }

  return {
    category: classifyPrompt(text),
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    distinctScore: Math.max(0, Math.min(100, distinctScore)),
    tokenRiskScore,
    duplicationRisk,
    issues,
    suggestions,
    estimatedTokens: tokenEstimate,
  }
}

export async function savePromptAnalysis({ userId=null, sessionId=null, prompt, siblingPrompts=[] }) {
  const analysis = analyzePromptShape(prompt, siblingPrompts)

  return prisma.promptAnalysis.create({
    data: {
      userId,
      sessionId,
      prompt,
      category: analysis.category,
      qualityScore: analysis.qualityScore,
      distinctScore: analysis.distinctScore,
      tokenRiskScore: analysis.tokenRiskScore,
      duplicationRisk: analysis.duplicationRisk,
      issuesJson: JSON.stringify(analysis.issues),
      suggestionsJson: JSON.stringify(analysis.suggestions),
    }
  })
}
