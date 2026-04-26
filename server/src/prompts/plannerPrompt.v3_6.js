export function plannerPromptV36(userPrompt='') {
return `
Return STRICT JSON:
{"goal":"","tasks":[{"title":"","value":"","category":"","priority":1,"prompt":""}]}

Rules:
- Create 4 to 7 tasks only
- Avoid generic filler
- Prefer tasks businesses pay for
- Distinct angles only
- Concrete outputs only
- Use simple direct language

High value categories:
strategy, architecture, pricing, market research, implementation, operations, risk, conversion, metrics, workflow

User request:
${userPrompt}
`;
}
