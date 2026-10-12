'use client';
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import ContractLoader from "../ContractLoader";
import { useConfirm } from "../../components/ConfirmDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

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
const PAGE_W = 794; // match your editor's page width (A4 @ 96dpi)
const PAGE_H = 1123;

function ContractPreview({ bodyHtml }: { bodyHtml?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.38);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / PAGE_W);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const srcDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: #fffdfb; }
  body {
    box-sizing: border-box;
    width: ${PAGE_W}px;
    padding: 56px 64px;
    color: #1a0f10;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    overflow: hidden;
  }
  img { max-width: 100%; }
  table { border-collapse: collapse; max-width: 100%; }
</style>
</head>
<body>${bodyHtml ?? ""}</body>
</html>`;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#fffdfb" }}
    >
      <iframe
        title="Contract preview"
        srcDoc={srcDoc}
        sandbox=""            /* no scripts, no same-origin access */
        loading="lazy"
        tabIndex={-1}
        scrolling="no"
        style={{
          position: "absolute", top: 0, left: 0,
          width: PAGE_W, height: PAGE_H,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",   // clicks go to the card, not the iframe
        }}
      />
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

const VIEWS = ["All", "Recently viewed", "Invited", "Shared contracts", "Archived"] as const;
type View = typeof VIEWS[number];

const RECENT_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

const EMPTY_MESSAGES: Record<View, string> = {
  "All": "No contracts yet.",
  "Recently viewed": "Nothing edited in the last 2 days.",
  "Invited": "No contracts have been invited to your account.",
  "Shared contracts": "You haven't created any contracts yet.",
  "Archived": "No signed contracts yet.",
};

type DashboardContract = {
  id: string; title: string; edited: string; updatedAt: number; status: string;
  color: string; dark: boolean; bodyHtml?: string; source: "owned" | "invited";
};

function useViewport() {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return { isMobile: width < 640, isTablet: width < 1024 }; // isTablet is also true on mobile
}

export default function Dashboard() {
  const { isMobile, isTablet } = useViewport();
  const LIST_COLS = isMobile ? "1fr 32px" : isTablet ? "1fr 140px 32px" : "1fr 160px 160px 100px 32px";
  const LIST_HEADERS = isMobile ? ["Name"] : isTablet ? ["Name", "Last edited"] : ["Name", "Contract ID", "Last edited", "Type"];
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dark, setDark] = useState(false);
  const [showBanner, setShowBanner]   = useState(true);
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [search, setSearch]           = useState("");
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [view, setView] = useState<View>("All");
  const [savedContracts, setSavedContracts] = useState<DashboardContract[]>([]);
  const [invitedContracts, setInvitedContracts] = useState<DashboardContract[]>([]);

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
        return readResponse(response);
      })
      .then(result => {
        if (!result.user || typeof result.user !== "object") throw new Error("unauthorized");
        setUser(result.user as { username: string; email: string });
        return fetch(`${API_BASE}/api/contracts/`, { credentials: "include", signal: controller.signal });
      })
      .then(response => {
        if (!response) return null;
        if (!response.ok) throw new Error("contracts_unavailable");
        return readResponse(response);
      })
      .then(result => {
        if (Array.isArray(result?.contracts)) {
          setSavedContracts(result.contracts.map((contract: { id: string; title: string; updatedAt: string; status: string; bodyHtml?: string }) => ({
            id: contract.id,
            title: contract.title,
            edited: new Date(contract.updatedAt).toLocaleDateString(),
            updatedAt: new Date(contract.updatedAt).getTime(),
            status: contract.status,
            color: contract.status === "sent" ? "#2A1117" : "#F0EBE3",
            dark: contract.status === "sent",
            bodyHtml: contract.bodyHtml,
            source: "owned" as const,
          })));
        }
        return fetch(`${API_BASE}/api/contracts/invited/`, { credentials: "include", signal: controller.signal });
      })
      .then(response => {
        if (!response) return null;
        if (!response.ok) throw new Error("invited_contracts_unavailable");
        return response.json();
      })
      .then(result => {
        if (Array.isArray(result?.contracts)) {
          setInvitedContracts(result.contracts.map((contract: { id: string; title: string; updatedAt: string; status: string; bodyHtml?: string }) => ({
            id: contract.id,
            title: contract.title,
            edited: new Date(contract.updatedAt).toLocaleDateString(),
            color: contract.status === "executed" ? "#F0EBE3" : "#2A1117",
            dark: contract.status !== "executed",
            bodyHtml: contract.bodyHtml,
            source: "invited" as const,
          })));
        }
        setContractsLoaded(true);
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

  async function handleDeleteContract(id: string) {
    const name = savedContracts.find(contract => contract.id === id)?.title || "this contract";
    const ok = await confirm({
      eyebrow: "Delete contract",
      title: "Delete this contract?",
      message: <><strong>{name}</strong> will be permanently deleted. This can't be undone.</>,
      confirmLabel: "Delete permanently",
      tone: "danger",
    });
    if (!ok) return;

    const csrfToken = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" })
      .then(response => response.json())
      .then(result => result.csrfToken as string);
    const response = await fetch(`${API_BASE}/api/contracts/${id}/delete/`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRFToken": csrfToken },
    });
    if (response.ok) setSavedContracts(current => current.filter(contract => contract.id !== id));
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
    "--d-select-bg": "#1b1011",
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
    "--d-select-bg": "#fffdfb",
  };

  const now = Date.now();
  const allContracts = [
    ...savedContracts,
    ...invitedContracts.filter(invited => !savedContracts.some(owned => owned.id === invited.id)),
  ];

  const byView: Record<View, DashboardContract[]> = {
    "All": allContracts,
    "Recently viewed": allContracts.filter(c => now - c.updatedAt <= RECENT_MS),
    "Invited": invitedContracts,
    "Shared contracts": savedContracts,
    "Archived": allContracts.filter(c => c.status === "executed"),
  };

  const displayedContracts = byView[view]
    .filter(c => search === "" || c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      id="dash-root"
      style={{
        ...(cssVars as React.CSSProperties),
        minHeight: "100dvh",
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
          minHeight: 56, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: isMobile ? 10 : 0,
          padding: isMobile ? "10px 16px" : "0 24px",
          background: P.surface,
          borderBottom: `1px solid ${P.border}`,
        }}>
          {/* wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, order: 1 }}>
          <img src="/logo.png" alt="Pactum logo" style={{ width: 28, height: 28 }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: P.text, letterSpacing: "-0.01em" }}>
            PACTUM
          </span>
        </div>

        {/* search */}
         <div style={{
            flex: 1, position: "relative",
            maxWidth: isMobile ? "none" : 440,
            margin: isMobile ? 0 : isTablet ? "0 16px" : "0 32px",
            order: isMobile ? 3 : 2,
            flexBasis: isMobile ? "100%" : "auto",
          }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, order: isMobile ? 2 : 3 }}>
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
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 32px" : isTablet ? "24px 24px 40px" : "28px 32px 48px" }}>

        {/* ── RECOMMENDED TEMPLATES PANEL ── */}
        {showBanner && (
          <div style={{
            background: P.card,
            border: `1px solid ${P.borderStrong}`,
            borderRadius: 10,
            padding: isMobile ? "16px" : "20px 24px",
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
            <div style={isMobile ? {
              display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory",
              margin: "0 -16px", padding: "0 16px 4px",
            } : {
              display: "grid", gridTemplateColumns: isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14,
            }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  style={{ cursor: "pointer", ...(isMobile && { flex: "0 0 220px", scrollSnapAlign: "start" }) }}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <select
          value={view}
          onChange={e => setView(e.target.value as View)}
          aria-label="Filter contracts"
          style={{
            padding: "6px 28px 6px 10px",
            background: "var(--d-select-bg)",
            colorScheme: dark ? "dark" : "light",
            border: `1px solid ${P.borderStrong}`,
            borderRadius: 6,
            color: P.text,
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
          {VIEWS.map(v => (
            <option key={v} value={v} style={{ background: "var(--d-select-bg)", color: P.text }}>{v}</option>
          ))}
        </select>

        {/* view toggle: unchanged */}
        <div style={{ display: "flex", border: `1px solid ${P.border}`, borderRadius: 6, overflow: "hidden" }}>
          {(["grid", "list"] as const).map(mode => (
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

        {/* grid */}
        {displayedContracts.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", color: P.textMuted, fontSize: 13 }}>
            {search ? "No contracts match your search." : EMPTY_MESSAGES[view]}
          </div>
        ) : viewMode === "grid" ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))",
            gap: isMobile ? 12 : 16,
          }}>
            {displayedContracts.map(r => (
              <div
                key={r.id}
                style={{ cursor: contractsLoaded ? "pointer" : "default", position: "relative" }}
                onClick={() => { if (contractsLoaded) router.push(r.source === "invited" ? `/contract/${r.id}?review=1` : `/contract/${r.id}`); }}
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
                  <ContractPreview bodyHtml={"bodyHtml" in r && typeof r.bodyHtml === "string" ? r.bodyHtml : undefined} />
                </div>
                {contractsLoaded && r.source === "owned" && <button type="button" onClick={event => { event.stopPropagation(); void handleDeleteContract(r.id); }} title="Delete contract" aria-label={`Delete ${r.title}`} style={{ position: "absolute", top: 8, right: 8, border: 0, background: P.surface, color: P.textMuted, cursor: "pointer", width: 24, height: 24, borderRadius: 4 }}>×</button>}

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
            {/* header */}
            <div style={{ display: "grid", gridTemplateColumns: LIST_COLS, padding: "8px 12px", borderBottom: `1px solid ${P.border}` }}>
              {LIST_HEADERS.map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.textMuted }}>{h}</div>
              ))}
              <div />
            </div>

            {displayedContracts.map(r => (
              <div
                key={r.id}
                style={{
                  display: "grid", gridTemplateColumns: LIST_COLS,
                  padding: "11px 12px", borderRadius: 6,
                  cursor: contractsLoaded ? "pointer" : "default",
                  transition: "background 0.15s", alignItems: "center",
                  columnGap: isMobile ? 8 : 0,
                }}
                onClick={() => { if (contractsLoaded) router.push(r.source === "invited" ? `/contract/${r.id}?review=1` : `/contract/${r.id}`); }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: r.color, border: `1px solid ${P.border}`, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    {isMobile && <div style={{ fontSize: 11, color: P.textMuted }}>Edited {r.edited}</div>}
                  </div>
                </div>

                {!isTablet && <div style={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", color: P.textMuted, overflow: "hidden", textOverflow: "ellipsis" }}>{r.id}</div>}
                {!isMobile && <div style={{ fontSize: 12, color: P.textMuted }}>Edited {r.edited}</div>}
                {!isTablet && <div style={{ fontSize: 11, color: P.accent, background: P.accentMuted, padding: "2px 8px", borderRadius: 4, display: "inline-block", width: "fit-content" }}>Contract</div>}

                <div style={{ display: "flex", justifyContent: "center" }}>
                  {contractsLoaded && r.source === "owned" && (
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); void handleDeleteContract(r.id); }}
                      title="Delete contract"
                      aria-label={`Delete ${r.title}`}
                      style={{
                        border: 0, background: "transparent", color: P.textMuted, cursor: "pointer",
                        width: 24, height: 24, borderRadius: 4, fontSize: 18, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = P.accent; e.currentTarget.style.background = P.accentMuted; }}
                      onMouseLeave={e => { e.currentTarget.style.color = P.textMuted; e.currentTarget.style.background = "transparent"; }}
                    >×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
