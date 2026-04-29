const READY = '1'
const HYDRATING = 'data-hydrating'

let apexPromise
let frappePromise
let chartPromise
let typedPromise
let roughPromise
let particlesPromise
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

const loadApex = () => {
  apexPromise ||= import('apexcharts')
  return apexPromise
}

const loadChart = () => {
  chartPromise ||= import('chart.js/auto')
  return chartPromise
}

const loadFrappe = () => {
  frappePromise ||= import('frappe-charts/dist/frappe-charts.esm.js')
  return frappePromise
}

const loadTyped = () => {
  typedPromise ||= import('typed.js')
  return typedPromise
}

const loadRough = () => {
  roughPromise ||= import('roughjs/bundled/rough.esm.js')
  return roughPromise
}

const loadParticles = () => {
  particlesPromise ||= Promise.all([
    import('tsparticles'),
    import('@tsparticles/engine'),
  ]).then(async ([tsparticlesMod, engineMod]) => {
    const loadFull = tsparticlesMod.loadFull || tsparticlesMod.default?.loadFull
    const tsParticles = engineMod.tsParticles || engineMod.default?.tsParticles
    if (!loadFull || !tsParticles) throw new Error('tsParticles engine bootstrap unavailable')
    await loadFull(tsParticles)
    return tsParticles
  })
  return particlesPromise
}

const loadMermaid = () => {
  mermaidPromise ||= import('mermaid')
  return mermaidPromise
}

const hydrateApex = async (node) => {
  const type = node.dataset.type || 'line'
  const series = safeParse(node.dataset.series, [])
  const options = safeParse(node.dataset.options, {})
  const mod = await loadApex()
  const ApexCharts = mod.default
  const chart = new ApexCharts(node, { chart: { type }, series, ...options })
  await chart.render()
}

const hydrateChartJs = async (node) => {
  const type = node.dataset.type || 'bar'
  const data = safeParse(node.dataset.data, { labels: [], datasets: [] })
  const options = safeParse(node.dataset.options, {})
  const mod = await loadChart()
  const Chart = mod.default
  const canvas = document.createElement('canvas')
  node.replaceChildren(canvas)
  new Chart(canvas, { type, data, options })
}

const hydrateFrappe = async (node) => {
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
  // Clear node first to avoid DOM race condition with frappe-charts
  node.innerHTML = ''
  const container = document.createElement('div')
  node.appendChild(container)
  new ChartCtor(container, { type, data, ...options })
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

const hydrateRough = async (node) => {
  const type = node.dataset.type || 'rectangle'
  const items = safeParse(node.dataset.items, [])
  const options = safeParse(node.dataset.options, {})
  const width = Number(node.dataset.width || 640)
  const height = Number(node.dataset.height || 260)
  const mod = await loadRough()
  const rough = mod.default

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', String(height))
  node.replaceChildren(svg)
  const rc = rough.svg(svg)

  for (const item of items) {
    const drawing =
      type === 'circle'
        ? rc.circle(item.x, item.y, item.diameter || item.d || 50, { ...options, ...(item.options || {}) })
        : type === 'line'
          ? rc.line(item.x1, item.y1, item.x2, item.y2, { ...options, ...(item.options || {}) })
          : rc.rectangle(item.x, item.y, item.w || item.width || 100, item.h || item.height || 50, { ...options, ...(item.options || {}) })
    svg.append(drawing)
  }
}

const hydrateParticles = async (node) => {
  const config = safeParse(node.dataset.config, {})
  const tsParticles = await loadParticles()
  if (!node.id) node.id = `yk-particles-${crypto.randomUUID()}`
  await tsParticles.load({ id: node.id, options: config })
}

const hydrateMermaid = async (node) => {
  const source = node.dataset.definition || node.textContent || ''
  const id = node.id || `yk-mermaid-${crypto.randomUUID()}`
  node.id = id
  const mod = await loadMermaid()
  const mermaid = mod.default
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
  try {
    const result = await mermaid.render(`${id}-svg`, source)
    node.innerHTML = result.svg
  } catch (error) {
    // Extract parse error message for better debugging
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
  await hydrateBlocks(rootNode.querySelectorAll('.yk-apex-chart'), hydrateApex)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-chartjs'), hydrateChartJs)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-typed'), hydrateTyped)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-rough'), hydrateRough)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-particles'), hydrateParticles)
  await hydrateBlocks(rootNode.querySelectorAll('.yk-mermaid, .mermaid'), hydrateMermaid)
}
