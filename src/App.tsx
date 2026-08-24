import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type PurchaseOrder = {
  po: string
  vendor: string
  companyCode: string
  currency: string
  amount: number
  ordered: string
}

type Receipt = {
  document: string
  po: string
  type: 'GR' | 'IR'
  date: string
  amount: number
  status: 'Matched' | 'Unmatched'
}

type Message = {
  role: 'user' | 'assistant'
  text: string
  evidence?: string[]
  query?: string
}

const purchaseOrders: PurchaseOrder[] = [
  { po: '4500012841', vendor: 'Northwind Industrial', companyCode: '1000', currency: 'USD', amount: 14850, ordered: '2026-07-02' },
  { po: '4500012867', vendor: 'Apex Components', companyCode: '1000', currency: 'USD', amount: 3260, ordered: '2026-07-08' },
  { po: '4500012914', vendor: 'BluePeak Logistics', companyCode: '2000', currency: 'EUR', amount: 9720, ordered: '2026-07-15' },
  { po: '4500012952', vendor: 'Northwind Industrial', companyCode: '1000', currency: 'USD', amount: 1840, ordered: '2026-07-21' },
  { po: '4500012990', vendor: 'Cedar Works', companyCode: '3000', currency: 'USD', amount: 6750, ordered: '2026-07-25' },
]

const receipts: Receipt[] = [
  { document: '5000124410', po: '4500012841', type: 'GR', date: '2026-07-18', amount: 14850, status: 'Matched' },
  { document: '5100090312', po: '4500012841', type: 'IR', date: '2026-07-19', amount: 14850, status: 'Matched' },
  { document: '5000124478', po: '4500012867', type: 'GR', date: '2026-07-26', amount: 2260, status: 'Unmatched' },
  { document: '5100090441', po: '4500012867', type: 'IR', date: '2026-07-27', amount: 2260, status: 'Unmatched' },
  { document: '5000124533', po: '4500012914', type: 'GR', date: '2026-08-01', amount: 9720, status: 'Matched' },
  { document: '5100090528', po: '4500012914', type: 'IR', date: '2026-08-02', amount: 9720, status: 'Matched' },
  { document: '5000124602', po: '4500012952', type: 'GR', date: '2026-08-05', amount: 1840, status: 'Unmatched' },
  { document: '5000124671', po: '4500012990', type: 'GR', date: '2026-08-08', amount: 6750, status: 'Matched' },
]

const formatMoney = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

function answerQuestion(question: string): Omit<Message, 'role'> {
  const normalized = question.toLowerCase()

  if (normalized.includes('unmatched') && (normalized.includes('1000') || normalized.includes('1,000'))) {
    const matches = purchaseOrders.filter((order) => {
      const orderReceipts = receipts.filter((receipt) => receipt.po === order.po && receipt.type === 'GR')
      return orderReceipts.some((receipt) => receipt.status === 'Unmatched' && receipt.amount > 1000)
    })
    return {
      text: `I found ${matches.length} purchase orders with unmatched goods receipts over $1,000.`,
      evidence: matches.map((order) => {
        const receipt = receipts.find((item) => item.po === order.po && item.type === 'GR' && item.status === 'Unmatched')!
        return `${order.po} · ${order.vendor} · ${formatMoney(receipt.amount)} unmatched GR`
      }),
      query: 'POs joined to GR where status = Unmatched AND GR amount > 1,000',
    }
  }

  const poMatch = normalized.match(/\b45000\d{5}\b/)
  if (poMatch) {
    const po = purchaseOrders.find((order) => order.po === poMatch[0])
    const poReceipts = receipts.filter((receipt) => receipt.po === poMatch[0])
    if (!po) return { text: `I could not find ${poMatch[0]} in the loaded purchase-order table.`, query: 'Lookup PO by exact PO number' }
    return {
      text: `${po.po} is for ${po.vendor}, totaling ${formatMoney(po.amount, po.currency)}. I found ${poReceipts.length} related receipt documents.`,
      evidence: [`PO header · ${po.po} · ${po.vendor} · ${formatMoney(po.amount, po.currency)}`, ...poReceipts.map((receipt) => `${receipt.type} ${receipt.document} · ${formatMoney(receipt.amount, po.currency)} · ${receipt.status}`)],
      query: `PO header lookup joined to receipts on po = ${po.po}`,
    }
  }

  if (normalized.includes('vendor') || normalized.includes('supplier')) {
    const totals = purchaseOrders.reduce<Record<string, number>>((result, order) => {
      const key = `${order.currency} · ${order.vendor}`
      result[key] = (result[key] || 0) + order.amount
      return result
    }, {})
    const topVendor = Object.entries(totals).sort(([, first], [, second]) => second - first)[0]
    return {
      text: `I cannot rank vendors across USD and EUR without an exchange rate. Within the loaded currencies, ${topVendor[0].split(' · ')[1]} is highest in ${topVendor[0].split(' · ')[0]} at ${formatMoney(topVendor[1], topVendor[0].split(' · ')[0])}.`,
      evidence: Object.entries(totals).map(([vendor, amount]) => `${vendor} · ${formatMoney(amount, vendor.split(' · ')[0])} across ${purchaseOrders.filter((order) => `${order.currency} · ${order.vendor}` === vendor).length} POs`),
      query: 'GROUP BY currency, vendor, SUM PO amount; no FX conversion applied',
    }
  }

  return {
    text: 'I can answer exact PO lookups, vendor totals, and unmatched receipts over $1,000. Try one of the example questions below.',
    query: 'No supported intent matched; no data query executed',
  }
}

