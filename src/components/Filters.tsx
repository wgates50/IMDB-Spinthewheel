"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/normalize";
import type { Facets } from "@/lib/filters";
import { DEFAULT_FILTERS, type Category, type Filters as FilterState } from "@/lib/types";

interface FiltersProps {
  filters: FilterState;
  facets: Facets;
  onChange: (next: FilterState) => void;
  matchCount: number;
  totalCount: number;
  hasOmdb: boolean;
  /** Metascore hydration progress: how many titles have been looked up. */
  metascoreProgress: { done: number; total: number } | null;
}

const GENRES_SHOWN = 12;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-imdb-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-imdb-muted mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-imdb-yellow cursor-pointer"
      />
      <span className="text-sm leading-tight">
        <span className="group-hover:text-imdb-yellow transition-colors">{label}</span>
        {hint ? <span className="block text-xs text-imdb-muted mt-0.5">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FiltersPanel({
  filters,
  facets,
  onChange,
  matchCount,
  totalCount,
  hasOmdb,
  metascoreProgress,
}: FiltersProps) {
  const [showAllGenres, setShowAllGenres] = useState(false);

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toggleCategory = (category: Category) => {
    const active = filters.categories.includes(category);
    const next = active
      ? filters.categories.filter((entry) => entry !== category)
      : [...filters.categories, category];
    update({ categories: next });
  };

  const toggleGenre = (genre: string) => {
    const active = filters.genres.includes(genre);
    update({
      genres: active ? filters.genres.filter((entry) => entry !== genre) : [...filters.genres, genre],
    });
  };

  const genres = showAllGenres ? facets.genres : facets.genres.slice(0, GENRES_SHOWN);
  const metascoreReady = hasOmdb;
  const hydrating = metascoreProgress && metascoreProgress.done < metascoreProgress.total;

  return (
    <div className="panel p-4 sm:p-5 space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Filters</h2>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          className="text-xs text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
        >
          Reset
        </button>
      </header>

      <p className="text-sm text-imdb-muted -mt-1">
        <span className="font-bold text-imdb-yellow">{matchCount}</span> of {totalCount} titles on the
        wheel
      </p>

      <Section title="Type">
        <div className="flex flex-wrap gap-2">
          {facets.categories.map(({ category, count }) => (
            <button
              key={category}
              type="button"
              className="chip"
              data-active={filters.categories.includes(category)}
              aria-pressed={filters.categories.includes(category)}
              onClick={() => toggleCategory(category)}
            >
              {CATEGORY_LABELS[category]}
              <span className="opacity-60 text-xs">{count}</span>
            </button>
          ))}
        </div>
        {filters.categories.length === 0 ? (
          <p className="text-xs text-imdb-red mt-2">Pick at least one type.</p>
        ) : null}
      </Section>

      <Section title="Genre">
        {facets.genres.length === 0 ? (
          <p className="text-xs text-imdb-muted">
            This import has no genre data, so genre filtering is off.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {genres.map(({ name, count }) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  data-active={filters.genres.includes(name)}
                  aria-pressed={filters.genres.includes(name)}
                  onClick={() => toggleGenre(name)}
                >
                  {name}
                  <span className="opacity-60 text-xs">{count}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
              {facets.genres.length > GENRES_SHOWN ? (
                <button
                  type="button"
                  onClick={() => setShowAllGenres((value) => !value)}
                  className="text-xs text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
                >
                  {showAllGenres ? "Show fewer" : `Show all ${facets.genres.length}`}
                </button>
              ) : null}

              {filters.genres.length > 1 ? (
                <label className="flex items-center gap-2 text-xs text-imdb-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.matchAllGenres}
                    onChange={(event) => update({ matchAllGenres: event.target.checked })}
                    className="h-3.5 w-3.5 accent-imdb-yellow cursor-pointer"
                  />
                  Must match every selected genre
                </label>
              ) : null}

              {filters.genres.length ? (
                <button
                  type="button"
                  onClick={() => update({ genres: [] })}
                  className="text-xs text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
                >
                  Clear genres
                </button>
              ) : null}
            </div>
          </>
        )}
      </Section>

      <Section title="Minimum IMDb rating">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={9.5}
            step={0.1}
            value={filters.minImdbRating}
            aria-label="Minimum IMDb rating"
            onChange={(event) => update({ minImdbRating: Number(event.target.value) })}
          />
          <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums">
            {filters.minImdbRating > 0 ? (
              <span className="text-imdb-yellow">★ {filters.minImdbRating.toFixed(1)}+</span>
            ) : (
              <span className="text-imdb-muted">Any</span>
            )}
          </span>
        </div>
      </Section>

      <Section title="Minimum Metascore">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minMetascore}
            disabled={!metascoreReady}
            aria-label="Minimum Metascore"
            onChange={(event) => update({ minMetascore: Number(event.target.value) })}
          />
          <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums">
            {filters.minMetascore > 0 ? (
              <span className="text-imdb-green">{filters.minMetascore}+</span>
            ) : (
              <span className="text-imdb-muted">Any</span>
            )}
          </span>
        </div>
        {!metascoreReady ? (
          <p className="text-xs text-imdb-muted mt-1.5">
            Metascores need an OMDb key — see the setup notes in the README.
          </p>
        ) : hydrating ? (
          <p className="text-xs text-imdb-muted mt-1.5">
            Loading Metascores… {metascoreProgress.done} of {metascoreProgress.total}
          </p>
        ) : (
          <p className="text-xs text-imdb-muted mt-1.5">
            Metacritic&apos;s 0–100 critic score. IMDb exports don&apos;t include it, so it&apos;s
            fetched separately.
          </p>
        )}
      </Section>

      <Section title="Options">
        <div className="space-y-2.5">
          <Toggle
            checked={filters.includeUnrated}
            onChange={(value) => update({ includeUnrated: value })}
            label="Keep titles with no rating"
            hint="Unreleased and obscure titles often have no score yet."
          />
          <Toggle
            checked={filters.skipRecentWinners}
            onChange={(value) => update({ skipRecentWinners: value })}
            label="Skip my last few winners"
            hint="Stops the same title coming up spin after spin."
          />
        </div>
      </Section>
    </div>
  );
}
