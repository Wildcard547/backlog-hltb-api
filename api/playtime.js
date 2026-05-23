// Vercel serverless function: GET /api/playtime?game=<name>
// Looks up a game on HowLongToBeat (via ckatzorke/howlongtobeat) and returns
// a single main-story hours figure plus box art, with permissive CORS so the
// browser app can read it.

import { HowLongToBeatService } from "howlongtobeat";

const hltb = new HowLongToBeatService();

export default async function handler(req, res) {
  // --- CORS: allow the browser app to read this response ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Cache results at the edge for a day to be gentle on HLTB.
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
    const results = await hltb.search(game);

    if (!results || results.length === 0) {
      // No HLTB entry at all (or a brand-new/unlisted title).
      res.status(200).json({ found: false, query: game, name: game, hours: null, imageUrl: null });
      return;
    }

    // Pick the closest match by HLTB's similarity score.
    const best = results.reduce((a, b) => (b.similarity > a.similarity ? b : a));

    // Normalize the image URL (library sometimes returns a relative path).
    let img = best.imageUrl || null;
    if (img && !/^https?:\/\//.test(img)) {
      img = "https://howlongtobeat.com/" + String(img).replace(/^\/+/, "");
    }

    // gameplayMain is the main-story figure; 0 means HLTB has no time yet.
    const hours = best.gameplayMain && best.gameplayMain > 0 ? best.gameplayMain : null;

    res.status(200).json({
      found: true,
      query: game,
      name: best.name,
      hours,
      mainExtra: best.gameplayMainExtra || null,
      completionist: best.gameplayCompletionist || null,
      imageUrl: img,
      similarity: best.similarity,
      hltbId: best.id,
    });
  } catch (e) {
    res.status(500).json({ error: "lookup failed", detail: String((e && e.message) || e) });
  }
}
