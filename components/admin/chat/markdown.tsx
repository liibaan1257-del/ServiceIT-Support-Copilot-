import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the copilot's Markdown (bold, lists, code, tables). Raw HTML in the
 * text is not rendered, so a reply can't inject markup or scripts.
 */
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 font-semibold text-zinc-50">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 font-semibold text-zinc-50">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold text-zinc-50">{children}</h3>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-400 underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-zinc-950/70 px-1 py-0.5 font-mono text-[0.85em] text-emerald-200">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-950/80 p-3 font-mono text-xs leading-relaxed text-zinc-200">{children}</pre>
  ),
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 text-zinc-300">{children}</blockquote>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-zinc-700 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-zinc-700 px-2 py-1">{children}</td>,
  hr: () => <hr className="my-3 border-zinc-700" />,
};

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
