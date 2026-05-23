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
  return data;
}

async function fetchSuggestions(endpoint, name) {
  if (!endpoint) return [];
  const base = endpoint.replace(/\/api\/playtime\b.*$/, "/api/search");
  const url = base + "?game=" + encodeURIComponent(name);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch (e) { return []; }
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
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsFor, setSuggestionsFor] = useState(null);
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
      if (d.found) {
        setGames((p) => p.map((g) => g.id === id ? {
          ...g, loading: false, err: null,
          hours: d.hours, source: "hltb",
          name: d.name || g.name, imageUrl: d.imageUrl || null,
        } : g));
        setSuggestions([]);
        setSuggestionsFor(null);
      } else {
        setGames((p) => p.map((g) => g.id === id ? {
          ...g, loading: false, err: "not found — check suggestions below",
        } : g));
        const sug = await fetchSuggestions(ep, name);
        if (sug.length > 0) {
          setSuggestions(sug);
          setSuggestionsFor(id);
        }
      }
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
    setSuggestions([]);
    setSuggestionsFor(null);
    if (willLookup) runLookup(id, name, endpoint);
  };

  const pickSuggestion = (sug) => {
    if (suggestionsFor) {
      setGames((p) => p.map((g) => g.id === suggestionsFor ? {
        ...g, name: sug.name, hours: sug.hours, imageUrl: sug.imageUrl,
        source: "hltb", err: null, loading: false,
      } : g));
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      setGames((p) => [{
        id, name: sug.name, hours: sug.hours, imageUrl: sug.imageUrl,
        source: "hltb", err: null, status: "Backlog", addedAt: Date.now(), loading: false,
      }, ...p]);
    }
    setSuggestions([]);
    setSuggestionsFor(null);
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
  const remove = (id) => {
    setGames((p) => p.filter((g) => g.id !== id));
    if (suggestionsFor === id) { setSuggestions([]); setSuggestionsFor(null); }
  };
  const cycleStatus = (id) => setGames((p) => p.map((g) =>
    g.id === id ? { ...g, status: STATUSES[(STATUSES.indexOf(g.status) + 1) % STATUSES.length] } : g));

  const visible = games
    .filter((g) => filter === "All" || g.status === filter)
    .sort((a, b) => sortBy === "hours" ? (a.hours ?? Infinity) - (b.hours ?? Infinity) : b.addedAt - a.addedAt);

  const initials = (n) => n.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .root { min-height:100vh; background: radial-gradient(120% 80% at 80% -10%, rgba(217,165,102,0.10), transparent 60%), #100e0b; color:#e9e2d4; font-family:'DM Mono',monospace; padding:28px 18px 80px; }
        .wrap { max-width:660px; margin:0 auto; }
        .head { margin-bottom:18px; }
        .title { font-family:'Playfair Display',serif; font-weight:900; font-size:48px; line-height:1; letter-spacing:-0.02em; background:linear-gradient(to right,#c9a96e,#f5f0e8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .gear { background:none; border:1px solid #2f2a22; color:#9b9282; border-radius:8px; padding:4px 9px; font-family:'DM Mono',monospace; font-size:11px; cursor:pointer; margin-bottom:14px; }
        .gear:hover { border-color:#4a4234; color:#cfc6b4; }
        .settings { background:#191612; border:1px solid #261f18; border-radius:12px; padding:14px 16px; margin-bottom:16px; }
        .settings label { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.55; display:block; margin-bottom:7px; }
        .settings input { width:100%; background:#1b1814; border:1px solid #2f2a22; color:#e9e2d4; font-family:'DM Mono',monospace; font-size:12px; padding:10px 12px; border-radius:8px; outline:none; }
        .settings input:focus { border-color:#d9a566; }
        .settings .hint { font-size:10px; opacity:0.45; margin-top:8px; line-height:1.5; }
        .addbar { display:flex; gap:8px; margin-bottom:18px; }
        .addbar input { flex:1; min-width:0; background:#1b1814; border:1px solid #2f2a22; color:#e9e2d4; font-family:'DM Mono',monospace; font-size:14px; padding:13px 14px; border-radius:10px; outline:none; transition:border-color .2s; }
        .addbar input:focus { border-color:#d9a566; }
        .addbar input::placeholder { color:#6b6356; }
        .addbar button { background:#d9a566; color:#1a150d; border:none; font-family:'DM Mono',monospace; font-weight:500; font-size:14px; padding:0 20px; border-radius:10px; cursor:pointer; flex-shrink:0; transition:transform .12s, background .2s; }
        .addbar button:hover { background:#e8b87b; } .addbar button:active { transform:scale(0.96); }
        .controls { display:flex; gap:8px; align-items:center; margin-bottom:18px; font-size:11px; flex-wrap:wrap; }
        .grp { display:flex; gap:4px; flex-wrap:wrap; } .sep { flex:1; min-width:8px; } .sortlbl { opacity:0.4; letter-spacing:0.1em; }
        .chip { background:transparent; border:1px solid #2f2a22; color:#9b9282; cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; padding:5px 11px; border-radius:999px; white-space:nowrap; transition:all .15s; }
        .chip:hover { border-color:#4a4234; color:#cfc6b4; } .chip.on { background:#d9a566; border-color:#d9a566; color:#1a150d; }

        .suggestions { background:#191612; border:1px solid #261f18; border-radius:12px; padding:14px 16px; margin-bottom:18px; animation:rise .35s ease both; }
        .suggestions .sug-title { font-family:'Fraunces',serif; font-size:16px; font-weight:600; color:#d9a566; margin-bottom:12px; }
        .sug-list { display:flex; flex-direction:column; gap:8px; }
        .sug-item { display:flex; align-items:center; gap:12px; background:#1b1814; border:1px solid #2f2a22; border-radius:10px; padding:10px 12px; cursor:pointer; transition:border-color .15s, background .15s; }
        .sug-item:hover { border-color:#d9a566; background:#211d16; }
        .sug-art { width:36px; height:50px; border-radius:5px; flex-shrink:0; object-fit:cover; background:#241f17; border:1px solid #2f2a22; }
        .sug-artph { width:36px; height:50px; border-radius:5px; flex-shrink:0; background:linear-gradient(135deg,#241f17,#1b1814); border:1px solid #2f2a22; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',serif; font-weight:900; font-size:12px; color:#5a5247; }
        .sug-info { flex:1; min-width:0; }
        .sug-name { font-family:'Fraunces',serif; font-size:15px; font-weight:600; line-height:1.2; overflow:hidden; text-overflow:ellipsis; }
        .sug-hours { font-size:11px; opacity:0.55; margin-top:3px; }
        .sug-dismiss { background:none; border:none; color:#5a5247; cursor:pointer; font-size:12px; font-family:'DM Mono',monospace; padding:4px 8px; border-radius:6px; transition:color .15s; }
        .sug-dismiss:hover { color:#c0604a; }

        .list { display:flex; flex-direction:column; gap:9px; }
        .card { display:flex; align-items:center; gap:13px; background:#191612; border:1px solid #261f18; border-radius:12px; padding:11px 14px 11px 11px; animation:rise .35s ease both; }
        @keyframes rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .art { width:44px; height:60px; border-radius:6px; flex-shrink:0; object-fit:cover; background:#241f17; border:1px solid #2f2a22; }
        .artph { width:44px; height:60px; border-radius:6px; flex-shrink:0; background:linear-gradient(135deg,#241f17,#1b1814); border:1px solid #2f2a22; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',serif; font-weight:900; font-size:15px; color:#5a5247; }
        .main { flex:1; min-width:0; }
        .gname { font-family:'Fraunces',serif; font-size:18px; font-weight:600; letter-spacing:-0.01em; line-height:1.15; overflow:hidden; text-overflow:ellipsis; }
        .meta { display:flex; align-items:center; gap:8px; margin-top:5px; font-size:10px; flex-wrap:wrap; }
        .stbadge { cursor:pointer; padding:3px 8px; border-radius:6px; letter-spacing:0.06em; text-transform:uppercase; user-select:none; }
        .st-Backlog { background:#2a2218; color:#d9a566; } .st-Playing { background:#1d2a2a; color:#7fd1c4; } .st-Done { background:#22221d; color:#7a7363; }
        .src { opacity:0.45; letter-spacing:0.05em; }
        .errmsg { color:#c0604a; opacity:0.85; cursor:pointer; }
        .time { text-align:right; min-width:50px; cursor:pointer; flex-shrink:0; }
        .time .num { font-family:'Fraunces',serif; font-size:28px; font-weight:900; color:#e9e2d4; line-height:1; }
        .time .unit { font-size:10px; letter-spacing:0.15em; opacity:0.5; text-transform:uppercase; }
        .time.set .num { font-size:13px; font-family:'DM Mono',monospace; color:#d9a566; font-weight:500; }
        .time:hover .num { color:#d9a566; }
        .editwrap { display:flex; align-items:baseline; gap:4px; justify-content:flex-end; }
        .editwrap input { width:50px; background:#241f17; border:1px solid #d9a566; color:#e9e2d4; font-family:'Fraunces',serif; font-weight:900; font-size:22px; text-align:right; border-radius:6px; padding:2px 4px; outline:none; }
        .editwrap span { font-size:10px; letter-spacing:0.15em; opacity:0.5; text-transform:uppercase; }
        .spinner { width:16px; height:16px; border:2px solid #3a3328; border-top-color:#d9a566; border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .del { background:none; border:none; color:#5a5247; cursor:pointer; font-size:18px; line-height:1; padding:4px; flex-shrink:0; transition:color .15s; } .del:hover { color:#c0604a; }
        .empty { text-align:center; padding:54px 20px; }
        .empty .e1 { font-family:'Fraunces',serif; font-size:22px; color:#6b6356; font-style:italic; }
        .empty .e2 { font-size:12px; opacity:0.4; margin-top:8px; }
        .foot { text-align:center; font-size:10px; opacity:0.3; margin-top:30px; letter-spacing:0.08em; }

        @media (max-width:480px) {
          .root { padding:20px 12px 60px; }
          .title { font-size:36px; }
          .controls { gap:6px; }
          .chip { padding:5px 9px; font-size:10px; }
          .card { gap:10px; padding:10px 10px 10px 8px; }
          .gname { font-size:16px; }
          .time .num { font-size:22px; }
          .art, .artph { width:38px; height:52px; }
          .addbar button { padding:0 14px; }
        }
      `}</style>

      <div className="wrap">
        <div className="head">
          <div className="title">The Backlog</div>
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

        {suggestions.length > 0 && (
          <div className="suggestions">
            <div className="sug-title">Did you mean…?</div>
            <div className="sug-list">
              {suggestions.map((s, i) => (
                <div className="sug-item" key={s.hltbId || i} onClick={() => pickSuggestion(s)}>
                  {s.imageUrl
                    ? <img className="sug-art" src={s.imageUrl} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                    : <div className="sug-artph">{initials(s.name)}</div>}
                  <div className="sug-info">
                    <div className="sug-name">{s.name}</div>
                    <div className="sug-hours">{s.hours != null ? s.hours + "h main story" : "no time data"}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="sug-dismiss" onClick={() => { setSuggestions([]); setSuggestionsFor(null); }}>✕ dismiss</button>
          </div>
        )}

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
