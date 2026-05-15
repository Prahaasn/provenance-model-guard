import { ShieldCheck, Github } from 'lucide-react';
import { ReportShell } from './components/ReportShell';
import { McpCallout } from './components/McpCallout';

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-base/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border-accent bg-surface">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              Provenance Model Guard
            </span>
            <span className="hidden rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted sm:inline-block">
              Prototype
            </span>
          </div>
          <nav className="flex items-center gap-3 text-xs text-text-secondary">
            <a
              href="#mcp"
              className="transition-colors hover:text-text-primary"
            >
              MCP server
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2 py-1 transition-colors hover:border-border-accent hover:text-text-primary"
            >
              <Github className="h-3 w-3" />
              Source
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-content px-6 pb-24 pt-12">
        {/* Hero */}
        <section className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] uppercase tracking-wider text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
            Pre-submission lint for financial models
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
            Catch what review would catch.
            <span className="block text-text-secondary">Before review sees it.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            Drop a workbook to lint it. Drop two to see only the issues this
            version introduced. Diff-aware. MCP-native. Runs entirely in your
            browser.
          </p>
        </section>

        <ReportShell />

        <div id="mcp">
          <McpCallout />
        </div>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-text-muted sm:flex-row sm:items-center">
          <div>
            Built in one day by Prahaas as a prototype for Provenance. Not
            affiliated.
          </div>
          <div className="flex items-center gap-3">
            <span>Local-only · No telemetry · No upload</span>
          </div>
        </div>
      </footer>
    </>
  );
}
