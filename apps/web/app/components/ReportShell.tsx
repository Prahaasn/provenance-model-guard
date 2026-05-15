'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  parseWorkbook,
  lintWorkbook,
  lintDiff,
  type HealthReport,
  type DiffReport,
  type ParsedWorkbook,
} from '@pmg/lint-engine';
import { ModeSwitcher, type Mode } from './ModeSwitcher';
import { FileDrop, type LoadedFile } from './FileDrop';
import { HealthScore } from './HealthScore';
import { SummaryBar } from './SummaryBar';
import { CheckCard } from './CheckCard';
import { DiffSummary } from './DiffSummary';
import { EmptyState } from './EmptyState';
import { fetchSampleAsArrayBuffer, readFileAsArrayBuffer } from '../../lib/readFile';

type ReportState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'single'; report: HealthReport; wb: ParsedWorkbook }
  | { kind: 'diff'; report: DiffReport; baseWb: ParsedWorkbook; nextWb: ParsedWorkbook }
  | { kind: 'error'; message: string };

export function ReportShell() {
  const [mode, setMode] = useState<Mode>('single');
  const [single, setSingle] = useState<LoadedFile | null>(null);
  const [baseFile, setBaseFile] = useState<LoadedFile | null>(null);
  const [nextFile, setNextFile] = useState<LoadedFile | null>(null);
  const [state, setState] = useState<ReportState>({ kind: 'idle' });
  const reportRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
    setSingle(null);
    setBaseFile(null);
    setNextFile(null);
  }, []);

  // Reset state when switching modes
  useEffect(() => {
    setState({ kind: 'idle' });
  }, [mode]);

  // Scroll to report when report state lands
  useEffect(() => {
    if (state.kind === 'single' || state.kind === 'diff') {
      requestAnimationFrame(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [state.kind]);

  const runSingle = useCallback(async (file: File) => {
    setState({ kind: 'loading' });
    try {
      const buf = await readFileAsArrayBuffer(file);
      const wb = parseWorkbook(buf, { fileName: file.name });
      const report = lintWorkbook(wb);
      setSingle({ file, sheetCount: wb.sheets.length });
      setState({ kind: 'single', report, wb });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse workbook',
      });
    }
  }, []);

  const runDiff = useCallback(
    async (base: LoadedFile | null, next: LoadedFile | null) => {
      if (!base || !next) return;
      setState({ kind: 'loading' });
      try {
        const [bBuf, nBuf] = await Promise.all([
          readFileAsArrayBuffer(base.file),
          readFileAsArrayBuffer(next.file),
        ]);
        const baseWb = parseWorkbook(bBuf, { fileName: base.file.name });
        const nextWb = parseWorkbook(nBuf, { fileName: next.file.name });
        const report = lintDiff(baseWb, nextWb);
        setBaseFile({ file: base.file, sheetCount: baseWb.sheets.length });
        setNextFile({ file: next.file, sheetCount: nextWb.sheets.length });
        setState({ kind: 'diff', report, baseWb, nextWb });
      } catch (err) {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to parse workbooks',
        });
      }
    },
    []
  );

  const onSingleFile = useCallback(
    (file: File) => {
      setSingle({ file });
      void runSingle(file);
    },
    [runSingle]
  );

  const onBaseFile = useCallback(
    (file: File) => {
      const loaded: LoadedFile = { file };
      setBaseFile(loaded);
      void runDiff(loaded, nextFile);
    },
    [nextFile, runDiff]
  );

  const onNextFile = useCallback(
    (file: File) => {
      const loaded: LoadedFile = { file };
      setNextFile(loaded);
      void runDiff(baseFile, loaded);
    },
    [baseFile, runDiff]
  );

  const loadSamples = useCallback(
    async (kind: 'clean' | 'messy-diff' | 'pristine') => {
      try {
        if (kind === 'pristine') {
          const buf = await fetchSampleAsArrayBuffer('/samples/pristine_dcf.xlsx');
          const file = new File([buf], 'pristine_dcf.xlsx');
          await runSingle(file);
        } else if (kind === 'clean') {
          const buf = await fetchSampleAsArrayBuffer('/samples/clean_dcf_v1.xlsx');
          const file = new File([buf], 'clean_dcf_v1.xlsx');
          await runSingle(file);
        } else {
          const [bBuf, nBuf] = await Promise.all([
            fetchSampleAsArrayBuffer('/samples/clean_dcf_v1.xlsx'),
            fetchSampleAsArrayBuffer('/samples/messy_dcf_v2.xlsx'),
          ]);
          const baseF = new File([bBuf], 'clean_dcf_v1.xlsx');
          const nextF = new File([nBuf], 'messy_dcf_v2.xlsx');
          await runDiff({ file: baseF }, { file: nextF });
        }
      } catch (err) {
        setState({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to load sample files',
        });
      }
    },
    [runDiff, runSingle]
  );

  const report =
    state.kind === 'single' || state.kind === 'diff' ? state.report : null;
  const newFp =
    state.kind === 'diff'
      ? new Set(state.report.newFingerprints)
      : undefined;

  const isDiffMode = mode === 'diff';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <ModeSwitcher
          mode={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
        />
        {(single || baseFile || nextFile) && (
          <button
            onClick={reset}
            className="text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            Reset
          </button>
        )}
      </div>

      {/* Upload area */}
      <div className="rounded-2xl border border-border-subtle bg-surface/60 p-5">
        {isDiffMode ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Base version (v1)
              </div>
              <FileDrop
                label="Drop base .xlsx"
                sublabel="The version your reviewer already saw"
                loaded={baseFile}
                onFile={onBaseFile}
                onClear={() => {
                  setBaseFile(null);
                  setState({ kind: 'idle' });
                }}
                compact
              />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                New version (v2)
              </div>
              <FileDrop
                label="Drop new .xlsx"
                sublabel="The version you're about to submit"
                loaded={nextFile}
                onFile={onNextFile}
                onClear={() => {
                  setNextFile(null);
                  setState({ kind: 'idle' });
                }}
                compact
              />
            </div>
          </div>
        ) : (
          <FileDrop
            label="Drop .xlsx file here or click to upload"
            sublabel="Runs locally in your browser. Nothing is uploaded."
            loaded={single}
            onFile={onSingleFile}
            onClear={() => {
              setSingle(null);
              setState({ kind: 'idle' });
            }}
          />
        )}
      </div>

      {state.kind === 'error' ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-sm font-medium text-red-200">
              Could not parse workbook
            </div>
            <div className="mt-0.5 text-xs text-red-300/80">{state.message}</div>
          </div>
        </div>
      ) : null}

      {state.kind === 'loading' ? (
        <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          Parsing and running checks…
        </div>
      ) : null}

      {state.kind === 'idle' ? (
        <EmptyState mode={mode} onLoadSamples={loadSamples} />
      ) : null}

      {report ? (
        <div ref={reportRef} className="space-y-4 scroll-mt-24">
          <div className="rounded-2xl border border-border-subtle bg-surface p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <HealthScore score={report.score} fileName={report.fileName} />
              <div className="flex flex-col items-start gap-3 md:items-end">
                <SummaryBar counts={report.counts} />
                <div className="text-[11px] text-text-muted">
                  {report.checks.length} checks ·{' '}
                  {new Date(report.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            {state.kind === 'diff' ? (
              <div className="mt-5 border-t border-border-subtle pt-5">
                <DiffSummary report={state.report} />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {[...report.checks]
              .sort((a, b) => {
                // failed first, then warn, then pass; within same status, more issues first
                const rank = (s: string) =>
                  s === 'FAIL' ? 0 : s === 'WARN' ? 1 : 2;
                const r = rank(a.status) - rank(b.status);
                if (r !== 0) return r;
                return b.issues.length - a.issues.length;
              })
              .map((c) => (
                <CheckCard key={c.id} check={c} newFingerprints={newFp} />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
