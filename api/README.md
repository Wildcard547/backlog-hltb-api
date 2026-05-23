# Backlog HLTB lookup — deploy guide

A tiny serverless endpoint that returns a game's **main-story hours** and **box art**
from HowLongToBeat, with CORS enabled so the browser app can read it. Nothing runs
on your machine once deployed.

## What's in here

```
backlog-api/
├── api/
│   └── playtime.js   ← the serverless function
└── package.json      ← declares the howlongtobeat dependency
```

The app itself is the separate `backlog.jsx` artifact in Claude — you don't deploy
that, you just paste the endpoint URL into it (see step 4).

## Deploy to Vercel (free, ~3 minutes)

1. **Make a GitHub repo** with the two files above, keeping the exact folder layout
   (`api/playtime.js` and `package.json` at the root). You can drag them into a new
   repo via github.com → "Add file" → "Upload files".

2. **Sign in to vercel.com** with your GitHub account (free Hobby plan).

3. **New Project → Import** your repo → **Deploy**. Vercel auto-detects it, runs
   `npm install` (pulls in `howlongtobeat`), and gives you a URL like
   `https://your-app.vercel.app`. No build settings to change, no env vars needed.

4. **Your endpoint** is that URL plus `/api/playtime`, e.g.
   `https://your-app.vercel.app/api/playtime`
   Test it in a browser:
   `https://your-app.vercel.app/api/playtime?game=Hades`
   You should get JSON back with `hours` and `imageUrl`.

5. **Connect the app:** open the backlog artifact, tap **⚙ set lookup endpoint**,
   paste the `/api/playtime` URL, done. From now on every game you add fills in hours
   and box art automatically. Anything HLTB has no time for (e.g. an unreleased game)
   shows "tap to enter" so you can set it by hand.

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
