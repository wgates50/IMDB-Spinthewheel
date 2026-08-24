"use client";

import { useState } from "react";
import { formatRuntime, titleUrl } from "@/lib/normalize";
import type { Review, TitleDetails, WatchProvider, WatchlistItem } from "@/lib/types";

/* eslint-disable @next/next/no-img-element -- posters and logos come from
   arbitrary remote hosts (TMDB, Amazon), so the optimizer buys us nothing
   here and would need every host allow-listed up front. */

export const REGIONS = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IE", "Ireland"],
  ["NZ", "New Zealand"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["SE", "Sweden"],
  ["NO", "Norway"],
  ["DK", "Denmark"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["IN", "India"],
  ["JP", "Japan"],
  ["ZA", "South Africa"],
] as const;

function metascoreColor(score: number): string {
  if (score >= 61) return "#66cc33";
  if (score >= 40) return "#ffcc33";
  return "#ff6874";
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-imdb-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (!providers.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-imdb-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <span
            key={`${label}-${provider.name}`}
            className="flex items-center gap-1.5 rounded bg-imdb-panel-2 py-1 pl-1 pr-2.5 text-xs"
            title={provider.name}
          >
            {provider.logoUrl ? (
              <img
                src={provider.logoUrl}
                alt=""
                width={24}
                height={24}
                loading="lazy"
                className="h-6 w-6 rounded"
              />
            ) : null}
            {provider.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, tone }: { review: Review; tone: "good" | "bad" | "mixed" }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.content.length > 420;
  const body = expanded || !long ? review.content : `${review.content.slice(0, 420).trimEnd()}…`;
  const accent =
    tone === "good" ? "border-imdb-green/40" : tone === "bad" ? "border-imdb-red/40" : "border-imdb-line";

  return (
    <article className={`rounded-lg border ${accent} bg-imdb-panel-2/60 p-3`}>
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{review.author}</span>
        {review.rating !== null ? (
          <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-xs font-bold text-imdb-yellow">
            ★ {review.rating}/10
          </span>
        ) : null}
      </header>
      <p className="whitespace-pre-line text-sm leading-relaxed text-imdb-muted">{body}</p>
      <div className="mt-2 flex items-center gap-3 text-xs">
        {long ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-imdb-yellow underline underline-offset-2"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        {review.url ? (
          <a
            href={review.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
          >
            Full review on {review.source}
          </a>
        ) : null}
      </div>
    </article>
  );
}

function ReviewColumn({
  title, subtitle, reviews, tone, emptyHint,
}: {
  title: string;
  subtitle: string;
  reviews: Review[];
  tone: "good" | "bad" | "mixed";
  emptyHint: string;
}) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-sm font-bold">
        {title}
        <span className="ml-2 text-xs font-normal text-imdb-muted">{subtitle}</span>
      </h4>
      {reviews.length ? (
        reviews.map((review, index) => (
          <ReviewCard key={review.url ?? `${review.author}-${index}`} review={review} tone={tone} />
        ))
      ) : (
        <p className="rounded-lg border border-imdb-line bg-imdb-panel-2/40 p-3 text-sm text-imdb-muted">
          {emptyHint}
        </p>
      )}
    </div>
  );
}

interface ResultPanelProps {
  item: WatchlistItem;
  details: TitleDetails | null;
  loading: boolean;
  error: string | null;
  region: string;
  onRegionChange: (region: string) => void;
  onSpinAgain: () => void;
}

