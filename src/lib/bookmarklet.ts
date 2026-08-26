/**
 * Runs inside an IMDb watchlist page, where the list is actually rendered.
 * Server-side fetches only ever see a shell, so collecting from the live DOM
 * is the one approach that does not depend on IMDb serving data to a robot.
 *
 * Kept deliberately defensive: IMDb's class names change, so this walks from
 * every /title/ link up to its row and reads whatever text is there.
 */
const SOURCE = `
(async () => {
  if (!/(^|\\.)imdb\\.com$/.test(location.hostname)) {
    alert("Open your IMDb watchlist first, then click this again.");
    return;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Load the whole list: the watchlist pages in chunks as you scroll.
  let previous = 0;
  for (let pass = 0; pass < 60; pass += 1) {
    const more = [...document.querySelectorAll("button, span.ipc-see-more__text")]
      .find((el) => /\\d+\\s+more|see more/i.test(el.textContent || ""));
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

    const row = link.closest("li, .ipc-metadata-list-summary-item, article") || link.parentElement;

    // Join the text nodes with spaces rather than using textContent: IMDb runs
    // fields together ("Redemption1994", "2008TV Series"), which defeats every
    // word-boundary match and reads "1994" + "2h" as a 19942-hour runtime.
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

    const ratingEl = row && row.querySelector('[class*="rating-star--rating"], [data-testid*="rating"]');
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

  const items = [...rows.values()];
  if (!items.length) {
    alert("No titles found on this page. Make sure you are on your watchlist and it has loaded.");
    return;
  }

  const payload = JSON.stringify({ items }, null, 0);
  try {
    await navigator.clipboard.writeText(payload);
    alert(items.length + " titles copied. Paste them into Spin the Wheel.");
  } catch (e) {
    const box = document.createElement("textarea");
    box.value = payload;
    box.style.cssText = "position:fixed;inset:5%;z-index:99999;width:90%;height:90%";
    document.body.appendChild(box);
    box.select();
    alert(items.length + " titles found. Copy the text in the box, then close it.");
  }
})();
`;

/** The raw script, exported so tests can run exactly what ships. */
export const BOOKMARKLET_SOURCE = SOURCE;

/** The bookmarklet as a single javascript: URL, ready to save as a bookmark. */
export const BOOKMARKLET_HREF = `javascript:${encodeURIComponent(
  SOURCE.replace(/\n\s*/g, " ").trim(),
)}`;
