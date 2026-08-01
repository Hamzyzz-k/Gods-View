
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

export async function loadNewsTicker() {
  try {
    const articles = await fetchSpaceNews();
    if (!articles.length) throw new Error("No articles");
    const itemsHtml = articles
      .map(
        (a) =>
          `<a href="${a.url}" target="_blank" rel="noopener">${a.title} <span style="opacity:0.5">— ${a.site}</span></a>`
      )
      .join('<span class="ticker-sep">•</span>');
    // duplicate the sequence so the CSS marquee (translateX 0 → -50%) loops seamlessly
    newsTickerTrack.innerHTML = `${itemsHtml}<span class="ticker-sep">•</span>${itemsHtml}<span class="ticker-sep">•</span>`;
  } catch {
    newsTickerTrack.innerHTML = `<span id="newsTickerStatus">Space news unavailable right now.</span>`;
  }
}

loadNewsTicker();
