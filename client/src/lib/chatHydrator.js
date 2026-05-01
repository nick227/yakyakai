const READY = '1'
const HYDRATING = 'data-hydrating'
const FRAPPE_INSTANCE_KEY = '__ykFrappeChart'

let frappePromise
let typedPromise
let mermaidPromise

const safeParse = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const parseLooseArray = (value, { numeric = false } = {}) => {
  if (!value) return []
  if (Array.isArray(value)) return value

  const parsed = safeParse(value, null)
  if (Array.isArray(parsed)) return parsed

  if (typeof value === 'string') {
    const split = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!numeric) return split
    return split.map((item) => Number(item)).filter((item) => Number.isFinite(item))
  }

  return []
}

const markDone = (node) => {
  node.setAttribute('data-ready', READY)
  node.removeAttribute('data-error')
}

const markError = (node, error) => {
  const message = error instanceof Error ? error.message : 'hydrate_failed'
  node.setAttribute('data-error', message)
  node.setAttribute('title', message)
  // Keep failures visible in dev so bad blocks are diagnosable.
  if (!node.textContent?.trim()) {
    node.textContent = `Render error: ${message}`
  }
  console.error('[chatHydrator] block failed', { className: node.className, message })
}

const loadFrappe = () => {
  frappePromise ||= import('frappe-charts/dist/frappe-charts.esm.js')
  return frappePromise
}

const loadTyped = () => {
  typedPromise ||= import('typed.js')
  return typedPromise
}

const loadMermaid = () => {
  mermaidPromise ||= import('mermaid')
  return mermaidPromise
}

const hydrateFrappe = async (node) => {
  const previousChart = node[FRAPPE_INSTANCE_KEY]
  if (previousChart?.destroy) previousChart.destroy()
  node[FRAPPE_INSTANCE_KEY] = null

  const inferType = () => {
    if (node.dataset.type) return node.dataset.type
    if (node.classList.contains('frappe-pie-chart')) return 'pie'
    return 'line'
  }

  const normalizeData = (type) => {
    const parsedData = safeParse(node.dataset.data, null)
    if (parsedData) return parsedData

    const labels = parseLooseArray(node.dataset.labels)
    const values = parseLooseArray(node.dataset.values, { numeric: true })
    const series = parseLooseArray(node.dataset.series, { numeric: true })
    const inferredLabels = labels.length > 0 ? labels : values.map((_, idx) => `Item ${idx + 1}`)

    // Common shorthand for pie/donut blocks.
    if (type === 'pie' || type === 'percentage') {
      const pieValues = values.length > 0 ? values : series
      return {
        labels: inferredLabels,
        datasets: [{ values: pieValues }],
      }
    }

    // Line/bar shorthand: data-series as numeric array.
    if (series.length > 0 || values.length > 0) {
      const datasetValues = series.length > 0 ? series : values
      const axisLabels = labels.length > 0 ? labels : datasetValues.map((_, idx) => `${idx + 1}`)
      return {
        labels: axisLabels,
        datasets: [{ name: node.dataset.name || 'Series', values: datasetValues }],
      }
    }

    return { labels: [], datasets: [] }
  }

  const type = inferType()
  const data = normalizeData(type)
  const options = safeParse(node.dataset.options, {})
  const mod = await loadFrappe()
  const ChartCtor =
    type === 'pie'
      ? (mod.PieChart || mod.Chart || mod.default)
      : type === 'percentage'
        ? (mod.PercentageChart || mod.Chart || mod.default)
        : (mod.AxisChart || mod.Chart || mod.default)
  if (!ChartCtor) throw new Error('Frappe constructor not found')
  const chart = new ChartCtor(node, { type, data, ...options })

  // Guard against React remount timing where frappe redraws after its svg was detached.
  if (typeof chart.makeChartArea === 'function') {
    const makeChartArea = chart.makeChartArea.bind(chart)
    chart.makeChartArea = () => {
      if (chart.svg && chart.svg.parentNode !== chart.container) {
        chart.svg = null
      }
      return makeChartArea()
    }
  }

  node[FRAPPE_INSTANCE_KEY] = chart
}

const hydrateTyped = async (node) => {
  const strings = safeParse(node.dataset.strings, [])
  const typeSpeed = Number(node.dataset.typeSpeed || 35)
  const backSpeed = Number(node.dataset.backSpeed || 20)
  const loop = node.dataset.loop !== '0'
  const mod = await loadTyped()
  const Typed = mod.default
  new Typed(node, { strings, typeSpeed, backSpeed, loop })
}

const sanitizeMermaid = (source) => {
  let counter = 0
  const labelToId = new Map()
  // Replace bare quoted node IDs ("Label") not already inside brackets (["Label"])
  return source.replace(/(?<!\[)"([^"]+)"/g, (_match, label) => {
    if (!labelToId.has(label)) labelToId.set(label, `n${counter++}`)
    return `${labelToId.get(label)}["${label}"]`
  })
}

const hydrateMermaid = async (node) => {
  const raw = node.dataset.definition || node.textContent || ''
  const source = sanitizeMermaid(raw)
  const id = node.id || `yk-mermaid-${crypto.randomUUID()}`
  node.id = id
  const mod = await loadMermaid()
  const mermaid = mod.default
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
  try {
    const result = await mermaid.render(`${id}-svg`, source)
    node.innerHTML = result.svg
  } catch (error) {
    const message = error.message || error.str || 'Mermaid syntax error'
    throw new Error(`Mermaid parse error: ${message}`)
  }
}

const hydrateBlocks = async (nodes, handler) => {
  for (const node of nodes) {
    if (node.getAttribute('data-ready') === READY) continue
    if (node.getAttribute(HYDRATING) === READY) continue
    node.setAttribute(HYDRATING, READY)
    try {
      await handler(node)
      markDone(node)
    } catch (error) {
      markError(node, error)
    } finally {
      node.removeAttribute(HYDRATING)
    }
  }
}

export async function hydrateChatContent(rootNode) {
  await hydrateBlocks(rootNode.querySelectorAll('.yk-chart, .frappe-pie-chart, .frappe-chart'), hydrateFrappe)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-typed'), hydrateTyped)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-mermaid, .mermaid'), hydrateMermaid)
}
