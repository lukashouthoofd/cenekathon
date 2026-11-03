'use client';

import { useState } from 'react';
import type { Company, Record } from '@/lib/data';

type Msg = { role: 'user' | 'assistant'; content: string };

const LABELS: { [k: string]: string } = { skills: 'Vaardigheden', ai_usage: 'Gebruik van AI', training: 'Opleiding' };
const SUGGESTIONS = ['Welke skill ontbreekt het meest?', 'Geef de drie belangrijkste acties'];

export default function Chat({ company, scores, records }: Pick<Company, 'company' | 'scores'> & { records: Record[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Record | null>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: next }) });
      const body = await res.json();
      setMessages([...next, { role: 'assistant', content: body.message?.content ?? `Fout: ${body.error}` }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Fout: geen verbinding met de server.' }]);
    } finally {
      setBusy(false);
    }
  }

  /** Turns [mt1] / [is3, is5] citations into buttons that open the source in the sidebar, and **x** into bold. */
  function render(text: string) {
    return text.split(/(\[[a-z]{2}\d+(?:,\s*[a-z]{2}\d+)*\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      const refs = part.startsWith('[') ? part.slice(1, -1).split(/,\s*/) : [];
      const cited = refs.map((ref) => records.find((r) => r.ref === ref));
      if (refs.length === 0 || cited.some((r) => !r)) return <span key={i}>{part}</span>;
      return cited.map((record) => (
        <button key={`${i}-${record!.ref}`} className="cite" onClick={() => setSource(record!)}>{record!.ref}</button>
      ));
    });
  }

  return (
    <div className="shell">
      <main className="chat">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              <h1>Hoe AI-klaar is {company.name}?</h1>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.role === 'assistant' ? render(m.content) : m.content}</div>
          ))}
          {busy && <div className="msg assistant muted">Data doorzoeken…</div>}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Stel een vraag over het bedrijf…" />
          <button disabled={busy || !input.trim()}>Verstuur</button>
        </form>
      </main>

      <aside className="side">
        <h2>{company.name}</h2>
        <p className="muted">{company.sector} · {company.employees} medewerkers</p>
        {Object.entries(scores).map(([key, s]) => (
          <div key={key} className="score">
            <div className="score-head"><span>{LABELS[key]}</span><strong>{s.value}</strong></div>
            <div className="bar"><div style={{ width: `${s.value}%` }} /></div>
            <p>{s.explanation}</p>
            <p className="muted">Datadekking: {s.coverage}</p>
          </div>
        ))}
        {source && (
          <div className="source">
            <div className="score-head"><span>Bron {source.ref}</span><button onClick={() => setSource(null)}>×</button></div>
            <dl>
              {Object.entries(source).filter(([k]) => k !== 'ref' && k !== 'id').map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>
              ))}
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
