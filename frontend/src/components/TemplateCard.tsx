'use client';
import type { CSSProperties } from "react";
import type { Template } from "../lib/templates";

const MAX_ROWS = 4;

export function TemplatePreview({ t }: { t: Template }) {
  const shown = t.sections.slice(0, MAX_ROWS);
  return (
    <div style={{
      width: "100%", height: "100%", background: "#fffdfb", color: "#1a0f10",
      padding: "12px 14px", display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden", fontFamily: "'DM Sans', Arial, sans-serif",
    }}>
      {/* category (right-aligned so it never collides with the badge) */}
      <div style={{ textAlign: "right", fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B2635", marginBottom: 8 }}>
        {t.category}
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {t.title}
      </div>
      <div style={{ height: 1, background: "#8B2635", opacity: 0.35, margin: "6px 0 7px" }} />

      {/* clause outline */}
      {shown.map((s, i) => (
        <div key={s} style={{ display: "flex", gap: 6, fontSize: 9, lineHeight: "14px", color: "rgba(26,15,16,0.75)" }}>
          <span style={{ color: "#8B2635", fontWeight: 700, width: 10, flexShrink: 0 }}>{i + 1}.</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</span>
        </div>
      ))}

      {/* footer: parties + clause count */}
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", gap: 4, minWidth: 0 }}>
          {t.parties.map(p => (
            <span key={p} style={{ padding: "1px 6px", border: "1px solid rgba(139,38,53,0.35)", borderRadius: 2, fontSize: 8, color: "#8B2635", whiteSpace: "nowrap" }}>{p}</span>
          ))}
        </div>
        <span style={{ fontSize: 8, color: "rgba(26,15,16,0.5)", whiteSpace: "nowrap" }}>{t.sections.length} clauses</span>
      </div>
    </div>
  );
}

export default function TemplateCard({ t, onOpen, style }: { t: Template; onOpen: () => void; style?: CSSProperties }) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ cursor: "pointer", ...style }}
      onMouseEnter={e => { e.currentTarget.querySelector<HTMLElement>(".t-thumb")!.style.opacity = "0.85"; }}
      onMouseLeave={e => { e.currentTarget.querySelector<HTMLElement>(".t-thumb")!.style.opacity = "1"; }}
    >
      <div className="t-thumb" style={{ height: 148, borderRadius: 6, overflow: "hidden", border: "1px solid var(--d-border)", marginBottom: 10, transition: "opacity 0.18s", position: "relative" }}>
        <TemplatePreview t={t} />
        {t.badge && (
          <div style={{ position: "absolute", top: 8, left: 8, background: "var(--d-accent)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.05em" }}>
            {t.badge}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--d-text)", marginBottom: 3, lineHeight: 1.35 }}>{t.title}</div>

      <div style={{
        fontSize: 11, lineHeight: 1.45, color: "var(--d-text-sub)", marginBottom: 8,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{t.summary}</div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 10.5, color: "var(--d-text-muted)", marginBottom: 6 }}>
        <span style={{ color: "var(--d-accent)", background: "var(--d-accent-muted)", padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>{t.category}</span>
        <span>{t.pages} pages</span>
        <span>~{t.minutes} min</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--d-text-muted)" }}>
        <span>by {t.author}</span>
        <span>♡ {t.likes}</span>
        <span>👤 {t.users}</span>
      </div>
    </div>
  );
}