export function ResultPanel({
  item, details, loading, error, region, onRegionChange, onSpinAgain,
}: ResultPanelProps) {
  const title = details?.title ?? item.title;
  const year = details?.year ?? item.year;
  const runtime = formatRuntime(details?.runtime ?? item.runtime);
  const genres = details?.genres.length ? details.genres : item.genres;
  const imdbRating = details?.imdbRating ?? item.imdbRating;
  const watch = details?.watch;
  const hasProviders = Boolean(
    watch && (watch.stream.length || watch.rent.length || watch.buy.length || watch.free.length),
  );

  return (
    <section className="panel animate-result-in overflow-hidden" aria-live="polite">
      {details?.backdropUrl ? (
        <div className="relative h-36 sm:h-48">
          <img
            src={details.backdropUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-imdb-panel via-imdb-panel/50 to-transparent" />
        </div>
      ) : null}

      <div className={`p-4 sm:p-6 ${details?.backdropUrl ? "-mt-16 relative" : ""}`}>
        <div className="flex gap-4">
          {details?.posterUrl ? (
            <img
              src={details.posterUrl}
              alt={`${title} poster`}
              className="w-24 sm:w-32 shrink-0 rounded-lg border border-imdb-line object-cover"
              loading="lazy"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-imdb-yellow">
              Tonight you&apos;re watching
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold leading-tight break-words">{title}</h2>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-imdb-muted">
              {year ? <span>{year}</span> : null}
              <span>·</span>
              <span>{details?.titleType ?? item.titleType}</span>
              {details?.certificate ? (
                <>
                  <span>·</span>
                  <span className="rounded border border-imdb-line px-1.5 text-xs">
                    {details.certificate}
                  </span>
                </>
              ) : null}
              {runtime ? (
                <>
                  <span>·</span>
                  <span>{runtime}</span>
                </>
              ) : null}
              {details?.seasons ? (
                <>
                  <span>·</span>
                  <span>
                    {details.seasons} season{details.seasons === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </p>

            {genres.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-imdb-line px-2.5 py-0.5 text-xs"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
              {imdbRating ? (
                <Stat label="IMDb">
                  <span className="text-base font-bold">
                    <span className="text-imdb-yellow">★</span> {imdbRating.toFixed(1)}
                    {details?.imdbVotes ? (
                      <span className="ml-1.5 text-xs font-normal text-imdb-muted">
                        {Intl.NumberFormat("en", { notation: "compact" }).format(details.imdbVotes)}
                      </span>
                    ) : null}
                  </span>
                </Stat>
              ) : null}

              {typeof details?.metascore === "number" ? (
                <Stat label="Metascore">
                  <span
                    className="inline-block rounded px-2 py-0.5 text-sm font-bold text-black"
                    style={{ backgroundColor: metascoreColor(details.metascore) }}
                  >
                    {details.metascore}
                  </span>
                </Stat>
              ) : null}

              {details?.ratings
                .filter((rating) => rating.source === "Rotten Tomatoes")
                .map((rating) => (
                  <Stat key={rating.source} label="Rotten Tomatoes">
                    <span className="text-base font-bold">{rating.value}</span>
                  </Stat>
                ))}

              {details?.tmdbRating ? (
                <Stat label="TMDB">
                  <span className="text-base font-bold">{details.tmdbRating.toFixed(1)}</span>
                </Stat>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSpinAgain}
            className="rounded bg-imdb-yellow px-4 py-2 text-sm font-bold text-black hover:bg-imdb-yellow-dim"
          >
            Spin again
          </button>
          <a
            href={details?.id ? titleUrl(details.id) : item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded border border-imdb-line px-4 py-2 text-sm font-semibold hover:border-imdb-yellow hover:text-imdb-yellow"
          >
            Open on IMDb
          </a>
          {details?.trailerUrl ? (
            <a
              href={details.trailerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded border border-imdb-line px-4 py-2 text-sm font-semibold hover:border-imdb-yellow hover:text-imdb-yellow"
            >
              Watch trailer
            </a>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-imdb-muted">Loading details…</p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded border border-imdb-red/40 bg-imdb-red/10 px-3 py-2 text-sm text-imdb-red">
            {error}
          </p>
        ) : null}

        {details ? (
          <div className="mt-6 space-y-6">
            {details.tagline ? (
              <p className="text-sm italic text-imdb-muted">&ldquo;{details.tagline}&rdquo;</p>
            ) : null}

            {details.plot ? (
              <div>
                <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-imdb-muted">
                  Plot
                </h3>
                <p className="text-sm leading-relaxed">{details.plot}</p>
              </div>
            ) : null}

            {details.directors.length || details.writers.length ? (
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {details.directors.length ? (
                  <p>
                    <span className="text-imdb-muted">Director</span>{" "}
                    <span className="font-semibold">{details.directors.join(", ")}</span>
                  </p>
                ) : null}
                {details.writers.length ? (
                  <p>
                    <span className="text-imdb-muted">Writers</span>{" "}
                    <span className="font-semibold">{details.writers.join(", ")}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-imdb-muted">
                Where to watch{" "}
                <select
                  value={region}
                  onChange={(event) => onRegionChange(event.target.value)}
                  aria-label="Streaming region"
                  className="ml-1 rounded border border-imdb-line bg-imdb-panel-2 px-1.5 py-0.5 text-xs font-normal normal-case tracking-normal text-imdb-text"
                >
                  {REGIONS.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </h3>

              {hasProviders && watch ? (
                <div className="space-y-2">
                  <ProviderRow label="Stream" providers={watch.stream} />
                  <ProviderRow label="Free" providers={watch.free} />
                  <ProviderRow label="Rent" providers={watch.rent} />
                  <ProviderRow label="Buy" providers={watch.buy} />
                  {watch.link ? (
                    <a
                      href={watch.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-block text-xs text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
                    >
                      All options on JustWatch
                    </a>
                  ) : null}
                  <p className="text-xs text-imdb-muted">
                    Availability via JustWatch, through TMDB.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-imdb-muted">
                  {details.sources.tmdb
                    ? "No streaming options listed for this region."
                    : "Streaming availability needs a TMDB key."}
                </p>
              )}
            </div>

            {details.cast.length ? (
              <div>
                <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-imdb-muted">
                  Cast
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {details.cast.map((person) => (
                    <li key={`${person.name}-${person.tmdbId ?? ""}`} className="flex items-center gap-2.5">
                      {person.profileUrl ? (
                        <img
                          src={person.profileUrl}
                          alt=""
                          loading="lazy"
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-imdb-panel-2 text-xs text-imdb-muted">
                          {person.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{person.name}</span>
                        {person.character ? (
                          <span className="block truncate text-xs text-imdb-muted">
                            {person.character}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-imdb-muted">
                What people say
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewColumn
                  title="What people liked"
                  subtitle="rated 7+"
                  reviews={details.positiveReviews}
                  tone="good"
                  emptyHint={
                    details.sources.tmdb
                      ? "No positive scored reviews yet."
                      : "Reviews need a TMDB key."
                  }
                />
                <ReviewColumn
                  title="What people didn't"
                  subtitle="rated 5 or below"
                  reviews={details.negativeReviews}
                  tone="bad"
                  emptyHint={
                    details.sources.tmdb
                      ? "No negative scored reviews yet."
                      : "Reviews need a TMDB key."
                  }
                />
              </div>

              {details.neutralReviews.length ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-imdb-muted hover:text-imdb-yellow">
                    {details.neutralReviews.length} more review
                    {details.neutralReviews.length === 1 ? "" : "s"} without a clear verdict
                  </summary>
                  <div className="mt-2.5 space-y-2.5">
                    {details.neutralReviews.map((review, index) => (
                      <ReviewCard
                        key={review.url ?? `neutral-${index}`}
                        review={review}
                        tone="mixed"
                      />
                    ))}
                  </div>
                </details>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a
                  href={`https://www.imdb.com/title/${details.id}/reviews/?sort=helpfulness_score&dir=desc&ratingFilter=10`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
                >
                  10-star IMDb reviews
                </a>
                <a
                  href={`https://www.imdb.com/title/${details.id}/reviews/?sort=helpfulness_score&dir=desc&ratingFilter=1`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-imdb-muted hover:text-imdb-yellow underline underline-offset-2"
                >
                  1-star IMDb reviews
                </a>
              </div>
            </div>

            {details.awards ? (
              <p className="text-sm">
                <span className="text-imdb-muted">Awards</span> {details.awards}
              </p>
            ) : null}

            {details.notes.length ? (
              <ul className="space-y-1 border-t border-imdb-line pt-3 text-xs text-imdb-muted">
                {details.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
