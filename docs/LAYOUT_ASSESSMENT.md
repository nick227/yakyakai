# Layout System Assessment

## Overview

The layout system composes three independent dimensions into a single instruction set per AI call:

- **Blueprint** — structural template (how content is organised)
- **Chart** — data visualisation element (what data component is included)
- **Style** — visual and tonal treatment (how the output feels)

There are 18 layouts drawn from 16 blueprints, 6 charts, and 10 styles. The system cycles deterministically through layouts using `position % LAYOUTS.length`, where `position = cycle * 100 + index`. This means within a cycle prompts step through consecutive layouts, but the starting offset shifts by `100 % 18 = 10` each cycle, creating variety across a long session without randomness.

---

## Blueprints (16)

### Strong — clearly scoped, distinct from each other

| Key | Strength |
|-----|----------|
| `hero` | Tight constraint (one headline + one paragraph) forces the AI to be specific |
| `comparison` | The instruction to "take a stance" prevents neutral, useless both-sides output |
| `diagnostic` | "Slightly confrontational" tone instruction actively shapes AI voice |
| `playbook` | Concrete constraints (4–6 steps, action title + execution note) reduce vagueness |
| `contrarian` | Starts with a falsifiable claim, which anchors the whole output |
| `signal` | The Signal/Noise split is a strong frame — hard to dilute |
| `layered` | Simple → advanced progression is well-defined and uncommon |

### Adequate — functional but could be tightened

| Key | Issue |
|-----|-------|
| `grid` | "Each block must feel like a distilled idea, not a summary" is good, but 2x2 grids often collapse into generic quadrant filler. A stronger constraint would help — e.g. requiring each block to contradict the adjacent one. |
| `fast-flow` | Very similar in feel to `playbook`. Both produce stacked short sections. The distinction (momentum vs. steps) may not survive the AI's interpretation. |
| `genius` | "Non-obvious insights" is the right intent but hard to enforce in a prompt. The AI can claim non-obviousness while producing surface content. |
| `timeline` | Stage-based progression works, but without a minimum span (e.g. "at least 10 years apart") the AI often produces artificially tight timelines. |

### Weak — risk of duplication or vagueness

| Key | Issue |
|-----|-------|
| `hierarchy` | One sentence. "Strong visual hierarchy" is what every HTML output should have — this doesn't meaningfully constrain the AI beyond the base system prompt. Barely differentiates. |
| `data-dense` | One sentence. "Create a table of data points" is already covered by the `table` chart. When paired with the table chart in `data-dense-line`, the blueprint and chart say the same thing. Should either be expanded into a distinct editorial frame or retired. |
| `bold-hero` | One sentence. Functionally equivalent to `hero` with the `punchy` style applied. The three-way compound `bold-hero + typed + cinematic` likely produces the same output as `hero + typed + punchy`. Candidate for removal or expansion. |
| `typed-intro` | Instructs the AI to use Typed.js in the layout itself, but the hydrator requires a specific `data-strings` attribute format that only the `typed` chart prompt provides. This blueprint's Typed.js instruction will produce either broken output or an un-hydrated element. Should remove the Typed.js reference from this blueprint and let the chart handle it. |

---

## Charts (6)

### Strong

| Key | Notes |
|-----|-------|
| `bar` | The `data-labels`/`data-values` format is AI-friendly. Most likely to render correctly. |
| `line` | Same format as bar, reliable. Works best when the subject has a natural time series or progression. |
| `mermaid` | Text content approach (source inside the div) is the right call — avoids attribute escaping issues. The node ID constraint is critical and well-stated. |
| `table` | No hydration dependency — plain HTML renders directly. Most robust of all six. |

### Adequate

| Key | Notes |
|-----|-------|
| `pie` | Works, but pie charts are frequently misused for data that should be a bar chart. The AI has no constraint preventing it from using a pie chart for non-compositional data. Could add a hint: "only use when values represent parts of a whole." |
| `typed` | Most fragile. Requires the AI to produce valid JSON inside a single-quoted HTML attribute. If the statement contains an apostrophe or special character, the attribute breaks and hydration fails silently. Consider switching to `data-strings` as a JSON array-in-script approach, or validating/sanitising the output server-side. |

---

## Styles (10)

The styles are the most orthogonal of the three dimensions — a well-defined set with clear, non-overlapping tonal territory.

### Strong

| Key | Notes |
|-----|-------|
| `brutalist` | Unusually specific instruction ("design as argument") gives the AI a strong lens. |
| `cinematic` | "Each section should feel like a scene" is a concrete directive, not a vague adjective. |
| `academic` | "Non-obvious insights backed by reasoning, not assertion" directly addresses the AI's tendency to assert without evidence. |
| `viral` | "Hook first, explain second" is an actionable structure, not just a tone. |
| `minimal` | Clear negative constraint (remove non-essential) tends to work better than positive instructions. |

