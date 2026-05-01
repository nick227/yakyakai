import { useEffect, useRef } from 'react'
import { hydrateChatContent } from '../lib/chatHydrator.js'

const TEST_HTML = `
<section>
  <h3>Hydrator Library Test</h3>
  <p>Smoke rendering for all supported visual libraries.</p>
</section>

<div
  class="yk-chart"
  data-type="line"
  data-labels='["Mon","Tue","Wed","Thu"]'
  data-series='[2,5,3,6]'
></div>

<div
  class="frappe-pie-chart"
  data-labels='["A","B","C"]'
  data-values='[30,45,25]'
></div>

<div
  class="yk-typed"
  data-strings='["Typed.js OK","Library hydration OK","Ready"]'
  data-type-speed="28"
></div>

<div class="yk-mermaid">graph LR; Input-->Hydrator; Hydrator-->Rendered;</div>
`

export default function HydratorLibraryTest() {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) hydrateChatContent(ref.current)
  }, [])

  return (
    <main className="chat-shell" style={{ padding: 24 }}>
      <div className="chat-message">
        <div className="msg-content" style={{ width: '100%' }}>
          <div className="chat-message-body" ref={ref} dangerouslySetInnerHTML={{ __html: TEST_HTML }} />
        </div>
      </div>
    </main>
  )
}
