export const HYDRATOR_SMOKE_HTML = `
<section>
  <h3>Hydrator Smoke Test</h3>
  <p>Minimal blocks for all visual hydrators.</p>
</section>

<div
  class="yk-chart"
  data-type="line"
  data-data='{"labels":["Mon","Tue","Wed"],"datasets":[{"name":"Frappe","values":[2,4,3]}]}'
></div>

<div
  class="yk-typed"
  data-strings='["Typed one","Typed two","Typed three"]'
  data-type-speed="28"
></div>

<div class="yk-mermaid">graph LR; Start-->Hydrate; Hydrate-->Render;</div>
`

export const HYDRATOR_SMOKE_MESSAGE = {
  id: 'hydrator-smoke-test',
  role: 'ASSISTANT',
  content: HYDRATOR_SMOKE_HTML,
  metadata: JSON.stringify({ index: 0, cycle: 1, isNotice: false }),
}
