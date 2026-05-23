// Vercel serverless function: GET /api/search?game=<name>
// Returns an array of HLTB candidate matches for "Did You Mean?" suggestions.
// Tries progressively looser queries if the full query returns no results.

import { HowLongToBeatService } from "howlongtobeat-ts";

const hltb = new HowLongToBeatService();

const toHours = (s) => (s && s > 0 ? Math.round((s / 3600) * 10) / 10 : null);

function normalizeImage(url) {
  if (!url) return null;
  if (!/^https?:\/\//.test(url)) {
    return "https://howlongtobeat.com/" + String(url).replace(/^\/+/, "");
  }
  return url;
}

function formatResult(r) {
  return {
    name: r.name,
    hours: toHours(r.mainTime),
    mainExtra: toHours(r.mainExtraTime),
    completionist: toHours(r.completionistTime),
    imageUrl: normalizeImage(r.imageUrl),
    similarity: r.similarity,
    hltbId: r.id,
  };
}

async function searchHLTB(query) {
  const response = await hltb.search(query);
  return (response && response.data) || [];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const game = (req.query.game || "").toString().trim();
  if (!game) {
    res.status(400).json({ error: "missing 'game' query parameter" });
    return;
  }

  try {
    let results = await searchHLTB(game);

    // If no results, try looser queries: first word, first two words, etc.
    if (results.length === 0) {
      const words = game.split(/\s+/).filter(Boolean);
      for (let len = Math.min(words.length - 1, 2); len >= 1 && results.length === 0; len--) {
        results = await searchHLTB(words.slice(0, len).join(" "));
      }
    }

    const suggestions = results.slice(0, 5).map(formatResult);
    res.status(200).json({ query: game, suggestions });
  } catch (e) {
    res.status(500).json({ error: "search failed", detail: String((e && e.message) || e) });
  }
}
