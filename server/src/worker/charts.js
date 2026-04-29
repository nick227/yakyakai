export const CHART_TYPES_PROMPTS = [

    // BAR (comparison)
    'Use Frappe Charts to create a full-width bar chart using <div class="yk-chart" data-type="bar" data-labels=\'["A","B","C"]\' data-values=\'[12,45,18]\' data-title="...">. Replace labels with 3–5 real categories from the subject. Replace all values completely. Values must show uneven, believable differences (no equal spacing like 10,20,30). The chart must clearly show one comparison or tradeoff.',
  
    // LINE (trend)
    'Use Frappe Charts to create a line chart using <div class="yk-chart" data-type="line" data-labels=\'["Start","Middle","End"]\' data-values=\'[12,28,19]\'>. Replace labels with real stages or time periods. Replace all values. Values must form a logical trend (increase, decrease, or fluctuation). Avoid flat or evenly spaced sequences.',
  
    // PIE (composition)
    'Use Frappe Charts to create a pie chart using <div class="yk-chart" data-type="pie" data-labels=\'["A","B","C"]\' data-values=\'[55,30,15]\'>. Replace with real components of the subject. Replace all values. Values must form a realistic distribution and sum to a logical whole (e.g. 100). Avoid equal splits like 50/50 unless justified.',
  
    // MERMAID (process)
    'Use Mermaid to create a flow diagram using <pre class="mermaid">graph TD;</pre>. Expand into a valid diagram with 3–6 nodes representing a real process. Use short, clear labels. Connect nodes logically. Always quote node text if it contains special characters.',
  
    // TABLE (structured info)
    'Create a clean table with 3–5 rows and 2–4 columns showing structured information about the subject. Use real categories and meaningful values. Avoid placeholders like "Item 1". Ensure each row adds distinct value (no repetition).',
  
    // TYPED (headline)
    'Use Typed.js to create a bold hero headline using <div class="yk-typed" data-strings=\'["Insight A","Insight B","Insight C"]\'>. Replace with 3–5 short, concrete statements. Avoid vague phrases. Each line should express a specific insight about the subject.',
  
  ]