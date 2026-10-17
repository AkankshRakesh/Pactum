'use client';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ContractLoader from "../ContractLoader";
import TemplateCard from "../../components/TemplateCard";
import { templates, TEMPLATE_CATEGORIES } from "../../lib/templates";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const DASHBOARD_PATH = "/dashboard"; // change if your home page lives elsewhere

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

/* "108k" -> 108000, "4.1k" -> 4100 */
function parseCount(value: string): number {
  const n = parseFloat(value);
  return value.toLowerCase().endsWith("k") ? n * 1000 : n;
}

/* ─── palette ────────────────────────────────────────────────────── */
const P = {
  bg:           "var(--d-bg)",
  surface:      "var(--d-surface)",
  card:         "var(--d-card)",
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

const SORTS = ["Most used", "Most liked", "Shortest first", "A–Z"] as const;
type Sort = typeof SORTS[number];

function useViewport() {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return { isMobile: width < 640, isTablet: width < 1024 };
}

export default function TemplatesPage() {
  const { isMobile, isTablet } = useViewport();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("Most used");

  /* theme: follow the same <html class="dark"> toggle as the dashboard */
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setDark(root.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  /* session check */
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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: templates.length };
    templates.forEach(t => { counts[t.category] = (counts[t.category] ?? 0) + 1; });
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = templates.filter(t =>
      (category === "All" || t.category === category) &&
      (q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.sections.some(s => s.toLowerCase().includes(q)))
    );
    const sorted = [...list];
    switch (sort) {
      case "Most used":      sorted.sort((a, b) => parseCount(b.users) - parseCount(a.users)); break;
      case "Most liked":     sorted.sort((a, b) => parseCount(b.likes) - parseCount(a.likes)); break;
      case "Shortest first": sorted.sort((a, b) => a.minutes - b.minutes); break;
      case "A–Z":            sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return sorted;
  }, [search, category, sort]);

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
    "--d-select-bg":     "#1b1011",
    "--d-preview-bg":     "#fffdfb",
    "--d-preview-text":   "#1a0f10",
    "--d-preview-sub":    "rgba(26,15,16,0.75)",
    "--d-preview-muted":  "rgba(26,15,16,0.5)",
    "--d-preview-accent": "#8B2635",
    "--d-preview-rule":   "rgba(139,38,53,0.35)",
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
    "--d-select-bg":     "#fffdfb",
    "--d-preview-bg":     "#1a0d10",
    "--d-preview-text":   "#F0E8E8",
    "--d-preview-sub":    "rgba(240,232,232,0.75)",
    "--d-preview-muted":  "rgba(240,232,232,0.5)",
    "--d-preview-accent": "#C1445A",
    "--d-preview-rule":   "rgba(193,68,90,0.45)",
  };

  const hasFilters = search !== "" || category !== "All";

  return (
    <div
      id="templates-root"
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
        <div
          role="link"
          tabIndex={0}
          onClick={() => router.push(DASHBOARD_PATH)}
          onKeyDown={e => { if (e.key === "Enter") router.push(DASHBOARD_PATH); }}
          style={{ display: "flex", alignItems: "center", gap: 10, order: 1, cursor: "pointer" }}
        >
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
            placeholder="Search templates..."
            aria-label="Search templates"
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

      {/* ── MAIN ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 32px" : isTablet ? "24px 24px 40px" : "28px 32px 48px" }}>

        {/* page heading */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push(DASHBOARD_PATH)}
            style={{
              background: "transparent", border: "none", padding: 0, marginBottom: 10,
              color: P.textMuted, fontSize: 12, cursor: "pointer",
              fontFamily: "'DM Sans', Arial, sans-serif", transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = P.text)}
            onMouseLeave={e => (e.currentTarget.style.color = P.textMuted)}
          >← Back to contracts</button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px", color: P.text }}>
            Templates
          </h1>
          <p style={{ fontSize: 13, color: P.textSub, margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
            Start from a ready-made agreement. Pick one and it opens in the editor with the clauses already in place.
          </p>
        </div>

        {/* toolbar: category chips + sort */}
        <div style={{
          display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 20,
        }}>
          <div
            role="tablist"
            aria-label="Template categories"
            style={{
              display: "flex", gap: 8,
              overflowX: "auto", paddingBottom: 2,
              margin: isMobile ? "0 -16px" : 0, padding: isMobile ? "0 16px 2px" : "0 0 2px",
            }}
          >
            {TEMPLATE_CATEGORIES.map(c => {
              const active = c === category;
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(c)}
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    background: active ? P.accentMuted : "transparent",
                    border: `1px solid ${active ? P.accentBorder : P.borderStrong}`,
                    borderRadius: 999,
                    color: active ? P.accent : P.textSub,
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    fontFamily: "'DM Sans', Arial, sans-serif",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {c} <span style={{ opacity: 0.6, marginLeft: 2 }}>{categoryCounts[c] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            aria-label="Sort templates"
            style={{
              alignSelf: isMobile ? "flex-start" : "auto",
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
            {SORTS.map(s => (
              <option key={s} value={s} style={{ background: "var(--d-select-bg)", color: P.text }}>{s}</option>
            ))}
          </select>
        </div>

        {/* result count */}
        <div style={{ fontSize: 12, color: P.textMuted, marginBottom: 14 }} aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "template" : "templates"}
          {category !== "All" && <> in {category}</>}
          {search && <> matching “{search}”</>}
        </div>

        {/* grid */}
        {filtered.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", color: P.textMuted, fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>No templates match your filters.</div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setCategory("All"); }}
                style={{
                  padding: "7px 16px", background: "transparent",
                  border: `1px solid ${P.borderStrong}`, borderRadius: 6,
                  color: P.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', Arial, sans-serif",
                }}
              >Clear filters</button>
            )}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: isMobile ? 18 : 24,
          }}>
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                t={t}
                onOpen={() => router.push(`/new?template=${t.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}