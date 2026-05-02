import { BLUEPRINTS } from './blueprints.js'
import { CHARTS } from './charts.js'
import { STYLES } from './styles.js'

const blueprintMap = Object.fromEntries(BLUEPRINTS.map((b) => [b.key, b.prompt]))
const chartMap     = Object.fromEntries(CHARTS.map((c) => [c.key, c.prompt]))
const styleMap     = Object.fromEntries(STYLES.map((s) => [s.key, s.prompt]))

export const INSTRUCTIONS = [
  { key: 'hero-punchy',                  blueprint: 'hero',                style: 'punchy'    },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'split-hero-cinematic',         blueprint: 'split-hero',          style: 'cinematic' },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-timeline',               chart: 'timeline'                                    },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'grid-dense',                   blueprint: 'grid',                style: 'dense'     },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-playbook',               chart: 'playbook'                                    },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'stack-contrast-editorial',     blueprint: 'stack-contrast',      style: 'editorial' },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-pie',                    chart: 'pie'                                         },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'center-focus-minimal',         blueprint: 'center-focus',        style: 'minimal'   },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-big-stats',              chart: 'big-stats'                                   },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-bar',                    chart: 'bar'                                         },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'top-heavy-brutalist',          blueprint: 'top-heavy',           style: 'brutalist' },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-line',                   chart: 'line'                                        },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'bottom-heavy-academic',        blueprint: 'bottom-heavy',        style: 'academic'  },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-mermaid',                chart: 'mermaid'                                     },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'alternating-viral',            blueprint: 'alternating',         style: 'viral'     },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-tier-list',              chart: 'tier-list'                                   },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'fragmented-brutalist',         blueprint: 'fragmented',          style: 'brutalist' },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'chart-table',                  chart: 'table'                                       },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'two-speed-warm',               blueprint: 'two-speed',           style: 'warm'      },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'cluster-dense',                blueprint: 'cluster',             style: 'dense'     },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'edge-anchored-editorial',      blueprint: 'edge-anchored',       style: 'editorial' },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
  { key: 'interruption-viral',           blueprint: 'interruption',        style: 'viral'     },
  { key: 'default',                      blueprint: 'none',                style: 'none'      },
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
