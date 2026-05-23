# Backlog HLTB lookup — deploy guide

A tiny serverless endpoint that returns a game's **main-story hours** and **box art**
from HowLongToBeat, with CORS enabled so the browser app can read it. Nothing runs
on your machine once deployed.

## What's in here

```
backlog-api/
├── api/
│   └── playtime.js        ← the serverless function
├── src/
│   ├── main.jsx           ← Vite entry point (window.storage polyfill)
│   └── App.jsx            ← the React front-end (built by Vite)
├── artifacts/
│   └── backlog.jsx        ← original Claude Artifact version (reference only)
├── index.html             ← Vite HTML shell
├── vite.config.js         ← Vite + React config with /api proxy for local dev
└── package.json           ← dependencies + build scripts
```

The front-end is built by Vite and served as static files. The API runs as a
Vercel serverless function. The `artifacts/backlog.jsx` is the original Claude
Artifact version kept for reference — it is not deployed.

## Deploy to Vercel (free, ~3 minutes)

1. **Push this repo** to GitHub (keep the folder layout as-is).

2. **Sign in to vercel.com** with your GitHub account (free Hobby plan).

3. **New Project → Import** your repo → **Deploy**. Vercel auto-detects Vite,
   runs `npm install` and `npm run build`, and gives you a URL like
   `https://your-app.vercel.app`. No build settings to change, no env vars needed.

4. **Your endpoint** is that URL plus `/api/playtime`, e.g.
   `https://your-app.vercel.app/api/playtime`
   Test it in a browser:
   `https://your-app.vercel.app/api/playtime?game=Hades`
   You should get JSON back with `hours` and `imageUrl`.

5. **Use the app:** visit `https://your-app.vercel.app` to open the front-end.
   Tap **⚙ set lookup endpoint** and paste the `/api/playtime` URL (e.g.
   `https://your-app.vercel.app/api/playtime`). From now on every game you add
   fills in hours and box art automatically.

## Notes

- **Response shape:** `{ found, name, hours, mainExtra, completionist, imageUrl, similarity, hltbId }`.
  The app uses `hours` (main story) and `imageUrl`.
- **Caching:** results are cached at Vercel's edge for a day to stay light on HLTB.
- **Fragility:** `howlongtobeat-ts` is an unofficial scraper. If HLTB changes their site
  it can break until the maintainer pushes a fix — then you just bump the version in
  `package.json` and redeploy. For a personal tool this is a low risk.
- **Alternative hosts:** the same `api/playtime.js` works on Netlify Functions or any
  Node serverless host with minor path tweaks. Vercel is the least-fuss option.
- Be a good citizen: HowLongToBeat runs on community data — consider supporting them.
