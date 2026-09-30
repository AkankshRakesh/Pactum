'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContractLoader from "../ContractLoader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

/* ─── palette ────────────────────────────────────────────────────── */
const P = {
  bg:           "var(--d-bg)",
  surface:      "var(--d-surface)",
  card:         "var(--d-card)",
  cardHover:    "var(--d-card-hover)",
  accent:       "var(--d-accent)",
  accentHover:  "var(--d-accent-hover)",
  accentMuted:  "var(--d-accent-muted)",
  accentBorder: "var(--d-accent-border)",
  text:         "var(--d-text)",
  textSub:      "var(--d-text-sub)",
  textMuted:    "var(--d-text-muted)",
  border:       "var(--d-border)",
  borderStrong: "var(--d-border-strong)",
};

/* ─── template thumbnails (CSS art) ──────────────────────────────── */
function ThumbServiceAgreement() {
  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a0d10,#2d1520)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 16, right: 16, width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(193,68,90,0.4)", opacity: 0.5 }} />
      <div style={{ position: "absolute", top: 28, right: 28, width: 24, height: 24, borderRadius: "50%", background: "rgba(193,68,90,0.2)" }} />
      {[0,1,2,3].map(i => (
        <div key={i} style={{ height: 4, borderRadius: 2, background: i === 0 ? "rgba(193,68,90,0.9)" : "rgba(255,255,255,0.12)", marginBottom: 6, width: i === 3 ? "55%" : "100%" }} />
      ))}
      <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "'Courier Prime', monospace", fontSize: 8, color: "rgba(193,68,90,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>PACTUM</div>
    </div>
  );
}
function ThumbNDA() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F4ECE4", display: "flex", flexDirection: "column", padding: "14px", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "#1a0f10", marginBottom: 8 }}>Non-Disclosure Agreement</div>
      <div style={{ height: 1, background: "#8B2635", marginBottom: 8, opacity: 0.4 }} />
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{ height: 3, borderRadius: 1, background: "rgba(26,15,16,0.15)", marginBottom: 5, width: i === 4 ? "40%" : "100%" }} />
      ))}
      <div style={{ position: "absolute", bottom: 12, right: 12 }}>
        <div style={{ width: 28, height: 28, border: "2px solid #8B2635", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
          <span style={{ fontSize: 10, color: "#8B2635", fontWeight: 700 }}>NDA</span>
        </div>
      </div>
    </div>
  );
}
function ThumbFreelance() {
  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#160B0C,#0F0708)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 9, fontFamily: "'Courier Prime', monospace", color: "rgba(99,160,240,0.7)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Freelance Contract</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["You", "Client"].map(l => (
          <div key={l} style={{ padding: "4px 10px", border: "1px solid rgba(193,68,90,0.35)", borderRadius: 2, fontSize: 9, color: "rgba(193,68,90,0.85)", fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
        ))}
      </div>
      <div style={{ width: "80%", height: 1, background: "rgba(99,160,240,0.2)", marginBottom: 8 }} />
      {[1,2].map(i => (
        <div key={i} style={{ height: 3, borderRadius: 1, background: "rgba(99,160,240,0.15)", marginBottom: 5, width: i === 2 ? "60%" : "100%" }} />
      ))}
      <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 9, fontFamily: "'Courier Prime', monospace", color: "rgba(99,160,240,0.4)" }}>100K+ Used</div>
    </div>
  );
}
function ThumbRetainer() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#1c1410", display: "flex", flexDirection: "column", padding: "14px", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "#C1445A", marginBottom: 6 }}>Retainer Agreement</div>
      <div style={{ height: 1, background: "rgba(212,168,75,0.3)", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {["Monthly", "Quarterly"].map(l => (
          <div key={l} style={{ padding: "3px 8px", background: "rgba(193,68,90,0.12)", border: "1px solid rgba(193,68,90,0.3)", fontSize: 8, color: "rgba(193,68,90,0.8)", fontFamily: "'DM Sans', sans-serif", borderRadius: 2 }}>{l}</div>
        ))}
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 3, borderRadius: 1, background: "rgba(212,168,75,0.12)", marginBottom: 5, width: i === 3 ? "50%" : "100%" }} />
      ))}
    </div>
  );
}

