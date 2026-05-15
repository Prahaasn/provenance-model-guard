'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { humanFileSize } from '../../lib/readFile';

export interface LoadedFile {
  file: File;
  sheetCount?: number;
}

interface Props {
  label: string;
  sublabel?: string;
  loaded: LoadedFile | null;
  onFile: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
}

export function FileDrop({ label, sublabel, loaded, onFile, onClear, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleClick = () => inputRef.current?.click();

  if (loaded) {
    return (
      <div
        className={[
          'flex items-center justify-between rounded-xl border border-border-accent bg-surface-2 px-4',
          compact ? 'py-3' : 'py-4',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface">
            <FileSpreadsheet className="h-5 w-5 text-sky-300" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">
              {loaded.file.name}
            </div>
            <div className="text-xs text-text-muted">
              {humanFileSize(loaded.file.size)}
              {loaded.sheetCount != null ? ` · ${loaded.sheetCount} sheet${loaded.sheetCount === 1 ? '' : 's'}` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 rounded-md p-2 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={[
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors',
        compact ? 'gap-1 px-4 py-8' : 'gap-2 px-6 py-12',
        isDragging
          ? 'border-sky-300 bg-sky-300/5'
          : 'border-border-accent bg-surface hover:border-border-accent hover:bg-surface-2',
      ].join(' ')}
    >
      <Upload className={['text-text-muted', compact ? 'h-5 w-5' : 'h-6 w-6'].join(' ')} />
      <div
        className={[
          'font-medium text-text-primary',
          compact ? 'text-sm' : 'text-base',
        ].join(' ')}
      >
        {label}
      </div>
      {sublabel ? (
        <div className="text-xs text-text-muted">{sublabel}</div>
      ) : (
        <div className="text-xs text-text-muted">
          Drop .xlsx file or click to upload
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
