/**
 * Fast approximate token estimator.
 * Good enough for gating before provider calls.
 * Replace later with tiktoken or provider tokenizer if needed.
 */
export function estimateTokens(input = '') {
  const text = String(input || '')
  if (!text.trim()) return 0

  // English-ish approximation: ~4 chars/token, but account for whitespace/code punctuation.
  const charEstimate = Math.ceil(text.length / 4)
  const wordEstimate = Math.ceil(text.trim().split(/\s+/).length * 1.35)

  return Math.max(charEstimate, wordEstimate)
}

export function countPrompt(input = '') {
  const text = String(input || '')
  return {
    promptChars: text.length,
    estimatedPromptTokens: estimateTokens(text),
  }
}
