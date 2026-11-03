import ReactMarkdown, { type Components } from 'react-markdown'
import type { ReactNode } from 'react'
import remarkGfm from 'remark-gfm'

const REF_PREFIX = '#ref:'

// Agent replies (incl. full reports) arrive as Markdown. Raw HTML is not rendered.
function componentsFor(refs: Record<string, string>): Components {
  return {
    h1: ({ children }: { children?: ReactNode }) => <h2 className="mt-4 mb-2 text-title font-semibold first:mt-0">{children}</h2>,
    h2: ({ children }: { children?: ReactNode }) => <h3 className="mt-4 mb-2 text-heading font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }: { children?: ReactNode }) => <h4 className="mt-3 mb-1 text-body font-semibold first:mt-0">{children}</h4>,
    p: ({ children }: { children?: ReactNode }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      if (href?.startsWith(REF_PREFIX)) {
        const label = refs[href.slice(REF_PREFIX.length)]
        return (
          <span
            title={label}
            aria-label={label}
            tabIndex={0}
            className="mx-0.5 cursor-help rounded-sm border border-border px-1 text-caption text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {children}
          </span>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-accent-text underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {children}
        </a>
      )
    },
    code: ({ children }: { children?: ReactNode }) => <code className="rounded-sm bg-muted px-1 font-mono text-body-sm">{children}</code>,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">{children}</table>
      </div>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="border-b border-border-strong px-2 py-1.5 text-left align-bottom font-semibold">{children}</th>
    ),
    td: ({ children }: { children?: ReactNode }) => <td className="border-b border-border px-2 py-1.5 align-top">{children}</td>,
  }
}

/** Turns citations like [is3] or [is3, is5] into links the `a` renderer shows as labelled chips. */
function linkRefs(text: string, refs: Record<string, string>): string {
  return text.replace(/\[([a-z]{2}\d+(?:\s*,\s*[a-z]{2}\d+)*)\](?!\()/g, (match, ids: string) => {
    const list = ids.split(/\s*,\s*/)
    if (!list.every((id) => id in refs)) return match
    return list.map((id) => `[${id}](${REF_PREFIX}${id})`).join(' ')
  })
}

export function Markdown({ text, refs = {} }: { text: string; refs?: Record<string, string> }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentsFor(refs)}>
      {linkRefs(text, refs)}
    </ReactMarkdown>
  )
}
