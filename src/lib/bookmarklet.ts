/**
 * Runs inside an IMDb watchlist page, where the list is actually rendered.
 * Server-side fetches only ever see a shell, so collecting from the live DOM
 * is the one approach that does not depend on IMDb serving data to a robot.
 *
 * Two hard-won constraints on this string:
 *
 *  - No `//` line comments. The bookmarklet is one URL, and any tooling that
 *    flattens it would turn the rest of the script into a comment. Block
 *    comments only.
 *  - Output goes to an on-page panel, not `alert()` plus a clipboard write.
 *    The scroll loop runs for seconds, which spends the click's transient user
 *    activation, and `navigator.clipboard.writeText` needs it — so the copy has
 *    to be driven by a fresh click on a button in the panel.
 */
const SOURCE = `
(async () => {
  const PANEL = "spinwheel-import-panel";

  const show = (title, body, textarea) => {
    const old = document.getElementById(PANEL);
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = PANEL;
    box.style.cssText =
      "position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
      "width:min(560px,92vw);background:#1f1f1f;color:#fff;border:2px solid #f5c518;" +
      "border-radius:12px;padding:16px;font:14px/1.5 Roboto,Arial,sans-serif;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.6)";

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-weight:700;font-size:16px;margin-bottom:8px;color:#f5c518";
    box.appendChild(h);

    const p = document.createElement("div");
    p.textContent = body;
    p.style.cssText = "margin-bottom:12px";
    box.appendChild(p);

    let area = null;
    if (textarea) {
      area = document.createElement("textarea");
      area.value = textarea;
      area.readOnly = true;
      area.style.cssText =
        "width:100%;height:120px;background:#111;color:#ccc;border:1px solid #444;" +
        "border-radius:6px;padding:8px;font:12px monospace;margin-bottom:12px";
      box.appendChild(area);
    }

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px";

    if (area) {
      const copy = document.createElement("button");
      copy.textContent = "Copy";
      copy.style.cssText =
        "background:#f5c518;color:#000;border:0;border-radius:6px;padding:8px 16px;" +
        "font-weight:700;cursor:pointer";
      copy.addEventListener("click", async () => {
        area.select();
        try {
          await navigator.clipboard.writeText(area.value);
          copy.textContent = "Copied!";
        } catch (e) {
          try {
            document.execCommand("copy");
            copy.textContent = "Copied!";
          } catch (e2) {
            copy.textContent = "Press Ctrl/Cmd+C";
          }
        }
      });
      row.appendChild(copy);
    }

    const close = document.createElement("button");
    close.textContent = "Close";
    close.style.cssText =
      "background:transparent;color:#fff;border:1px solid #444;border-radius:6px;" +
      "padding:8px 16px;cursor:pointer";
    close.addEventListener("click", () => box.remove());
    row.appendChild(close);

    box.appendChild(row);
    document.body.appendChild(box);
    if (area) area.select();
    return box;
  };

  try {
    if (!/(^|\\.)imdb\\.com$/.test(location.hostname)) {
      show("Wrong page", "Open your IMDb watchlist, then click the bookmark there.", null);
      return;
    }

    const working = show("Reading your watchlist…", "Scrolling to load every title.", null);

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let previous = 0;
    for (let pass = 0; pass < 60; pass += 1) {
      const more = [...document.querySelectorAll("button, span.ipc-see-more__text")].find(
        (el) => /\\d+\\s+more|see more/i.test(el.textContent || ""),
      );
      if (more) more.click();
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(600);
      const count = document.querySelectorAll('a[href*="/title/tt"]').length;
      if (count === previous && !more) break;
      previous = count;
    }

    const rows = new Map();
    for (const link of document.querySelectorAll('a[href*="/title/tt"]')) {
      const id = (link.getAttribute("href") || "").match(/tt\\d{6,10}/);
      if (!id) continue;

      const title = (link.textContent || "").replace(/^\\s*\\d+\\.\\s*/, "").trim();
      if (!title) continue;
      if (rows.has(id[0])) continue;

      const row =
        link.closest("li, .ipc-metadata-list-summary-item, article") || link.parentElement;

      /* Join the text nodes with spaces: IMDb runs its fields together
         ("Redemption1994", "2008TV Series"), which defeats word-boundary
         matching and reads "1994" + "2h" as a 19942-hour runtime. */
      let text = "";
      if (row) {
        const parts = [];
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const chunk = (walker.currentNode.textContent || "").trim();
          if (chunk) parts.push(chunk);
        }
        text = parts.join(" ");
      }

      const year = (text.match(/\\b(19|20)\\d{2}\\b/) || [null])[0];
      const runtimeHm = text.match(/\\b(\\d{1,2})h\\s*(\\d{1,2})?\\s*m?\\b/);
      const runtimeM = text.match(/\\b(\\d{1,3})m\\b/);
      const runtime = runtimeHm
        ? Number(runtimeHm[1]) * 60 + Number(runtimeHm[2] || 0)
        : runtimeM
          ? Number(runtimeM[1])
          : null;

      const ratingEl =
        row && row.querySelector('[class*="rating-star--rating"], [data-testid*="rating"]');
      const rating = ratingEl ? parseFloat(ratingEl.textContent || "") : null;

      const type = /\\bTV\\s?Mini/i.test(text)
        ? "tvMiniSeries"
        : /\\bTV\\s?Series\\b/i.test(text)
          ? "tvSeries"
          : /\\bTV\\s?Movie\\b/i.test(text)
            ? "tvMovie"
            : /\\bVideo\\s?Game\\b/i.test(text)
              ? "videoGame"
              : "movie";

      rows.set(id[0], {
        id: id[0],
        title,
        year,
        runtime,
        rating: Number.isFinite(rating) ? rating : null,
        type,
        genres: [],
      });
    }

    if (working) working.remove();

    const items = [...rows.values()];
    if (!items.length) {
      show(
        "No titles found",
        "This page has no title links on it. Make sure you are on your watchlist and it has finished loading.",
        null,
      );
      return;
    }

    show(
      items.length + " titles ready",
      "Copy this, then paste it into Spin the Wheel.",
      JSON.stringify({ items }),
    );
  } catch (error) {
    show("Something went wrong", String((error && error.message) || error), null);
  }
})();
`;

/**
 * The bookmarklet as a single javascript: URL.
 *
 * Newlines are deliberately kept: encodeURIComponent turns them into %0A,
 * which the browser decodes back to real line breaks. Flattening them first
 * would run every line together — and any line comment would then swallow the
 * rest of the script, which is exactly how this shipped broken once.
 */
export const BOOKMARKLET_HREF = `javascript:${encodeURIComponent(SOURCE.trim())}`;