/* ─── recent contract thumbnails ─────────────────────────────────── */
function ContractThumb({ color, title }: { color: string; title?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", background: color, display: "flex", flexDirection: "column", padding: 14, position: "relative" }}>
      {title && <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff", opacity: 0.7, marginBottom: 6 }}>{title}</div>}
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ height: 2.5, borderRadius: 1, background: "rgba(255,255,255,0.15)", marginBottom: 5, width: i === 5 ? "45%" : i === 3 ? "80%" : "100%" }} />
      ))}
      <div style={{ position: "absolute", bottom: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✦</div>
    </div>
  );
}

/* ─── data ────────────────────────────────────────────────────────── */
const templates = [
  { id: 1, title: "Service Agreement Template",   author: "Pactum Legal",  likes: "4.1k", users: "92k",  thumb: <ThumbServiceAgreement />, badge: "Most Used" },
  { id: 2, title: "Non-Disclosure Agreement (NDA)", author: "Legal Vault",   likes: "2.8k", users: "61k",  thumb: <ThumbNDA /> },
  { id: 3, title: "Freelance Contract Starter",   author: "Pactum Community", likes: "3.3k", users: "108k", thumb: <ThumbFreelance />, badge: "100K+ Used" },
  { id: 4, title: "Monthly Retainer Agreement",   author: "Pactum Legal",  likes: "1.9k", users: "34k",  thumb: <ThumbRetainer /> },
];

const recents = [
  { id: "PA-2026-0841", title: "Unique Contract Platform Design", edited: "26 minutes ago", color: "#F0EBE3", dark: false },
  { id: "PA-2026-0792", title: "Untitled",                        edited: "17 days ago",    color: "#1a1a1a", dark: true  },
  { id: "PA-2026-0750", title: "Simulation Web Page Design",      edited: "17 days ago",    color: "#160B0C", dark: true  },
  { id: "PA-2026-0701", title: "Config 2026 Playground",          edited: "18 days ago",    color: "#333",    dark: true  },
  { id: "PA-2026-0688", title: "Brand Identity Contract",         edited: "22 days ago",    color: "#1c0d10", dark: true  },
  { id: "PA-2026-0612", title: "API Integration Agreement",       edited: "1 month ago",    color: "#0a2010", dark: true  },
  { id: "PA-2026-0600", title: "Motion Graphics Package",         edited: "1 month ago",    color: "#2A1117", dark: true  },
  { id: "PA-2026-0580", title: "Content Strategy Retainer",      edited: "2 months ago",   color: "#F4ECE4", dark: false },
];