function App() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Good morning. I have loaded the PO header and receipt tables. What would you like to reconcile?' }])

  const ask = (value: string) => {
    if (!value.trim()) return
    setMessages((current) => [...current, { role: 'user', text: value }, { role: 'assistant', ...answerQuestion(value) }])
    setQuestion('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    ask(question)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>sap<span className="brand-light">/</span>reconcile</span></div>
        <div className="topbar-meta"><span className="live-dot" /> DATA CONNECTED <span className="divider" /> <span>24 AUG 2026 · 09:42</span></div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">CONTROL ROOM</div>
          <h1>Reconciliation<br /><em>desk</em></h1>
          <p className="sidebar-copy">Ask questions across your SAP export pair. Every answer links back to the loaded records.</p>
          <div className="table-status">
            <div className="section-label">LOADED TABLES <span>2 / 2</span></div>
            <div className="table-row"><span className="table-icon">PO</span><div><strong>PO_HEADERS</strong><small>5 records · 5 fields</small></div><span className="check">✓</span></div>
            <div className="table-row"><span className="table-icon receipt">GR</span><div><strong>RECEIPTS</strong><small>8 records · 6 fields</small></div><span className="check">✓</span></div>
          </div>
          <div className="sidebar-foot"><span className="status-bar" /> MOCK EXPORT · READ ONLY</div>
        </aside>

        <section className="chat-panel">
          <div className="chat-heading"><div><div className="eyebrow">ASSISTANT / RECON-01</div><h2>Ask your data</h2></div><span className="accuracy-badge">● GROUNDED MODE</span></div>
          <div className="message-list">
            {messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
              <div className="avatar">{message.role === 'assistant' ? 'S' : 'YOU'}</div>
              <div className="message-body"><div className="message-meta">{message.role === 'assistant' ? 'SAP ASSISTANT' : 'YOU'} <span>{index === 0 ? 'NOW' : '09:4' + index}</span></div><p>{message.text}</p>
                {message.evidence && <div className="evidence"><div className="evidence-title">EVIDENCE FROM LOADED DATA <span>{message.evidence.length} ROWS</span></div>{message.evidence.map((item) => <div className="evidence-row" key={item}><span>↳</span>{item}</div>)}<div className="query-line">QUERY · {message.query}</div></div>}
                {message.query && !message.evidence && <div className="query-line standalone">QUERY · {message.query}</div>}
              </div>
            </article>)}
          </div>
          <div className="composer-wrap">
            <div className="suggestions"><span>TRY ASKING</span><button onClick={() => ask('Which POs have unmatched receipts over $1,000?')}>Unmatched receipts over $1,000 <b>↗</b></button><button onClick={() => ask('Show me PO 4500012867')}>Show PO 4500012867 <b>↗</b></button><button onClick={() => ask('Which vendor has the highest total?')}>Highest vendor total <b>↗</b></button></div>
            <form className="composer" onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your purchase orders..." aria-label="Ask about your purchase orders" /><button type="submit" aria-label="Send question">↑</button></form>
            <div className="composer-note">Answers are generated only from the two loaded mock tables <span>⌘ ↵ to send</span></div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
