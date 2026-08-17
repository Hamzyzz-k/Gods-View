
// ---------- Spaceflight News ticker ----------
export const NEWS_CACHE_KEY = "solar-system-news-cache-v1";
export const NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // news moves fast — refresh every 30 min
export const newsTickerTrack = document.getElementById("newsTickerTrack");

export function readNewsCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const { timestamp, articles } = JSON.parse(raw);
    if (Date.now() - timestamp > NEWS_CACHE_TTL_MS) return null;
    return articles;
  } catch {
    return null;
  }
}

export function writeNewsCache(articles) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), articles }));
  } catch {
    // ignore
  }
}

export async function fetchSpaceNews() {
  const cached = readNewsCache();
  if (cached) return cached;
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=8&ordering=-published_at");
  if (!res.ok) throw new Error("Spaceflight News error " + res.status);
  const data = await res.json();
  const articles = (data.results || []).map((a) => ({ title: a.title, url: a.url, site: a.news_site }));
  writeNewsCache(articles);
  return articles;
}

// ---------- rendering ----------
// Everything below builds real DOM nodes and assigns text through
// .textContent. It deliberately never concatenates API values into an HTML
// string.
//
// This matters because titles, URLs and site names all come from a
// third-party API nobody here controls. Interpolating them into innerHTML —
// which is what this module used to do — means a title containing something
// like `<img src=x onerror="...">` executes as script on the page. Once
// accounts exist, a script running here can read the session token out of
// localStorage and impersonate that user, so this one detail undermines the
// entire login system no matter how strict the server-side rules are.
// textContent has no such failure mode: markup inside it is text, never
// markup.

const MAX_TITLE_LEN = 160; // a hostile or broken feed shouldn't be able to blow out the ticker's layout

// Only ever hand an http(s) URL to an href. Without this check a `url` of
// `javascript:...` becomes a working script trigger the moment it's clicked.
function safeHttpUrl(raw) {
  if (typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null; // not a parseable URL at all
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildItem(article) {
  const title = clean(article.title).slice(0, MAX_TITLE_LEN);
  if (!title) return null;
  const site = clean(article.site);
  const href = safeHttpUrl(article.url);

  // Anchor only when the URL survived validation; otherwise still show the
  // headline, just not as something clickable.
  const el = document.createElement(href ? "a" : "span");
  if (href) {
    el.href = href;
    el.target = "_blank";
    el.rel = "noopener noreferrer"; // noreferrer too: don't leak the app URL to the news site
  }
  el.textContent = title;

  if (site) {
    const siteEl = document.createElement("span");
    siteEl.className = "ticker-site";
    siteEl.textContent = ` — ${site}`;
    el.appendChild(siteEl);
  }
  return el;
}

function separator() {
  const sep = document.createElement("span");
  sep.className = "ticker-sep";
  sep.textContent = "•";
  return sep;
}

export async function loadNewsTicker() {
  try {
    const articles = await fetchSpaceNews();
    const items = articles.map(buildItem).filter(Boolean);
    if (!items.length) throw new Error("No articles");

    // The CSS marquee translates 0 → -50%, so the sequence is rendered twice
    // to make the loop seamless. Nodes can't be shared between two positions
    // in the DOM, hence the cloneNode on the second pass.
    const frag = document.createDocumentFragment();
    for (const pass of [0, 1]) {
      items.forEach((item) => {
        frag.appendChild(pass === 0 ? item : item.cloneNode(true));
        frag.appendChild(separator());
      });
    }

    newsTickerTrack.replaceChildren(frag);
  } catch {
    const status = document.createElement("span");
    status.id = "newsTickerStatus";
    status.textContent = "Space news unavailable right now.";
    newsTickerTrack.replaceChildren(status);
  }
}

loadNewsTicker();
