const zones = [
  'marketing',
  'sales',
  'operations',
  'pricing',
  'analytics',
  'research',
  'trust',
  'retention',
  'automation',
  'partnerships'
]

export function detectUsedZones(prompts=[]){
  const used = new Set()
  const text = prompts.join(' ').toLowerCase()

  if(/seo|ads|campaign|marketing/.test(text)) used.add('marketing')
  if(/sales|close|email|outreach/.test(text)) used.add('sales')
  if(/workflow|ops|process|booking/.test(text)) used.add('operations')
  if(/price|pricing|tier/.test(text)) used.add('pricing')
  if(/metric|analytics|kpi/.test(text)) used.add('analytics')
  if(/research|customer|persona/.test(text)) used.add('research')
  if(/trust|review|guarantee/.test(text)) used.add('trust')
  if(/retention|repeat|loyalty/.test(text)) used.add('retention')
  if(/automation|zapier|n8n|agent/.test(text)) used.add('automation')
  if(/partner|affiliate|referral/.test(text)) used.add('partnerships')

  return [...used]
}

export function recommendAdjacentZones(prompts=[]){
  const used = new Set(detectUsedZones(prompts))
  return zones.filter(z => !used.has(z)).slice(0,5)
}

export function truncatePromptTitles(prompts=[]){
  return prompts
    .map(p => String(p.title || p.prompt || p || '').trim())
    .filter(Boolean)
    .slice(0,10)
    .map(v => v.slice(0,90))
}
