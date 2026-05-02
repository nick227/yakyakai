export const CHART_TYPES_PROMPTS = [

    // BAR comparison
    `Add a bar chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="bar" data-labels='["A","B","C"]' data-values='[10,20,30]'></div>`,

    // LINE trend
    `Add a line chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="line" data-labels='["A","B","C"]' data-values='[10,20,30]'></div>`,

    // PIE composition
    `Add a pie chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="pie" data-labels='["A","B","C"]' data-values='[40,35,25]'></div>`,

    // MERMAID process
    `Add a flow diagram with real steps drawn from the subject. Use node IDs, not bare quoted strings:
<div class="yk-mermaid">graph LR; A[Step] --> B[Step] --> C[Step]</div>`,

    // TABLE structured info
    'Add a table with real data drawn from the subject. Use meaningful column headers and distinct row values — no placeholder text.',

    // TYPED headline
    `Add a Typed.js headline with one compelling statement about the subject — no script tags:
<div class="yk-typed" data-strings='["Statement about the subject."]'></div>`,

  ]