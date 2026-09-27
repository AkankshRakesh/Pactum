'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Lightfall from "./lightfall";

type Mode = "login" | "signup";

/* ── floating-label input ─────────────────────────────────────────── */
function FloatInput({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div className="relative mb-5">
      <label
        className={[
          "pointer-events-none absolute left-4 z-10 pactum-body transition-all duration-180 ease-out",
          lifted
            ? "top-2 text-[10px] font-medium uppercase tracking-[0.08em]"
            : "top-1/2 -translate-y-1/2 text-sm font-normal",
          focused ? "text-[#8B2635] dark:text-[#C1445A]" : "text-black/35 dark:text-white/35",
        ].join(" ")}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={[
          "h-14.5 w-full rounded pactum-body text-sm outline-none transition-colors duration-180",
          "pt-5 pb-2 px-4",
          "bg-black/3 text-black dark:bg-white/5 dark:text-white",
          "border",
          focused
            ? "border-[#8B2635]/60 shadow-[0_0_0_3px_rgba(139,38,53,0.10)] dark:border-[#C1445A]/60 dark:shadow-[0_0_0_3px_rgba(193,68,90,0.12)]"
            : "border-black/10 dark:border-white/10",
        ].join(" ")}
      />
    </div>
  );
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    // Only class presence decides dark mode from here on
    const update = () => setIsDark(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function AgreementModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const clauses = [
    ["1. Formation and consent", "A contract is formed only when the creator and invited party review the same contract terms and each complete the required signature action. Creating an account or viewing a draft does not, by itself, create a contract."],
    ["2. Binding effect", "Once both parties sign, each party agrees to be legally bound by the contract terms, including payment, delivery, confidentiality, ownership, and dispute provisions stated in that contract."],
    ["3. Electronic signatures", "Each party agrees that an electronic signature, authentication record, timestamp, and associated audit data may be used as evidence of intent and may have the same legal effect as a handwritten signature where permitted by applicable law."],
    ["4. Contract identity and immutability", "After execution, Pactum seals the final contract and records its identifying hash. The executed version cannot be edited through the platform. Later changes require a new contract or a separately executed amendment."],
    ["5. Records and evidence", "Pactum may retain drafts, comments, signature events, timestamps, participant identity data, and sealing records as an audit trail. The parties authorize these records to be produced to establish the history and integrity of a contract."],
    ["6. Responsibilities of the parties", "The creator is responsible for inviting the correct party and supplying accurate terms. The invited party is responsible for reviewing the contract before signing. Each party must protect its credentials and promptly report suspected unauthorized access."],
    ["7. Disputes and proceedings", "The parties should first use any notice, cure, negotiation, mediation, arbitration, venue, and governing-law process written in the applicable contract. If a contract does not specify a process, the dispute will be handled under the applicable law and courts with proper jurisdiction. Pactum is a recordkeeping platform and is not a party to the contract or a provider of legal advice."],
    ["8. Acceptance of these terms", "By selecting the acceptance control and creating an account, you confirm that you have read this Platform Service Agreement, understand its effect, and have authority to accept these terms. This agreement supplements the terms stated in each individual contract."],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0708]/55 px-4 py-6 backdrop-blur-sm sm:px-6"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="relative flex max-h-[min(88vh,760px)] w-full max-w-170 flex-col overflow-hidden rounded-xl border border-[#8B2635]/30 bg-[#FAF6F2] shadow-[0_20px_80px_rgba(15,7,8,0.35)] dark:border-[#C1445A]/35 dark:bg-[#160B0C]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-title"
      >
        <div className="flex items-start justify-between gap-6 border-b border-black/10 px-6 py-5 dark:border-white/10 sm:px-8">
          <div>
            <p className="mb-1 pactum-body text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Platform Service Agreement</p>
            <h2 id="agreement-title" className="m-0 pactum-display text-2xl font-bold text-black dark:text-white">Terms of binding use</h2>
          </div>
          <button type="button" onClick={onClose} className="pactum-body text-2xl leading-none text-black/45 hover:text-[#8B2635] dark:text-white/45 dark:hover:text-[#E0637A]" aria-label="Close agreement">×</button>
        </div>
        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <p className="mb-6 pactum-body text-sm leading-[1.75] text-black/55 dark:text-white/55">Please review these platform terms before accepting. The individual contract between the creator and invited party controls the commercial details of each engagement.</p>
          <div className="space-y-5">
            {clauses.map(([title, body]) => (
              <article key={title}>
                <h3 className="mb-1 pactum-body text-sm font-bold text-black dark:text-white">{title}</h3>
                <p className="m-0 pactum-body text-[13px] leading-[1.7] text-black/55 dark:text-white/55">{body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="border-t border-black/10 px-6 py-4 dark:border-white/10 sm:px-8">
          <button type="button" onClick={onClose} className="w-full rounded bg-[#C1445A] px-5 py-3 pactum-body text-sm font-bold text-[#0F0708] hover:bg-[#E0637A]">Return to registration</button>
        </div>
      </section>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */
export default function AuthPage() {
  const router = useRouter();
  const isDark = useIsDark();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [done, setDone] = useState(false);

  const isSignup = mode === "signup";
  const canSubmit = email && password && (!isSignup || (name && agreed));

  if (done) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#FAF6F2] pactum-body dark:bg-[#0F0708]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,38,53,0.10), transparent)",
          }}
        />
        <div className="relative max-w-110 px-8 text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#8B2635]/40 bg-[#8B2635]/10 text-[28px] dark:border-[#C1445A]/40 dark:bg-[#C1445A]/12">
            ✓
          </div>
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B2635] dark:text-[#C1445A]">
            {isSignup ? "Registration complete" : "Welcome back"}
          </div>
          <h2 className="m-0 mb-3 pactum-display text-[32px] font-bold leading-[1.1] text-black dark:text-white">
            {isSignup ? `You're in, ${name || "there"}.` : "Access granted."}
          </h2>
          <p className="mb-9 text-sm leading-[1.75] text-black/50 dark:text-white/45">
            {isSignup
              ? "Your Pactum account is ready. Start creating contracts that are legally binding from the moment both parties sign."
              : "Your sealed instruments and active agreements are waiting."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="rounded bg-[#C1445A] cursor-pointer px-9 py-3.5 pactum-body text-sm font-bold tracking-[0.04em] text-[#0F0708] transition-colors duration-180 hover:bg-[#E0637A]"
          >
            Enter Pactum →
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="relative min-h-screen bg-[#FAF6F2] pactum-body dark:bg-[#0F0708]">
    {/* Lightfall — full page background */}
    <div className="pointer-events-none absolute inset-0 z-0">
      <Lightfall
        colors={
            ["#FF0000", "#E00020", "#FF2D4D"]
        }
        backgroundColor={isDark ? "#0F0708" : "#FFFFFF"}
        lightMode={!isDark}
        speed={0.1}
        streakCount={1}
        streakWidth={1}
        streakLength={1.4}
        glow={isDark ? 1 : 1.2}
        density={0.5}
        twinkle={0}
        zoom={2}
        backgroundGlow={0}
        opacity={1}
        mouseInteraction
        mouseStrength={0.4}
        mouseRadius={1.1}
        mouseDampening={0.15}
      />
    </div>

    {/* blur + scrim so the form stays legible over the animation */}
    <div className="pointer-events-none absolute inset-0 z-0 bg-[#FAF6F2]/35 dark:bg-[#0F0708]/35" />

    {/* back nav */}
    <div className="relative z-10 flex items-center px-5 pt-6 sm:px-8 lg:px-12">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 pactum-body text-[13px] text-black/40 transition-colors duration-180 hover:text-black dark:text-white/35 dark:hover:text-white"
      >
        <span className="text-base">←</span> Back to Pactum
      </button>
    </div>

    {/* centered form card */}
    <div className="relative z-10 flex min-h-[calc(100vh-64px)] items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-[560px] rounded-xl border border-black/[0.06] bg-white/70 p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/[0.07] dark:bg-white/[0.04] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] sm:p-10">
        {/* wordmark, replaces the old left-panel branding */}
        <div className="mb-7 text-center">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#8B2635] dark:text-[#C1445A]">
            Pactum
          </div>
          <h2 className="m-0 pactum-display text-2xl font-black leading-tight tracking-[-0.02em] text-black dark:text-white">
            Contracts that <em className="not-italic italic text-[#8B2635] dark:text-[#C1445A]">can't be broken.</em>
          </h2>
        </div>

        {/* tab switcher */}
        <div className="mb-9 flex rounded-md border border-black/[0.08] bg-black/[0.03] p-1 dark:border-white/[0.07] dark:bg-white/[0.04]">
          {(["login", "signup"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "flex-1 rounded py-[9px] pactum-body text-[13px] transition-all duration-180",
                mode === m
                  ? "bg-white font-semibold text-black shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:bg-white/[0.08] dark:text-white dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                  : "bg-transparent font-normal text-black/40 dark:text-white/35",
              ].join(" ")}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* heading */}
        <div className="mb-7">
          <h1 className="m-0 mb-1.5 pactum-display text-2xl font-bold leading-tight text-black dark:text-white">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="m-0 text-[13px] leading-[1.6] text-black/45 dark:text-white/40">
            {isSignup
              ? "Start creating legally binding contracts in minutes."
              : "Sign in to access your sealed contracts and agreements."}
          </p>
        </div>

          {/* form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              canSubmit && setDone(true);
            }}
          >
            {/* SSO */}
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2.5 rounded border border-black/10 bg-transparent py-3 pactum-body text-[13px] font-medium text-black/60 transition-all duration-180 hover:border-black/20 hover:text-black dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.07]" />
              <span className="text-[11px] tracking-[0.06em] text-black/30 dark:text-white/25">OR</span>
              <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.07]" />
            </div>

            {isSignup && <FloatInput label="Full legal name" value={name} onChange={setName} />}
            
            <FloatInput label="Email address" type="email" value={email} onChange={setEmail} />
            <FloatInput label="Password" type="password" value={password} onChange={setPassword} />

            {isSignup && (
              <div className="mb-6 flex items-start gap-3">
                <button
                  type="button"
                  aria-pressed={agreed}
                  aria-label="Accept Platform Service Agreement"
                  onClick={() => setAgreed(a => !a)}
                  className={[
                    "mt-px flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] transition-all duration-180",
                    agreed
                      ? "border-[#C1445A] bg-[#C1445A]"
                      : "border-black/20 bg-transparent dark:border-white/20",
                  ].join(" ")}
                >
                  {agreed && <span className="text-[11px] font-bold leading-none text-[#0F0708]">✓</span>}
                </button>
                <span className="text-xs leading-[1.75] text-black/50 dark:text-white/40">
                  I agree to the{" "}
                  <button type="button" onClick={() => setAgreementOpen(true)} className="border-0 border-b border-black/20 bg-transparent p-0 text-left text-black/75 dark:border-white/20 dark:text-white/75">
                    Platform Service Agreement
                  </button>{" "}
                  and understand all sealed contracts are legally binding and immutable.
                </span>
              </div>
            )}

            {!isSignup && (
              <div className="-mt-2 mb-5 text-right">
                <span className="cursor-pointer text-xs text-[#8B2635] dark:text-[#C1445A]">Forgot password?</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                "mb-5 w-full rounded border py-3.5 pactum-body text-sm font-bold transition-all duration-180",
                canSubmit
                  ? "cursor-pointer border-[#C1445A] bg-[#C1445A] text-[#0F0708] hover:bg-[#E0637A]"
                  : "cursor-not-allowed border-black/[0.07] bg-black/[0.03] text-black/20 dark:border-white/[0.07] dark:bg-white/5 dark:text-white/20",
              ].join(" ")}
            >
              {isSignup ? "Create account" : "Sign in"}
            </button>
            
          </form>

          <p className="mt-7 text-center text-xs leading-[1.7] text-black/30 dark:text-white/25">
            {isSignup ? "Already have an account? " : "New to Pactum? "}
            <span
              onClick={() => setMode(isSignup ? "login" : "signup")}
              className="cursor-pointer text-[#8B2635] dark:text-[#C1445A]"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </span>
          </p>

          <p className="mt-6 text-center text-[11px] leading-[1.6] text-black/15 dark:text-white/15">
            Protected by ESIGN · eIDAS · UETA
            <br />
            All credentials encrypted at rest
          </p>
        </div>
      </div>
      {agreementOpen && <AgreementModal onClose={() => setAgreementOpen(false)} />}
    </div>
  );
}