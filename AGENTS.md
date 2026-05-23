# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
This is a minimal two-file project: a Vercel serverless function (`api/playtime.js`) and a React component (`api/backlog.jsx`) designed to be used as a Claude Artifact. See `api/README.md` for deployment details.

### Dependencies
- Single npm dependency: `howlongtobeat-ts` (unofficial HLTB scraper, replaces the abandoned `howlongtobeat` package).
- No build step, no bundler, no TypeScript, no linter, no test framework configured.
- `npm install` is the only dependency command needed.

### Running the API locally
The serverless function at `api/playtime.js` exports a Vercel-style `handler(req, res)`. To test it locally without Vercel CLI, start a lightweight Node.js HTTP server:

```bash
node -e "
import { createServer } from 'http';
import { URL } from 'url';
import handler from './api/playtime.js';
const server = createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://localhost:3000');
  const query = Object.fromEntries(parsed.searchParams.entries());
  const mockReq = { method: req.method, query, headers: req.headers };
  const mockRes = {
    statusCode: 200, headers: {},
    setHeader(k, v) { this.headers[k] = v; res.setHeader(k, v); },
    status(code) { this.statusCode = code; return this; },
    json(data) { res.writeHead(this.statusCode, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data, null, 2)); },
    end() { res.writeHead(this.statusCode); res.end(); },
  };
  try { await handler(mockReq, mockRes); } catch (e) { res.writeHead(500); res.end(String(e)); }
});
server.listen(3000, () => console.log('Dev server on http://localhost:3000'));
"
```

Then test: `curl "http://localhost:3000/api/playtime?game=Hades"`

### Known caveats
- The `howlongtobeat-ts` npm library is an unofficial scraper. If HLTB changes their website/API, the library may break until the maintainer releases a fix. See `api/README.md` for context.
- `api/backlog.jsx` uses `window.storage` (Claude Artifact API), not standard `localStorage`. It will not persist data in a standard browser without a polyfill.
- No lint, test, or build scripts exist in `package.json`. Syntax checking can be done with `node --check api/playtime.js`.