const TABS = ["Recently viewed", "Shared contracts", "Archived"];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dark, setDark] = useState(false);
  const [showBanner, setShowBanner]   = useState(true);
  const [activeTab, setActiveTab]     = useState(0);
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [filterOrg, setFilterOrg]     = useState("All clients");
  const [filterType, setFilterType]   = useState("All types");
  const [search, setSearch]           = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setDark(root.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/auth/me/`, { credentials: "include", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then(result => {
        setUser(result.user);
        setCheckingSession(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) router.replace("/auth");
      });

    return () => controller.abort();
  }, [router]);

  async function handleSignOut() {
    try {
      const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
      const { csrfToken } = await csrfResponse.json();
      await fetch(`${API_BASE}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      });
    } finally {
      router.replace("/");
    }
  }

  if (checkingSession || !user) return <ContractLoader />;

  const cssVars = dark ? {
    "--d-bg":            "#0F0708",
    "--d-surface":       "#160B0C",
    "--d-card":          "rgba(255,255,255,0.04)",
    "--d-card-hover":    "rgba(255,255,255,0.07)",
    "--d-accent":        "#C1445A",
    "--d-accent-hover":  "#E0637A",
    "--d-accent-muted":  "rgba(193,68,90,0.12)",
    "--d-accent-border": "rgba(193,68,90,0.5)",
    "--d-text":          "#F0E8E8",
    "--d-text-sub":      "rgba(240,232,232,0.7)",
    "--d-text-muted":    "rgba(240,232,232,0.4)",
    "--d-border":        "rgba(240,232,232,0.08)",
    "--d-border-strong": "rgba(240,232,232,0.15)",
    "--d-sidebar":       "#100709",
  } : {
    "--d-bg":            "#FAF6F2",
    "--d-surface":       "#F4ECE4",
    "--d-card":          "rgba(255,255,255,0.85)",
    "--d-card-hover":    "rgba(255,255,255,1)",
    "--d-accent":        "#8B2635",
    "--d-accent-hover":  "#A8334A",
    "--d-accent-muted":  "rgba(139,38,53,0.08)",
    "--d-accent-border": "rgba(139,38,53,0.4)",
    "--d-text":          "#1a0f10",
    "--d-text-sub":      "rgba(26,15,16,0.7)",
    "--d-text-muted":    "rgba(26,15,16,0.4)",
    "--d-border":        "rgba(26,15,16,0.08)",
    "--d-border-strong": "rgba(26,15,16,0.15)",
    "--d-sidebar":       "#F0E8E4",
  };

  const filteredRecents = recents.filter(r =>
    search === "" || r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      id="dash-root"
      style={{
        ...(cssVars as React.CSSProperties),
        minHeight: "100vh",
        background: P.bg,
        fontFamily: "'DM Sans', Arial, sans-serif",
        color: P.text,
        transition: "background 0.3s",
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* ── TOP BAR ── */}
      <header style={{
        height: 56, flexShrink: 0,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: P.surface,
        borderBottom: `1px solid ${P.border}`,
      }}>
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: P.accentMuted,
            border: `1px solid ${P.accentBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: P.accent, fontWeight: 700,
          }}>P</div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: P.text, letterSpacing: "-0.01em" }}>
            PACTUM
          </span>
        </div>

        {/* search */}
        <div style={{ flex: 1, maxWidth: 440, margin: "0 32px", position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: P.textMuted, fontSize: 14, pointerEvents: "none" }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contracts..."
            style={{
              width: "100%", height: 34,
              paddingLeft: 34, paddingRight: 12,
              background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
              border: `1px solid ${P.border}`,
              borderRadius: 6,
              color: P.text, fontSize: 13,
              fontFamily: "'DM Sans', Arial, sans-serif",
              outline: "none",
            }}
          />
        </div>

        {/* right */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", cursor: "pointer", fontSize: 18 }}>
            🔔
            <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: P.accent, border: `2px solid ${P.surface}` }} />
          </div>
          <button
            onClick={() => router.push("/new")}
            style={{
              padding: "7px 16px",
              background: P.accent, border: "none", borderRadius: 6,
              color: "#fff", fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', Arial, sans-serif", cursor: "pointer",
              letterSpacing: "0.02em", transition: "background 0.18s",
              display: "flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = P.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = P.accent)}
          >
            <span style={{ fontSize: 15 }}>＋</span> New contract
          </button>
          <div
            onClick={handleSignOut}
            title="Sign out"
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: P.accentMuted,
              border: `1.5px solid ${P.accentBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: P.accent, cursor: "pointer",
            }}
          >{user.username.slice(0, 1).toUpperCase()}</div>
        </div>
      </header>

      {/* ── MAIN SCROLL AREA ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 48px" }}>

        {/* ── RECOMMENDED TEMPLATES PANEL ── */}
        {showBanner && (
          <div style={{
            background: P.card,
            border: `1px solid ${P.borderStrong}`,
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 32,
          }}>
            {/* panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>
                Recommended templates
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* refresh */}
                <button
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: P.textMuted, fontSize: 16, padding: 2, lineHeight: 1, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = P.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = P.textMuted)}
                  title="Refresh"
                >↻</button>
                {/* close */}
                <button
                  onClick={() => setShowBanner(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: P.textMuted, fontSize: 18, padding: 2, lineHeight: 1, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = P.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = P.textMuted)}
                  title="Dismiss"
                >×</button>
              </div>
            </div>

            {/* template cards row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).querySelector(".t-thumb")! as HTMLElement).style.opacity = "0.85"}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).querySelector(".t-thumb")! as HTMLElement).style.opacity = "1"}
                >
                  {/* thumbnail */}
                  <div
                    className="t-thumb"
                    style={{
                      height: 148,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: `1px solid ${P.border}`,
                      marginBottom: 10,
                      transition: "opacity 0.18s",
                      position: "relative",
                    }}
                  >
                    {t.thumb}
                    {t.badge && (
                      <div style={{
                        position: "absolute", top: 8, left: 8,
                        background: P.accent,
                        color: "#fff", fontSize: 9, fontWeight: 600,
                        padding: "2px 7px", borderRadius: 4,
                        letterSpacing: "0.05em",
                      }}>{t.badge}</div>
                    )}
                  </div>
                  {/* meta */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.text, marginBottom: 4, lineHeight: 1.35 }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: P.textMuted }}>
                    <span>by {t.author}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>♡ {t.likes}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>👤 {t.users}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* see more */}
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <span style={{ fontSize: 12, color: P.accent, cursor: "pointer", fontWeight: 500, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = P.accentHover)}
                onMouseLeave={e => (e.currentTarget.style.color = P.accent)}
              >
                See all templates →
              </span>
            </div>
          </div>
        )}

        {/* ── FILE BROWSER ── */}
        {/* toolbar row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          {/* tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: "7px 16px",
                  background: "transparent", border: "none",
                  color: activeTab === i ? P.text : P.textMuted,
                  fontFamily: "'DM Sans', Arial, sans-serif",
                  fontSize: 13, fontWeight: activeTab === i ? 600 : 400,
                  cursor: "pointer",
                  borderBottom: `2px solid ${activeTab === i ? P.accent : "transparent"}`,
                  transition: "all 0.15s",
                  paddingLeft: i === 0 ? 0 : 16,
                }}
              >{tab}</button>
            ))}
          </div>

          {/* right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* org filter */}
            <select
              value={filterOrg}
              onChange={e => setFilterOrg(e.target.value)}
              style={{
                padding: "6px 28px 6px 10px",
                background: P.card,
                border: `1px solid ${P.border}`,
                borderRadius: 6,
                color: P.textSub,
                fontSize: 12,
                fontFamily: "'DM Sans', Arial, sans-serif",
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option>All clients</option>
              <option>Holloway Creative</option>
              <option>Vantage Labs</option>
              <option>Meridian Health</option>
            </select>

            {/* type filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                padding: "6px 28px 6px 10px",
                background: P.card,
                border: `1px solid ${P.border}`,
                borderRadius: 6,
                color: P.textSub,
                fontSize: 12,
                fontFamily: "'DM Sans', Arial, sans-serif",
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option>All types</option>
              <option>Service Agreement</option>
              <option>NDA</option>
              <option>Retainer</option>
            </select>

            {/* view toggle */}
            <div style={{ display: "flex", border: `1px solid ${P.border}`, borderRadius: 6, overflow: "hidden" }}>
              {(["grid","list"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    width: 32, height: 30,
                    background: viewMode === mode ? P.accentMuted : "transparent",
                    border: "none",
                    color: viewMode === mode ? P.accent : P.textMuted,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, transition: "all 0.15s",
                  }}
                >
                  {mode === "grid" ? "⊞" : "☰"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* grid */}
        {viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {filteredRecents.map(r => (
              <div
                key={r.id}
                style={{ cursor: "pointer" }}
              >
                {/* thumbnail */}
                <div
                  style={{
                    height: 164,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${P.border}`,
                    marginBottom: 10,
                    transition: "border-color 0.18s, transform 0.18s",
                    background: r.color,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = P.accentBorder;
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = P.border;
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  <ContractThumb color={r.color} title={r.dark ? undefined : r.title} />
                </div>

                {/* file info row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {/* icon */}
                  <div style={{
                    width: 22, height: 22, flexShrink: 0, marginTop: 1,
                    background: P.accentMuted,
                    border: `1px solid ${P.accentBorder}`,
                    borderRadius: 4,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: P.accent,
                  }}>✦</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: P.text,
                      marginBottom: 2, lineHeight: 1.3,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: P.textMuted }}>Edited {r.edited}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* list view */
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* list header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 100px", padding: "8px 12px", borderBottom: `1px solid ${P.border}` }}>
              {["Name", "Contract ID", "Last edited", "Type"].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.textMuted }}>{h}</div>
              ))}
            </div>
            {filteredRecents.map(r => (
              <div
                key={r.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 160px 160px 100px",
                  padding: "11px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  alignItems: "center",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: r.color, border: `1px solid ${P.border}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: P.text }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", color: P.textMuted }}>{r.id}</div>
                <div style={{ fontSize: 12, color: P.textMuted }}>Edited {r.edited}</div>
                <div style={{ fontSize: 11, color: P.accent, background: P.accentMuted, padding: "2px 8px", borderRadius: 4, display: "inline-block", width: "fit-content" }}>Contract</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
