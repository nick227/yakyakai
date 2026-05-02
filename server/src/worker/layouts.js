import { BLUEPRINTS } from './blueprints.js'
import { CHARTS } from './charts.js'
import { STYLES } from './styles.js'

const blueprintMap = Object.fromEntries(BLUEPRINTS.map((b) => [b.key, b.prompt]))
const chartMap     = Object.fromEntries(CHARTS.map((c) => [c.key, c.prompt]))
const styleMap     = Object.fromEntries(STYLES.map((s) => [s.key, s.prompt]))

export const INSTRUCTIONS = [
  { key: 'fast-short',                   blueprint: 'fast-massive',          style: 'none'    },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },

  { key: 'hero-punchy',                  blueprint: 'hero',                style: 'punchy'    },
  
  { key: 'split-hero-cinematic',         blueprint: 'split-hero',          style: 'cinematic' },
  
  { key: 'grid-dense',                   blueprint: 'grid',                style: 'dense'     },

  { key: 'chart-table',                  blueprint: 'grid',                chart: 'table'     },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'chart-playbook',               chart: 'playbook'                                    },
  
  { key: 'stack-contrast-editorial',     blueprint: 'stack-contrast',      style: 'editorial' },
  
  { key: 'chart-pie',                    chart: 'pie'                                         },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'center-focus-minimal',         blueprint: 'center-focus',        style: 'minimal'   },
  
  { key: 'chart-big-stats',              chart: 'big-stats'                                   },
  
  { key: 'chart-timeline',               chart: 'timeline'                                    },
  
  { key: 'top-heavy-brutalist',          blueprint: 'top-heavy',           style: 'brutalist' },
  
  { key: 'chart-line',                   chart: 'line'                                        },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'bottom-heavy-academic',        blueprint: 'bottom-heavy',        style: 'academic'  },
  
  { key: 'chart-mermaid',                chart: 'mermaid'                                     },
  
  { key: 'alternating-viral',            blueprint: 'alternating',         style: 'viral'     },
  
  { key: 'chart-tier-list',              chart: 'tier-list'                                   },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'fragmented-brutalist',         blueprint: 'fragmented',          style: 'brutalist' },
  
  { key: 'chart-table',                  chart: 'table'                                       },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'two-speed-warm',               blueprint: 'two-speed',           style: 'warm'      },
  
  { key: 'cluster-dense',                blueprint: 'cluster',             style: 'dense'     },

  { key: 'chart-bar',                    chart: 'bar'                                         },

  { key: 'evidence-callout-technical',   blueprint: 'evidence-callout',    style: 'technical' },
  
  { key: 'edge-anchored-editorial',      blueprint: 'edge-anchored',       style: 'editorial' },
  
  { key: 'interruption-viral',           blueprint: 'interruption',        style: 'viral'     },
  
  { key: 'progressive-density-academic', blueprint: 'progressive-density', style: 'academic'  },
]

const resolve = (map, key) => (key == null || key === 'none') ? null : (map[key] ?? null)

export function getExtraInstructions(position) {
  const instruction = INSTRUCTIONS[position % INSTRUCTIONS.length]
  return [
    resolve(blueprintMap, instruction.blueprint),
    resolve(chartMap,     instruction.chart),
    resolve(styleMap,     instruction.style),
  ].filter(Boolean)
}

// Per-session step pointer — walks INSTRUCTIONS sequentially across all cycles.
// Resets on process restart (acceptable: minor aesthetic effect, avoids DB schema change).
const sessionPointers = new Map()

export function claimStepRange(sessionId, count) {
  const offset = sessionPointers.get(sessionId) ?? 0
  sessionPointers.set(sessionId, offset + count)
  return offset
}

export function releaseSession(sessionId) {
  sessionPointers.delete(sessionId)
}
