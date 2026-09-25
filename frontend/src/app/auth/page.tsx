'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

function Field({
  label,
  clause,
  type = "text",
  placeholder,
  value,
  onChange,
  note,
}: {
  label: string;
  clause: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  note?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 9, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--ink-faded)",
        }}>
          {clause} — {label}
        </label>
        {note && (
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "var(--ink-faded)", fontStyle: "italic" }}>
            {note}
          </span>
        )}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `2px solid ${focused ? "var(--ink)" : "var(--rule)"}`,
          outline: "none",
          padding: "8px 0",
          fontFamily: "'Courier Prime', monospace",
          fontSize: 14,
          color: "var(--ink)",
          transition: "border-color 0.2s",
        }}
      />
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [role, setRole]         = useState<"freelancer" | "contractor" | "">("");
  const [agreed, setAgreed]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const canSubmit = Boolean(email && password && (!isSignup || (username && name && role && agreed)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf/`, {
        credentials: "include",
      });
      const { csrfToken } = await csrfResponse.json();

      const response = await fetch(
        `${API_BASE}/api/auth/${isSignup ? "signup" : "login"}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify(
            isSignup
              ? {
                  username,
                  email,
                  password,
                  passwordConfirm: password,
                }
              : { identifier: email, password }
          ),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        const fieldErrors = result.errors
          ? Object.values(result.errors).flat().join(" ")
          : result.detail;
        throw new Error(fieldErrors || "Unable to complete authentication.");
      }

      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reach the backend.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, var(--ink-ghost) 27px, var(--ink-ghost) 28px)",
      }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: "0 40px" }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "var(--red)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24 }}>
            {isSignup ? "Registration Complete" : "Access Granted"}
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, fontWeight: 900, margin: "0 0 16px", color: "var(--ink)", lineHeight: 1 }}>
            {isSignup ? `Welcome,` : "Welcome back,"}
          </h2>
          {isSignup && (
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 40, fontWeight: 400, margin: "0 0 24px", color: "var(--ink)", lineHeight: 1 }}>
              {name || email}
            </h2>
          )}
          <div style={{ height: 1, background: "var(--rule)", margin: "24px auto", maxWidth: 200 }} />
          <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, lineHeight: 1.9, color: "var(--ink-faded)", marginBottom: 32 }}>
            {isSignup
              ? "Your party credentials have been recorded. You may now create, review, and seal legally binding instruments on Pactum."
              : "Your identity has been verified. Your sealed instruments and active agreements are ready."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "12px 32px",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              fontFamily: "'Courier Prime', monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Enter Platform →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "var(--paper)",
    }}>

      {/* ── LEFT — brand context ── */}
      <div style={{
        position: "relative", 
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 64px 60px 80px",
        borderRight: "1px solid var(--rule)",
        backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, var(--ink-ghost) 27px, var(--ink-ghost) 28px)",
        overflow: "hidden",
      }}>
        
        {/* back + logo */}
        <div>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "'Courier Prime', monospace", fontSize: 10,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: "var(--ink-faded)", padding: 0, marginBottom: 48,
              transition: "color 0.2s", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-faded)")}
          >
            ← Return to Agreement
          </button>

          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.38em", color: "var(--ink-faded)", textTransform: "uppercase", marginBottom: 12 }}>
            The Contract Platform
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(44px, 5vw, 68px)", fontWeight: 900, lineHeight: 0.9, color: "var(--ink)", letterSpacing: "-0.025em" }}>
            PACTUM
          </div>

          <div style={{ height: 1, background: "var(--ink)", opacity: 0.15, maxWidth: 280, margin: "28px 0" }} />

          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "var(--ink-faded)", fontStyle: "italic", lineHeight: 2.1, maxWidth: 300 }}>
            "This Platform Service Agreement
            <br />shall remain in full force from the
            <br />moment of account registration,
            <br />binding the undersigned party to
            <br />the terms set forth herein."
          </div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "var(--ink-faded)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 12 }}>
            — Pactum PSA, Article I §1.1
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "flex", gap: 40 }}>
          {[["12,400+", "Contracts"], ["$240M+", "Protected"], ["60+", "Jurisdictions"]].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--red)" }}>{val}</div>
              <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "var(--ink-faded)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT — form ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 72px 60px 64px",
        backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, var(--ink-ghost) 27px, var(--ink-ghost) 28px)",
      }}>

        {/* mode toggle */}
        <div style={{ display: "flex", border: "1px solid var(--rule)", marginBottom: 40, alignSelf: "flex-start" }}>
          {(["login", "signup"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "8px 24px",
                border: "none",
                background: mode === m ? "var(--ink)" : "transparent",
                color: mode === m ? "var(--paper)" : "var(--ink-faded)",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11, letterSpacing: "0.14em",
                textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* heading */}
        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "var(--red)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
          {isSignup ? "Party Registration — Exhibit B" : "Party Identification — Exhibit B"}
        </div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(26px, 3vw, 38px)",
          fontWeight: 900, margin: "0 0 8px",
          color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.01em",
        }}>
          {isSignup ? "Establish your" : "Identify your"}
          <br /><em style={{ fontStyle: "italic", fontWeight: 400 }}>party credentials.</em>
        </h2>
        <div style={{ height: 1, background: "var(--rule)", margin: "20px 0 28px" }} />

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 420 }}>

          {isSignup && (
            <>
              <Field clause="§1" label="Account Username" placeholder="Your unique Pactum username" value={username} onChange={setUsername} />
              <Field clause="§2" label="Full Legal Name" placeholder="As it appears on official documents" value={name} onChange={setName} />
              <Field clause="§3" label="Company / Trading Name" placeholder="Optional" note="optional" value={company} onChange={setCompany} />
            </>
          )}

          <Field
            clause={isSignup ? "§4" : "§1"}
            label="Email Address"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={setEmail}
          />
          <Field
            clause={isSignup ? "§5" : "§2"}
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={setPassword}
          />

          {isSignup && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-faded)", marginBottom: 12 }}>
                §6 — Party Role
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {(["freelancer", "contractor"] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1, padding: "12px",
                      border: `1px solid ${role === r ? "var(--ink)" : "var(--rule)"}`,
                      background: role === r ? "var(--ink)" : "transparent",
                      color: role === r ? "var(--paper)" : "var(--ink-faded)",
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 11, letterSpacing: "0.12em",
                      textTransform: "uppercase", cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {r === "freelancer" ? "Freelancer" : "Contractor"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSignup && (
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <div
                  onClick={() => setAgreed(a => !a)}
                  style={{
                    width: 16, height: 16, border: `1px solid ${agreed ? "var(--ink)" : "var(--rule)"}`,
                    background: agreed ? "var(--ink)" : "transparent",
                    flexShrink: 0, marginTop: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {agreed && <span style={{ color: "var(--paper)", fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "var(--ink-faded)", lineHeight: 1.75 }}>
                  I, the undersigned, agree to be legally bound by the{" "}
                  <span style={{ color: "var(--ink)", borderBottom: "1px solid var(--rule)", cursor: "pointer" }}>
                    Platform Service Agreement
                  </span>{" "}
                  and acknowledge that all executed instruments on Pactum are immutable and legally binding.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div style={{ color: "var(--red)", fontFamily: "'Courier Prime', monospace", fontSize: 11, lineHeight: 1.6, marginBottom: 18 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            style={{
              width: "100%", padding: "14px",
              background: canSubmit && !submitting ? "var(--ink)" : "transparent",
              color: canSubmit && !submitting ? "var(--paper)" : "var(--ink-faded)",
              border: "1px solid",
              borderColor: canSubmit && !submitting ? "var(--ink)" : "var(--rule)",
              fontFamily: "'Courier Prime', monospace",
              fontSize: 12, letterSpacing: "0.2em",
              textTransform: "uppercase", cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.2s", marginBottom: 20,
            }}
          >
            {submitting ? "Verifying..." : isSignup ? "Execute Registration →" : "Access Platform →"}
          </button>

          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "var(--ink-faded)", textAlign: "center" }}>
            {isSignup ? "Already registered?" : "No account yet?"}{" "}
            <span
              onClick={() => setMode(isSignup ? "login" : "signup")}
              style={{ color: "var(--red)", cursor: "pointer", borderBottom: "1px solid rgba(184,28,16,0.3)" }}
            >
              {isSignup ? "Sign in" : "Register as a party"}
            </span>
          </div>
        </form>

        {/* filing footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "var(--ink-faded)", letterSpacing: "0.12em", lineHeight: 1.9 }}>
            Case No. PA-2026-0001 · Pactum Inc. · All credentials encrypted at rest
            <br />ESIGN / eIDAS / UETA Compliant · Registration constitutes acceptance of PSA
          </div>
        </div>
      </div>
    </div>
  );
}
