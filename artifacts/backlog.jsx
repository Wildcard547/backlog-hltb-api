import React, { useState, useEffect, useRef, useCallback } from "react";

// ---- Storage (persists across sessions; degrades gracefully) ----
const GAMES_KEY = "backlog:games:v4";
const ENDPOINT_KEY = "backlog:endpoint:v1";

async function storeGet(key) {
  try { const r = await window.storage.get(key); return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; }
}
async function storeSet(key, val) { try { await window.storage.set(key, JSON.stringify(val)); } catch (e) {} }

// ---- Lookup against YOUR deployed endpoint (HowLongToBeat under the hood) ----
async function fetchPlaytime(endpoint, name) {
  if (!endpoint) throw new Error("no endpoint set");
  const url = endpoint.replace(/\/$/, "") + (endpoint.includes("?") ? "&" : "?") + "game=" + encodeURIComponent(name);
  let res;
  try { res = await fetch(url); }
  catch (e) { throw new Error("can't reach endpoint"); }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { found, name, hours, imageUrl, ... }
}

const STATUSES = ["Backlog", "Playing", "Done"];

export default function App() {
  const [games, setGames] = useState([]);
  const [input, setInput] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("added");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef(null);

  useEffect(() => {
    Promise.all([storeGet(GAMES_KEY), storeGet(ENDPOINT_KEY)]).then(([g, ep]) => {
      setGames(g || []);
      setEndpoint(ep || "");
      if (!ep) setShowSettings(true);
      setHydrated(true);
    });
  }, []);
  useEffect(() => { if (hydrated) storeSet(GAMES_KEY, games); }, [games, hydrated]);
  useEffect(() => { if (hydrated) storeSet(ENDPOINT_KEY, endpoint); }, [endpoint, hydrated]);
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);

  const runLookup = useCallback(async (id, name, ep) => {
    try {
      const d = await fetchPlaytime(ep, name);
      setGames((p) => p.map((g) => g.id === id ? {
        ...g, loading: false, err: d.found ? null : "no HLTB time yet — tap to enter",
        hours: d.hours, source: "hltb",
        name: d.name || g.name, imageUrl: d.imageUrl || null,
      } : g));
    } catch (e) {
      setGames((p) => p.map((g) => g.id === id ? { ...g, loading: false, err: e.message || "lookup failed" } : g));
    }
  }, []);

  const addGame = () => {
    const name = input.trim(); if (!name) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const willLookup = !!endpoint;
    setGames((p) => [{ id, name, hours: null, imageUrl: null, source: null, err: null, status: "Backlog", addedAt: Date.now(), loading: willLookup }, ...p]);
    setInput("");
    if (willLookup) runLookup(id, name, endpoint);
  };

  const refetch = (g) => {
    if (!endpoint) { setShowSettings(true); return; }
    setGames((p) => p.map((x) => x.id === g.id ? { ...x, loading: true, err: null } : x));
    runLookup(g.id, g.name, endpoint);
  };

  const commitEdit = (id) => {
    const v = parseFloat(draft);
    setGames((p) => p.map((g) => g.id === id ? { ...g, hours: isNaN(v) ? g.hours : v, source: "manual", err: null, loading: false } : g));
    setEditingId(null); setDraft("");
  };
  const startEdit = (g) => { if (g.loading) return; setEditingId(g.id); setDraft(g.hours != null ? String(g.hours) : ""); };
  const remove = (id) => setGames((p) => p.filter((g) => g.id !== id));
  const cycleStatus = (id) => setGames((p) => p.map((g) =>
    g.id === id ? { ...g, status: STATUSES[(STATUSES.indexOf(g.status) + 1) % STATUSES.length] } : g));

  const visible = games
    .filter((g) => filter === "All" || g.status === filter)
    .sort((a, b) => sortBy === "hours" ? (a.hours ?? Infinity) - (b.hours ?? Infinity) : b.addedAt - a.addedAt);
  const backlogHours = games.filter((g) => g.status !== "Done" && typeof g.hours === "number").reduce((s, g) => s + g.hours, 0);

  const initials = (n) => n.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .root { min-height:100vh; background: radial-gradient(120% 80% at 80% -10%, rgba(217,165,102,0.10), transparent 60%), #100e0b; color:#e9e2d4; font-family:'DM Mono',monospace; padding:28px 18px 80px; }
        .wrap { max-width:660px; margin:0 auto; }
        .head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:12px; }
        .title { font-family:'Fraunces',serif; font-weight:900; font-size:40px; line-height:0.95; letter-spacing:-0.02em; }
        .title em { color:#d9a566; font-style:italic; }
        .stat { text-align:right; }
        .stat .big { font-family:'Fraunces',serif; font-weight:600; font-size:26px; color:#d9a566; }
        .stat .lbl { font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.55; }
        .gear { background:none; border:1px solid #2f2a22; color:#9b9282; border-radius:8px; padding:4px 9px; font-family:'DM Mono',monospace; font-size:11px; cursor:pointer; margin-bottom:14px; }
        .gear:hover { border-color:#4a4234; color:#cfc6b4; }
        .settings { background:#191612; border:1px solid #261f18; border-radius:12px; padding:14px 16px; margin-bottom:16px; }
        .settings label { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.55; display:block; margin-bottom:7px; }
        .settings input { width:100%; background:#1b1814; border:1px solid #2f2a22; color:#e9e2d4; font-family:'DM Mono',monospace; font-size:12px; padding:10px 12px; border-radius:8px; outline:none; }
        .settings input:focus { border-color:#d9a566; }
        .settings .hint { font-size:10px; opacity:0.45; margin-top:8px; line-height:1.5; }
        .addbar { display:flex; gap:8px; margin-bottom:18px; }
        .addbar input { flex:1; background:#1b1814; border:1px solid #2f2a22; color:#e9e2d4; font-family:'DM Mono',monospace; font-size:14px; padding:13px 14px; border-radius:10px; outline:none; transition:border-color .2s; }
        .addbar input:focus { border-color:#d9a566; }
        .addbar input::placeholder { color:#6b6356; }
        .addbar button { background:#d9a566; color:#1a150d; border:none; font-family:'DM Mono',monospace; font-weight:500; font-size:14px; padding:0 20px; border-radius:10px; cursor:pointer; transition:transform .12s, background .2s; }
        .addbar button:hover { background:#e8b87b; } .addbar button:active { transform:scale(0.96); }
        .controls { display:flex; gap:16px; align-items:center; margin-bottom:18px; font-size:11px; }
        .grp { display:flex; gap:4px; } .sep { flex:1; } .sortlbl { opacity:0.4; letter-spacing:0.1em; }
        .chip { background:transparent; border:1px solid #2f2a22; color:#9b9282; cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; padding:5px 11px; border-radius:999px; transition:all .15s; }
        .chip:hover { border-color:#4a4234; color:#cfc6b4; } .chip.on { background:#d9a566; border-color:#d9a566; color:#1a150d; }
        .list { display:flex; flex-direction:column; gap:9px; }
        .card { display:flex; align-items:center; gap:13px; background:#191612; border:1px solid #261f18; border-radius:12px; padding:11px 14px 11px 11px; animation:rise .35s ease both; }
        @keyframes rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .art { width:44px; height:60px; border-radius:6px; flex-shrink:0; object-fit:cover; background:#241f17; border:1px solid #2f2a22; }
        .artph { width:44px; height:60px; border-radius:6px; flex-shrink:0; background:linear-gradient(135deg,#241f17,#1b1814); border:1px solid #2f2a22; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',serif; font-weight:900; font-size:15px; color:#5a5247; }
        .main { flex:1; min-width:0; }
        .gname { font-family:'Fraunces',serif; font-size:18px; font-weight:600; letter-spacing:-0.01em; line-height:1.15; }
        .meta { display:flex; align-items:center; gap:8px; margin-top:5px; font-size:10px; flex-wrap:wrap; }
        .stbadge { cursor:pointer; padding:3px 8px; border-radius:6px; letter-spacing:0.06em; text-transform:uppercase; user-select:none; }
        .st-Backlog { background:#2a2218; color:#d9a566; } .st-Playing { background:#1d2a2a; color:#7fd1c4; } .st-Done { background:#22221d; color:#7a7363; }
        .src { opacity:0.45; letter-spacing:0.05em; }
        .errmsg { color:#c0604a; opacity:0.85; cursor:pointer; }
        .time { text-align:right; min-width:60px; cursor:pointer; }
        .time .num { font-family:'Fraunces',serif; font-size:28px; font-weight:900; color:#e9e2d4; line-height:1; }
        .time .unit { font-size:10px; letter-spacing:0.15em; opacity:0.5; text-transform:uppercase; }
        .time.set .num { font-size:13px; font-family:'DM Mono',monospace; color:#d9a566; font-weight:500; }
        .time:hover .num { color:#d9a566; }
        .editwrap { display:flex; align-items:baseline; gap:4px; justify-content:flex-end; }
        .editwrap input { width:50px; background:#241f17; border:1px solid #d9a566; color:#e9e2d4; font-family:'Fraunces',serif; font-weight:900; font-size:22px; text-align:right; border-radius:6px; padding:2px 4px; outline:none; }
        .editwrap span { font-size:10px; letter-spacing:0.15em; opacity:0.5; text-transform:uppercase; }
        .spinner { width:16px; height:16px; border:2px solid #3a3328; border-top-color:#d9a566; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .del { background:none; border:none; color:#5a5247; cursor:pointer; font-size:18px; line-height:1; padding:4px; transition:color .15s; } .del:hover { color:#c0604a; }
        .empty { text-align:center; padding:54px 20px; }
        .empty .e1 { font-family:'Fraunces',serif; font-size:22px; color:#6b6356; font-style:italic; }
        .empty .e2 { font-size:12px; opacity:0.4; margin-top:8px; }
        .foot { text-align:center; font-size:10px; opacity:0.3; margin-top:30px; letter-spacing:0.08em; }
      `}</style>

      <div className="wrap">
        <div className="head">
          <div className="title">The <em>Backlog</em></div>
          <div className="stat"><div className="big">{Math.round(backlogHours)}h</div><div className="lbl">left to play</div></div>
        </div>

        <button className="gear" onClick={() => setShowSettings((s) => !s)}>
          {endpoint ? "⚙ endpoint connected" : "⚙ set lookup endpoint"}
        </button>

        {showSettings && (
          <div className="settings">
            <label>HowLongToBeat lookup endpoint</label>
            <input
              value={endpoint}
              placeholder="https://your-app.vercel.app/api/playtime"
              onChange={(e) => setEndpoint(e.target.value.trim())}
            />
            <div className="hint">Paste the URL of your deployed function. Leave blank to add games manually (tap a number to type hours).</div>
          </div>
        )}

        <div className="addbar">
          <input value={input} placeholder="Add a game…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGame()} />
          <button onClick={addGame}>Add</button>
        </div>

        <div className="controls">
          <div className="grp">{["All", ...STATUSES].map((f) => (
            <button key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{f}</button>))}</div>
          <div className="sep" /><span className="sortlbl">sort</span>
          <div className="grp">
            <button className={"chip" + (sortBy === "added" ? " on" : "")} onClick={() => setSortBy("added")}>recent</button>
            <button className={"chip" + (sortBy === "hours" ? " on" : "")} onClick={() => setSortBy("hours")}>shortest</button>
          </div>
        </div>

        <div className="list">
          {visible.map((g) => (
            <div className="card" key={g.id}>
              {g.imageUrl
                ? <img className="art" src={g.imageUrl} alt="" onError={(e) => { e.target.outerHTML = '<div class="artph">' + initials(g.name) + '</div>'; }} />
                : <div className="artph">{initials(g.name)}</div>}

              <div className="main">
                <div className="gname">{g.name}</div>
                <div className="meta">
                  <span className={"stbadge st-" + g.status} onClick={() => cycleStatus(g.id)} title="Tap to change status">{g.status}</span>
                  {g.source === "hltb" && <span className="src">HLTB</span>}
                  {g.source === "manual" && <span className="src">manual</span>}
                  {g.err && !g.loading && g.hours == null && <span className="errmsg" onClick={() => refetch(g)}>{g.err}</span>}
                </div>
              </div>

              {g.loading ? (
                <div className="spinner" />
              ) : editingId === g.id ? (
                <div className="editwrap">
                  <input ref={editRef} type="number" value={draft} placeholder="0"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitEdit(g.id)}
                    onKeyDown={(e) => e.key === "Enter" && commitEdit(g.id)} />
                  <span>hrs</span>
                </div>
              ) : g.hours != null ? (
                <div className="time" onClick={() => startEdit(g)} title="Tap to edit">
                  <span className="num">{g.hours}</span><div className="unit">hours</div>
                </div>
              ) : (
                <div className="time set" onClick={() => startEdit(g)}><span className="num">+ set hrs</span></div>
              )}

              <button className="del" onClick={() => remove(g.id)} title="Remove">×</button>
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="empty">
            <div className="e1">Nothing queued.</div>
            <div className="e2">Add a game. With your endpoint set, hours and box art fill in from HowLongToBeat.</div>
          </div>
        )}

        <div className="foot">MAIN STORY HOURS · HOWLONGTOBEAT · TAP A NUMBER TO EDIT</div>
      </div>
    </div>
  );
}
