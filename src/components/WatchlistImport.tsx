"use client";

import { useEffect, useRef, useState } from "react";
import { CsvImportError, parseImdbCsv } from "@/lib/csv";
import type { WatchlistItem } from "@/lib/types";
import { relativeTime, storage, type WatchlistMeta } from "@/lib/storage";

type Tab = "file" | "link";

interface ImportProps {
  meta: WatchlistMeta | null;
  isDemo: boolean;
  onImported: (items: WatchlistItem[], meta: WatchlistMeta, warning?: string) => void;
  onReset: () => void;
}

const TAB_LABELS: Record<Tab, string> = {
  file: "CSV export",
  link: "Public list link",
};

export function WatchlistImport({ meta, isDemo, onImported, onReset }: ImportProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // localStorage is not readable during the server render, so the remembered
  // link is filled in after mount — the same external-system exception the
  // app shell makes when it restores the saved watchlist.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = storage.loadLastLink();
    if (saved) setLink(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const items = parseImdbCsv(await file.text());
      onImported(items, {
        source: file.name,
        kind: "file",
        importedAt: new Date().toISOString(),
        count: items.length,
      });
    } catch (cause) {
      setError(
        cause instanceof CsvImportError
          ? cause.message
          : "Could not read that file. It should be the .csv IMDb gives you.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importLink(source: string) {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Import failed.");

      const items = data.items as WatchlistItem[];
      // Remember the link the viewer typed rather than the resolved page URL,
      // so the field they see next time is the one they know.
      storage.saveLastLink(source);
      onImported(
        items,
        {
          source,
          kind: "link",
          importedAt: new Date().toISOString(),
          count: items.length,
        },
        data.partial
          ? "Some titles came back without genres or ratings, so those filters will miss them. The CSV export has the full data."
          : undefined,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const syncedAgo = meta ? relativeTime(meta.importedAt) : null;

  return (
    <div className="panel p-4 sm:p-5 space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Your watchlist</h2>
        {!isDemo && meta ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
          >
            Clear
          </button>
        ) : null}
      </header>

      {meta && !isDemo ? (
        <div className="-mt-1 space-y-1.5">
          <p className="text-sm text-imdb-muted">
            <span className="text-imdb-text font-semibold">{meta.count} titles</span> from{" "}
            <span className="break-all">{meta.source}</span>
          </p>
          <p className="text-xs text-imdb-muted">
            Saved in this browser
            {syncedAgo ? ` · imported ${syncedAgo}` : null}
          </p>
          {meta.kind === "link" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void importLink(meta.source)}
              className="text-xs text-imdb-yellow underline underline-offset-2 disabled:opacity-50"
            >
              {busy ? "Refreshing…" : "Refresh from IMDb"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-imdb-muted -mt-1">
          Showing a sample list — import yours to spin your own watchlist.
        </p>
      )}

      <div className="flex gap-2" role="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className="chip"
            data-active={tab === key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div className="space-y-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`rounded-lg border border-dashed p-5 text-center transition-colors ${
              dragging ? "border-imdb-yellow bg-imdb-yellow/10" : "border-imdb-line"
            }`}
          >
            <p className="text-sm text-imdb-muted mb-3">Drop your watchlist .csv here</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="rounded bg-imdb-yellow px-4 py-2 text-sm font-bold text-black hover:bg-imdb-yellow-dim disabled:opacity-50"
            >
              {busy ? "Reading…" : "Choose file"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </div>

          <details className="text-xs text-imdb-muted">
            <summary className="cursor-pointer hover:text-imdb-yellow">
              How do I get that file?
            </summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open your Watchlist on IMDb while signed in.</li>
              <li>
                Use the <span className="text-imdb-text">⋯</span> menu at the top of the list and
                choose <span className="text-imdb-text">Export</span>.
              </li>
              <li>
                IMDb prepares the file on its{" "}
                <a
                  href="https://www.imdb.com/exports/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-imdb-yellow underline underline-offset-2"
                >
                  exports page
                </a>{" "}
                — download it, then drop it here.
              </li>
            </ol>
            <p className="mt-2">
              The file is read in your browser. It is never uploaded anywhere.
            </p>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && link.trim() && !busy) void importLink(link.trim());
              }}
              placeholder="Paste your IMDb watchlist link"
              aria-label="IMDb watchlist or list link"
              className="flex-1 min-w-0 rounded border border-imdb-line bg-imdb-panel-2 px-3 py-2 text-sm placeholder:text-imdb-muted/70"
            />
            <button
              type="button"
              disabled={busy || !link.trim()}
              onClick={() => void importLink(link.trim())}
              className="rounded bg-imdb-yellow px-4 py-2 text-sm font-bold text-black hover:bg-imdb-yellow-dim disabled:opacity-50"
            >
              {busy ? "…" : "Load"}
            </button>
          </div>
          <p className="text-xs text-imdb-muted leading-relaxed">
            Takes the link from IMDb&apos;s share button, or a bare ur/ls id. Works only if the list
            is public (IMDb → Account settings → Privacy). IMDb has no public API, so this reads the
            page directly and can break when IMDb changes it — the CSV export is the dependable
            route. Whatever you import is remembered in this browser.
          </p>
        </div>
      )}

      {error ? (
        <p className="rounded border border-imdb-red/40 bg-imdb-red/10 px-3 py-2 text-sm text-imdb-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
