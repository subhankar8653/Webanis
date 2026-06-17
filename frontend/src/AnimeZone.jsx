import { useState, useEffect, useRef } from "react";

// ─── API CONFIG — apna Railway URL yahan daalo ────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "https://your-backend.railway.app";

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const apiFetch = async (path) => {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

// Normalize home card — backend se jo bhi aaye uspe default values
const normalizeAnime = (item) => ({
  slug: item.slug || "",
  title: item.title || item.slug?.replace(/-/g, " ") || "Unknown",
  year: item.year || "—",
  lang: item.lang || "Hindi",
  quality: item.quality || "HD",
  genres: item.genres || [],
  poster: item.poster || "",
  episodes: item.episodes || "?",
  rating: item.rating || "—",
  description: item.description || "",
});

// Episode slug parser: "scum-of-the-brave-1x2" → {season:1, ep:2}
const parseEpSlug = (slug = "") => {
  const m = slug.match(/(\d+)x(\d+)$/);
  return m ? { season: parseInt(m[1]), ep: parseInt(m[2]) } : { season: 1, ep: 1 };
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #080B14;
    --bg2:      #0D1225;
    --bg3:      #111827;
    --card:     #0F172A;
    --border:   #1E2D4A;
    --violet:   #7C3AFF;
    --violet2:  #9F67FF;
    --cyan:     #00F5FF;
    --cyan2:    #00C8D4;
    --gold:     #FFB800;
    --text:     #E2E8F0;
    --muted:    #64748B;
    --danger:   #FF4757;
    --glow:     0 0 20px rgba(124,58,255,0.4);
    --glow-cyan:0 0 20px rgba(0,245,255,0.3);
  }

  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; overflow-x: hidden; }
  #root { min-height: 100vh; }

  /* SCROLLBAR */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--violet); border-radius: 3px; }

  /* NAVBAR */
  .navbar {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; height: 64px;
    background: rgba(8,11,20,0.85);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  .logo {
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.8rem; font-weight: 700; letter-spacing: 2px;
    background: linear-gradient(90deg, var(--violet), var(--cyan));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    cursor: pointer; user-select: none;
  }
  .logo span { color: var(--cyan); }
  .nav-links { display: flex; gap: 28px; list-style: none; }
  .nav-links a {
    font-size: 0.85rem; font-weight: 500; letter-spacing: 1px;
    color: var(--muted); text-decoration: none; text-transform: uppercase;
    transition: color 0.2s;
  }
  .nav-links a:hover, .nav-links a.active { color: var(--cyan); }
  .search-bar {
    display: flex; align-items: center; gap: 8px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 14px;
    transition: border-color 0.2s;
  }
  .search-bar:focus-within { border-color: var(--violet); box-shadow: var(--glow); }
  .search-bar input {
    background: none; border: none; outline: none;
    color: var(--text); font-size: 0.875rem; width: 180px;
  }
  .search-bar input::placeholder { color: var(--muted); }

  /* HERO BANNER */
  .hero {
    position: relative; height: 520px; overflow: hidden;
    display: flex; align-items: flex-end;
    padding: 48px 40px;
  }
  .hero-bg {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, #0D1B3E 0%, #1A0B2E 50%, #080B14 100%);
  }
  .hero-grid {
    position: absolute; inset: 0; opacity: 0.04;
    background-image: linear-gradient(var(--cyan) 1px, transparent 1px),
                      linear-gradient(90deg, var(--cyan) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .hero-orb {
    position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
  }
  .hero-orb-1 { width: 400px; height: 400px; background: rgba(124,58,255,0.15); top: -100px; right: 200px; }
  .hero-orb-2 { width: 300px; height: 300px; background: rgba(0,245,255,0.08); bottom: 0; right: 0; }
  .hero-content { position: relative; z-index: 2; max-width: 600px; }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(124,58,255,0.2); border: 1px solid rgba(124,58,255,0.4);
    border-radius: 20px; padding: 4px 14px; font-size: 0.75rem;
    color: var(--violet2); letter-spacing: 1px; text-transform: uppercase;
    margin-bottom: 16px;
  }
  .hero-title {
    font-family: 'Rajdhani', sans-serif;
    font-size: 3.5rem; font-weight: 700; line-height: 1.1;
    color: #fff; margin-bottom: 12px;
    text-shadow: 0 0 40px rgba(124,58,255,0.3);
  }
  .hero-meta {
    display: flex; gap: 16px; align-items: center;
    font-size: 0.85rem; color: var(--muted); margin-bottom: 20px;
  }
  .hero-meta .rating { color: var(--gold); font-weight: 600; }
  .hero-desc { color: #94A3B8; font-size: 0.9rem; line-height: 1.7; margin-bottom: 28px; max-width: 480px; }
  .hero-actions { display: flex; gap: 12px; }
  .btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, var(--violet), var(--violet2));
    color: #fff; border: none; border-radius: 8px;
    padding: 12px 28px; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s; letter-spacing: 0.5px;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: var(--glow); }
  .btn-outline {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.06); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 24px; font-size: 0.9rem; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-outline:hover { border-color: var(--cyan); color: var(--cyan); }
  .hero-tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .tag {
    background: rgba(0,245,255,0.08); border: 1px solid rgba(0,245,255,0.2);
    color: var(--cyan2); border-radius: 4px; padding: 3px 10px; font-size: 0.72rem;
    letter-spacing: 0.5px; font-weight: 500;
  }

  /* SECTIONS */
  .section { padding: 48px 40px; }
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 28px;
  }
  .section-title {
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.5rem; font-weight: 700; letter-spacing: 1px;
    display: flex; align-items: center; gap: 12px;
  }
  .section-title::before {
    content: ''; display: block; width: 4px; height: 28px;
    background: linear-gradient(180deg, var(--violet), var(--cyan));
    border-radius: 2px;
  }
  .see-all {
    font-size: 0.8rem; color: var(--violet2); text-decoration: none;
    letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
    transition: color 0.2s;
  }
  .see-all:hover { color: var(--cyan); }

  /* ANIME GRID */
  .anime-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
  }

  /* ANIME CARD */
  .anime-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; cursor: pointer;
    transition: all 0.3s; position: relative;
  }
  .anime-card:hover {
    transform: translateY(-6px) scale(1.02);
    border-color: var(--violet);
    box-shadow: 0 12px 40px rgba(124,58,255,0.25), var(--glow);
  }
  .anime-card:hover .card-overlay { opacity: 1; }
  .anime-card:hover .card-poster { transform: scale(1.05); }
  .card-poster-wrap { position: relative; aspect-ratio: 2/3; overflow: hidden; }
  .card-poster { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; display: block; }
  .card-overlay {
    position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s;
    background: linear-gradient(180deg, transparent 30%, rgba(124,58,255,0.7) 100%);
    display: flex; align-items: center; justify-content: center;
  }
  .play-btn {
    width: 48px; height: 48px; border-radius: 50%;
    background: rgba(255,255,255,0.15); backdrop-filter: blur(8px);
    border: 2px solid rgba(255,255,255,0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem;
  }
  .card-quality {
    position: absolute; top: 8px; right: 8px;
    background: var(--violet); color: #fff;
    font-size: 0.65rem; font-weight: 700; letter-spacing: 1px;
    padding: 2px 8px; border-radius: 4px;
  }
  .card-lang {
    position: absolute; top: 8px; left: 8px;
    background: rgba(0,0,0,0.7); color: var(--gold);
    font-size: 0.65rem; font-weight: 600; letter-spacing: 0.5px;
    padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,184,0,0.3);
  }
  .card-body { padding: 12px; }
  .card-title {
    font-size: 0.85rem; font-weight: 600; line-height: 1.4;
    color: var(--text); margin-bottom: 6px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card-footer {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.72rem; color: var(--muted);
  }
  .card-rating { color: var(--gold); font-weight: 600; display: flex; align-items: center; gap: 3px; }
  .card-eps { color: var(--cyan2); }

  /* SERIES DETAIL PAGE */
  .detail-hero {
    position: relative; padding: 60px 40px 40px;
    background: linear-gradient(135deg, #0D1B3E, #080B14);
    border-bottom: 1px solid var(--border);
  }
  .detail-inner { display: flex; gap: 40px; align-items: flex-start; max-width: 900px; }
  .detail-poster {
    width: 200px; flex-shrink: 0; border-radius: 12px;
    overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5), var(--glow);
    border: 2px solid rgba(124,58,255,0.3);
  }
  .detail-poster img { width: 100%; display: block; }
  .detail-info { flex: 1; }
  .detail-title {
    font-family: 'Rajdhani', sans-serif;
    font-size: 2.4rem; font-weight: 700; color: #fff; margin-bottom: 10px;
  }
  .detail-meta { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .meta-chip {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.8rem; color: var(--muted);
  }
  .detail-genres { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .detail-desc { color: #94A3B8; font-size: 0.9rem; line-height: 1.75; margin-bottom: 24px; }
  .detail-actions { display: flex; gap: 12px; }

  /* EPISODE LIST */
  .episode-section { padding: 40px; }
  .season-header {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
    font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 700;
  }
  .season-badge {
    background: linear-gradient(135deg, var(--violet), var(--cyan));
    color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 0.8rem;
  }
  .episode-list { display: flex; flex-direction: column; gap: 10px; }
  .episode-item {
    display: flex; align-items: center; gap: 16px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; cursor: pointer;
    transition: all 0.2s;
  }
  .episode-item:hover { border-color: var(--violet); background: #131B2E; }
  .ep-num {
    width: 40px; height: 40px; border-radius: 8px;
    background: rgba(124,58,255,0.15); border: 1px solid rgba(124,58,255,0.3);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; font-weight: 700;
    color: var(--violet2); flex-shrink: 0;
  }
  .ep-info { flex: 1; }
  .ep-title { font-size: 0.9rem; font-weight: 500; color: var(--text); margin-bottom: 3px; }
  .ep-meta { font-size: 0.75rem; color: var(--muted); }
  .ep-watch-btn {
    background: var(--violet); color: #fff; border: none;
    border-radius: 6px; padding: 7px 16px; font-size: 0.8rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .ep-watch-btn:hover { background: var(--violet2); box-shadow: var(--glow); }

  /* WATCH PAGE */
  .watch-page { padding: 32px 40px; }
  .player-wrap {
    background: #000; border-radius: 12px; overflow: hidden;
    border: 1px solid var(--border); aspect-ratio: 16/9;
    position: relative; max-width: 900px; margin: 0 auto 28px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  }
  .player-wrap iframe { width: 100%; height: 100%; border: none; }
  .player-info-bar {
    max-width: 900px; margin: 0 auto 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .now-playing {
    font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 600;
    color: var(--cyan);
  }
  .player-nav { display: flex; gap: 10px; }
  .player-nav button {
    background: var(--card); border: 1px solid var(--border);
    color: var(--text); border-radius: 6px; padding: 8px 16px;
    font-size: 0.82rem; cursor: pointer; transition: all 0.2s;
  }
  .player-nav button:hover { border-color: var(--violet); color: var(--violet2); }

  /* LOADING / SPINNER */
  .loader {
    display: flex; align-items: center; justify-content: center;
    height: 200px; gap: 12px; color: var(--muted); font-size: 0.9rem;
  }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--violet);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* BACK BUTTON */
  .back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--muted); font-size: 0.82rem; cursor: pointer;
    margin-bottom: 24px; transition: color 0.2s;
  }
  .back-btn:hover { color: var(--cyan); }

  /* TRENDING TABS */
  .tabs { display: flex; gap: 4px; margin-bottom: 28px; }
  .tab {
    padding: 8px 20px; border-radius: 6px; font-size: 0.82rem;
    font-weight: 500; cursor: pointer; transition: all 0.2s;
    border: 1px solid transparent; color: var(--muted);
    background: none;
  }
  .tab.active {
    background: rgba(124,58,255,0.15); color: var(--violet2);
    border-color: rgba(124,58,255,0.4);
  }
  .tab:hover:not(.active) { color: var(--text); background: var(--card); }

  /* FOOTER */
  .footer {
    border-top: 1px solid var(--border);
    padding: 32px 40px; text-align: center;
    color: var(--muted); font-size: 0.8rem;
  }
  .footer strong {
    font-family: 'Rajdhani', sans-serif;
    background: linear-gradient(90deg, var(--violet), var(--cyan));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  @media (max-width: 768px) {
    .navbar { padding: 0 16px; }
    .nav-links { display: none; }
    .search-bar input { width: 120px; }
    .hero { height: auto; padding: 40px 16px; }
    .hero-title { font-size: 2.2rem; }
    .section { padding: 32px 16px; }
    .anime-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .detail-inner { flex-direction: column; }
    .detail-poster { width: 160px; }
    .detail-hero, .episode-section, .watch-page { padding: 28px 16px; }
    .player-info-bar { flex-direction: column; align-items: flex-start; gap: 12px; }
  }
`;

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFB800">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5m7-7-7 7 7 7"/>
  </svg>
);
const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const EpsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>
  </svg>
);
const FireIcon = () => "🔥";
const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AnimeZone() {
  const [page, setPage] = useState("home");
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedEp, setSelectedEp] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [loading, setLoading] = useState(false);
  const [homeList, setHomeList] = useState([]);
  const [episodeList, setEpisodeList] = useState([]);
  const [embedUrl, setEmbedUrl] = useState("");
  const [apiError, setApiError] = useState("");
  const searchRef = useRef(null);

  // Load home on mount
  useEffect(() => {
    setLoading(true);
    apiFetch("/api/home")
      .then(data => setHomeList((Array.isArray(data) ? data : []).map(normalizeAnime)))
      .catch(err => setApiError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Load episodes when series page opens
  useEffect(() => {
    if (page !== "series" || !selectedSeries?.slug) return;
    setEpisodeList([]);
    apiFetch(`/api/series/${selectedSeries.slug}`)
      .then(data => {
        const eps = Array.isArray(data.episodes) ? data.episodes : [];
        setEpisodeList(eps.map((ep, i) => {
          const p = parseEpSlug(ep.slug);
          return { slug: ep.slug, title: ep.title || `Episode ${i+1}`, season: p.season, ep: p.ep };
        }));
        if (data.description || data.genres) {
          setSelectedSeries(prev => ({
            ...prev,
            description: data.description || prev.description,
            genres: data.genres?.length ? data.genres : prev.genres,
            poster: data.poster || prev.poster,
          }));
        }
      })
      .catch(err => setApiError(err.message));
  }, [page, selectedSeries?.slug]);

  // Load embed URL when watch page opens
  useEffect(() => {
    if (page !== "watch" || !selectedEp?.slug) return;
    setEmbedUrl("");
    apiFetch(`/api/episode/${selectedEp.slug}`)
      .then(data => {
        // Direct toono embed URL — seedha iframe mein
        setEmbedUrl(data.embed_url);
      })
      .catch(err => setApiError(err.message));
  }, [page, selectedEp?.slug]);

  const navigate = (pg, data = null) => {
    setApiError("");
    setLoading(true);
    setTimeout(() => {
      if (pg === "series") setSelectedSeries(data);
      if (pg === "watch") setSelectedEp(data);
      setPage(pg);
      setLoading(false);
      window.scrollTo(0, 0);
    }, 300);
  };

  const filtered = homeList.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  const featured = homeList[0] || null;

  return (
    <>
      <style>{css}</style>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo" onClick={() => navigate("home")}>
          ANIME<span>ZONE</span>
        </div>
        <ul className="nav-links">
          {["Home","Series","Movies","Anime","Kids"].map(l => (
            <li key={l}>
              <a href="#" className={l === "Home" ? "active" : ""}
                onClick={e => { e.preventDefault(); navigate("home"); }}>
                {l}
              </a>
            </li>
          ))}
        </ul>
        <div className="search-bar" ref={searchRef}>
          <SearchIcon />
          <input
            placeholder="Search anime..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </nav>

      {loading && (
        <div className="loader">
          <div className="spinner" />
          Loading...
        </div>
      )}

      {apiError && !loading && (
        <div style={{
          maxWidth:700, margin:"24px auto", padding:"14px 20px",
          background:"rgba(255,71,87,0.1)", border:"1px solid rgba(255,71,87,0.3)",
          borderRadius:8, color:"#FF4757", fontSize:"0.85rem", textAlign:"center"
        }}>
          ⚠️ API Error: {apiError} &nbsp;
          <span style={{color:"var(--violet2)",cursor:"pointer",textDecoration:"underline"}}
            onClick={() => { setApiError(""); window.location.reload(); }}>
            Retry
          </span>
        </div>
      )}

      {!loading && page === "home" && (
        <>
          {/* HERO */}
          {featured && (
          <div className="hero">
            <div className="hero-bg" />
            <div className="hero-grid" />
            <div className="hero-orb hero-orb-1" />
            <div className="hero-orb hero-orb-2" />
            <div className="hero-content">
              <div className="hero-badge">⚡ New Episode Available</div>
              <h1 className="hero-title">{featured.title}</h1>
              <div className="hero-meta">
                <span className="rating"><StarIcon /> {featured.rating}</span>
                <span><CalIcon /> {featured.year}</span>
                <span><EpsIcon /> {featured.episodes} Episodes</span>
                <span style={{color:"var(--gold)"}}>{featured.lang}</span>
              </div>
              <p className="hero-desc">
                {featured.description || `${featured.title} — available now in Hindi dub.`}
              </p>
              <div className="hero-tags" style={{marginBottom:20}}>
                {(featured.genres||[]).map(g => <span className="tag" key={g}>{g}</span>)}
              </div>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate("series", featured)}>
                  <PlayIcon /> Watch Now
                </button>
                <button className="btn-outline">
                  + Add to List
                </button>
              </div>
            </div>
          </div>
          )}

          {/* BROWSE */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">Browse Series</div>
              <div className="tabs">
                {["recent","trending"].map(t => (
                  <button key={t} className={`tab ${activeTab === t ? "active" : ""}`}
                    onClick={() => setActiveTab(t)}>
                    {t === "trending" ? <><FireIcon /> Trending</> : "Recent"}
                  </button>
                ))}
              </div>
              <span className="see-all">View All →</span>
            </div>

            <div className="anime-grid">
              {filtered.map(anime => (
                <div className="anime-card" key={anime.slug}
                  onClick={() => navigate("series", anime)}>
                  <div className="card-poster-wrap">
                    <img className="card-poster" src={anime.poster} alt={anime.title}
                      onError={e => { e.target.style.background = "#1E2D4A"; e.target.src = ""; }} />
                    <div className="card-overlay">
                      <div className="play-btn">▶</div>
                    </div>
                    <span className="card-quality">{anime.quality}</span>
                    <span className="card-lang">{anime.lang}</span>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{anime.title}</div>
                    <div className="card-footer">
                      <span className="card-rating"><StarIcon /> {anime.rating}</span>
                      <span className="card-eps">{anime.episodes} eps</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div className="footer">
            <strong>ANIMEZONE</strong> — Premium Anime Streaming · Hindi Dubbed
            <br /><br />
            <span style={{fontSize:"0.72rem"}}>
              Content sourced for educational purposes only. We do not host any video files.
            </span>
          </div>
        </>
      )}

      {/* SERIES DETAIL PAGE */}
      {!loading && page === "series" && selectedSeries && (
        <>
          <div className="detail-hero">
            <span className="back-btn" onClick={() => navigate("home")}>
              <BackIcon /> Back to Home
            </span>
            <div className="detail-inner">
              <div className="detail-poster">
                <img src={selectedSeries.poster} alt={selectedSeries.title} />
              </div>
              <div className="detail-info">
                <div className="detail-title">{selectedSeries.title}</div>
                <div className="detail-meta">
                  <span className="meta-chip"><StarIcon /> <span style={{color:"var(--gold)",marginLeft:4}}>{selectedSeries.rating}</span></span>
                  <span className="meta-chip"><CalIcon /> {selectedSeries.year}</span>
                  <span className="meta-chip"><EpsIcon /> {episodeList.length || selectedSeries.episodes} Episodes</span>
                  <span className="tag">{selectedSeries.quality}</span>
                  <span style={{color:"var(--gold)",fontSize:"0.8rem",fontWeight:600}}>{selectedSeries.lang}</span>
                </div>
                <div className="detail-genres">
                  {(selectedSeries.genres||[]).map(g => <span className="tag" key={g}>{g}</span>)}
                </div>
                <p className="detail-desc">
                  {selectedSeries.description ||
                    `A gripping anime. Follow the epic journey, now available in Hindi dub.`}
                </p>
                <div className="detail-actions">
                  <button className="btn-primary" disabled={!episodeList.length}
                    onClick={() => episodeList[0] && navigate("watch", { ...episodeList[0], series: selectedSeries })}>
                    <PlayIcon /> Play S1E1
                  </button>
                  <button className="btn-outline">
                    <DownloadIcon /> Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* EPISODE LIST */}
          <div className="episode-section">
            <div className="season-header">
              <span>Episodes</span>
              <span className="season-badge">{episodeList.length} Episodes</span>
            </div>
            {!episodeList.length && (
              <div className="loader"><div className="spinner" /> Loading episodes...</div>
            )}
            <div className="episode-list">
              {episodeList.map(ep => (
                <div className="episode-item" key={ep.slug}
                  onClick={() => navigate("watch", { ...ep, series: selectedSeries })}>
                  <div className="ep-num">E{ep.ep}</div>
                  <div className="ep-info">
                    <div className="ep-title">{ep.title}</div>
                    <div className="ep-meta">S{ep.season} · Episode {ep.ep} · HD · Hindi</div>
                  </div>
                  <button className="ep-watch-btn">▶ Watch</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* WATCH / PLAYER PAGE */}
      {!loading && page === "watch" && selectedEp && (
        <div className="watch-page">
          <span className="back-btn"
            onClick={() => navigate("series", selectedEp.series)}>
            <BackIcon /> Back to Episodes
          </span>

          <div className="player-info-bar">
            <div className="now-playing">
              ▶ Now Playing — {selectedEp.series?.title} · S{selectedEp.season}E{selectedEp.ep}: {selectedEp.title}
            </div>
            <div className="player-nav">
              {selectedEp.ep > 1 && (
                <button onClick={() => {
                  const prev = episodeList.find(e => e.ep === selectedEp.ep - 1 && e.season === selectedEp.season);
                  if (prev) navigate("watch", { ...prev, series: selectedEp.series });
                }}>← Prev</button>
              )}
              {episodeList.find(e => e.ep === selectedEp.ep + 1) && (
                <button onClick={() => {
                  const next = episodeList.find(e => e.ep === selectedEp.ep + 1 && e.season === selectedEp.season);
                  if (next) navigate("watch", { ...next, series: selectedEp.series });
                }}>Next →</button>
              )}
            </div>
          </div>

          {/* VIDEO PLAYER */}
          <div className="player-wrap" style={{
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            background:"#0D1B3E", borderRadius:16, minHeight:280, gap:24
          }}>
            {embedUrl ? (
              <>
                <div style={{fontSize:"4rem"}}>▶️</div>
                <div style={{color:"#fff", fontSize:"1.1rem", fontWeight:600, textAlign:"center", padding:"0 20px"}}>
                  {selectedEp.series?.title} — S{selectedEp.season}E{selectedEp.ep}
                </div>
                <button
                  onClick={() => window.open(embedUrl, "_blank")}
                  style={{
                    background:"linear-gradient(135deg,#7C3AFF,#00F5FF)",
                    border:"none", borderRadius:12, padding:"14px 36px",
                    color:"#fff", fontSize:"1.1rem", fontWeight:700,
                    cursor:"pointer", letterSpacing:1
                  }}>
                  ▶ Watch Now
                </button>
                <p style={{color:"rgba(255,255,255,0.4)", fontSize:"0.78rem", textAlign:"center", margin:0}}>
                  Video player new tab mein khulega
                </p>
              </>
            ) : (
              <div className="loader" style={{height:"100%"}}>
                <div className="spinner" /> Loading player...
              </div>
            )}
          </div>

          <div style={{maxWidth:900,margin:"0 auto"}}>
            <p style={{color:"var(--muted)",fontSize:"0.8rem",textAlign:"center",lineHeight:1.6}}>
              ⚡ Video hosted externally. If player doesn't load, open the original source.

              <br />
              <span style={{color:"var(--violet2)",cursor:"pointer"}}
                onClick={() => window.open(`https://toono.app/episode/${selectedEp.series?.slug}-${selectedEp.season}x${selectedEp.ep}/`, "_blank")}>
                Open on Source Site →
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
