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
  class="yk-apex-chart"
  data-type="line"
  data-series='[{"name":"Apex","data":[1,3,2,5]}]'
  data-options='{"xaxis":{"categories":["Q1","Q2","Q3","Q4"]}}'
></div>

<div
  class="yk-chartjs"
  data-type="bar"
  data-data='{"labels":["A","B","C"],"datasets":[{"label":"ChartJS","data":[5,2,4]}]}'
  data-options='{"responsive":true}'
></div>

<div
  class="yk-typed"
  data-strings='["Typed one","Typed two","Typed three"]'
  data-type-speed="28"
></div>

<div
  class="yk-rough"
  data-type="rectangle"
  data-width="640"
  data-height="180"
  data-items='[{"x":20,"y":20,"w":160,"h":80},{"x":220,"y":50,"w":180,"h":90}]'
></div>

<div
  class="yk-particles"
  data-config='{"fullScreen":{"enable":false},"particles":{"number":{"value":24},"size":{"value":2},"move":{"enable":true,"speed":1}}}'
  style="height: 160px;"
></div>

<div class="yk-mermaid">graph LR; Start-->Hydrate; Hydrate-->Render;</div>
`

export const HYDRATOR_SMOKE_MESSAGE = {
  id: 'hydrator-smoke-test',
  role: 'ASSISTANT',
  content: HYDRATOR_SMOKE_HTML,
  metadata: JSON.stringify({ index: 0, cycle: 1, isNotice: false }),
}