### Adequate

| Key | Notes |
|-----|-------|
| `editorial` | Slightly overlaps with `minimal` in its whitespace instruction. The distinction (authority vs. removal) holds but is thin at the prompt level. |
| `technical` | "Reads like documentation, not an essay" is useful. Risk: technical style may conflict with blueprints that require prose (e.g. `genius`, `contrarian`). |
| `warm` | The most difficult to make distinctive in HTML — warmth is primarily a writing tone and rarely survives into visual structure. |
| `dense` | Works structurally but may conflict with blueprints that already specify column counts (e.g. `grid` already defines 2x2, `dense` adds multi-column pressure). |
| `punchy` | Strong for visual outputs, but "say less, hit harder" can result in the AI stripping substantive content. Risk of shallow output, particularly when paired with a conceptually deep blueprint like `layered`. |

---

## Layout Combinations (18)

### Well-matched — blueprint, chart, and style all reinforce each other

| Layout | Assessment |
|--------|------------|
| `fast-flow-line` | Momentum copy + line trend + viral hook = strong coherent unit. The chart supports the forward-moving feel. |
| `action-mermaid` | Direct action steps + process flow + brutalist design = unambiguous intent all the way through. |
| `playbook-mermaid` | Step-by-step + flow diagram + warm tone = the most reader-friendly of all 18 layouts. |
| `timeline-line` | Temporal progression + line chart showing that progression + cinematic scale = highly coherent. |
| `signal-table` | Filtering frame + structured table + minimal style = the design mirrors the content's purpose exactly. |
| `genius-only` | No chart removes distraction; warm style counteracts the potential coldness of deep analysis. Good for subject matter where data would feel forced. |
| `bar-only` | No blueprint means no structural constraint — the data shapes the output. Minimal style keeps the AI from decorating around the chart. |

### Interesting tension — style deliberately contrasts the blueprint

| Layout | Assessment |
|--------|------------|
| `contrarian-pie` | Editorial style on a contrarian blueprint produces credible provocation rather than just noise. The pie chart grounds the argument in composition data. Strong creative friction. |
| `genius-table` | Academic style + intellectual blueprint risks becoming very dry. The table forces at least one concrete grounding element. Works if the subject has real quantifiable data; fails on abstract subjects. |
| `data-dense-line` | The blueprint already creates a table; the chart adds a line chart; academic style adds scholarly depth. This is the most data-heavy layout in the set — may overwhelm on subjects with limited real data. |

### Problematic — overlapping instructions or structural conflicts

| Layout | Assessment |
|--------|------------|
| `bold-hero-typed` | `bold-hero` blueprint + `typed` chart + `cinematic` style all push toward the same extreme visual register. The triple adds noise without meaningful differentiation from `hero-typed`. Consider replacing `bold-hero` blueprint with something structurally distinct. |
| `typed-intro-pie` | The `typed-intro` blueprint instructs the AI to use Typed.js in a way the hydrator cannot render (no `data-strings` attribute). The `typed` chart handles hydration correctly — this blueprint should not also request Typed.js. Net effect: two conflicting Typed.js instructions in one call. |
| `hierarchy-bar` | The `hierarchy` blueprint is too vague to produce a distinctive output. The technical style and bar chart both do more work than the blueprint. This layout would produce a similar result to many others with a technical style. |

---

## Summary

### What works well
- The three-dimension system (blueprint + chart + style) gives meaningful variety without requiring the AI to invent its own structure.
- Styles are the strongest layer — they genuinely shift tone and are orthogonal to layout instructions.
- The `none` option for blueprint and chart allows focused single-dimension layouts (`bar-only`, `genius-only`) that avoid over-instruction.

### Recommended changes

1. **Fix `typed-intro` blueprint** — remove the Typed.js instruction from the blueprint text. The chart handles hydration; the blueprint competing for the same element produces broken or duplicate output.

2. **Retire or rewrite `bold-hero`** — it duplicates `hero`. Replace with a blueprint that has genuinely different structural output, such as a Q&A format, a "myth vs. reality" frame, or a glossary/definition layout.

3. **Expand or retire `hierarchy` and `data-dense`** — both are single-sentence blueprints that don't constrain the AI meaningfully. Either give them the same level of specificity as the stronger blueprints, or fold their intent into existing layouts using style selection.

4. **Add an apostrophe guard to `typed` chart** — the `data-strings` JSON attribute will silently break if the AI's statement contains a single quote. A server-side sanitisation step or a note in the prompt ("avoid apostrophes") would reduce render failures.

5. **Consider a `none` layout** — a layout with `blueprint: 'none'`, `chart: 'none'`, and a strong style (e.g. `cinematic` or `editorial`) would give the AI complete structural freedom on a subject, relying entirely on the base system prompt and style. Useful for subjects that don't fit any predefined frame.
