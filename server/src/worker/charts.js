export const CHARTS = [

  {
    key: 'bar',
    prompt: `Add a bar chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="bar" data-labels='["A","B","C"]' data-values='[10,20,30]'></div>`,
  },

  {
    key: 'line',
    prompt: `Add a line chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="line" data-labels='["A","B","C"]' data-values='[10,20,30]'></div>`,
  },

  {
    key: 'pie',
    prompt: `Add a pie chart with real values drawn from the subject — no script tags:
<div class="yk-chart" data-type="pie" data-labels='["A","B","C"]' data-values='[40,35,25]'></div>`,
  },

  {
    key: 'mermaid',
    prompt: `Add a flow diagram with real steps drawn from the subject. Use node IDs, not bare quoted strings:
<div class="yk-mermaid">graph LR; A[Step] --> B[Step] --> C[Step]</div>`,
  },

  {
    key: 'table',
    prompt: 'Add a table with real data drawn from the subject. Maximum 3 columns. Use meaningful column headers and distinct row values — no placeholder text.',
  },

  {
    key: 'playbook',
    prompt: 'Numbered list of five steps. Each step: one action verb title and one paragraph of 2–3 sentences on how to execute it. Each step is contingent on completing the previous.',
  },

  {
    key: 'timeline',
    prompt: 'Five stages in chronological order. Each stage: one specific year or named era as the heading and one paragraph of 2–3 sentences on what changed. Final stage is present day or near-future.',
  },

  {
    key: 'big-stats',
    prompt: 'A flex wrap table of statistics. No invented figures.',
  },

  {
    key: 'tier-list',
    prompt: 'Create a tier list. Each item has a name and one sentence stating why it belongs in that tier.',
  },

]
