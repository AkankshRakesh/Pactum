"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ContractLoader from "../../ContractLoader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

type Invitation = { email: string; status: string; expiresAt: string | null; creator: string };
type Contract = { title: string; subtitle: string; bodyHtml: string; status: string };

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/invitations/${token}/`)
      .then(response => response.ok ? response.json() : response.json().then(result => Promise.reject(new Error(result.detail))))
      .then(result => {
        setInvitation(result.invitation);
        setContract(result.contract);
      })
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : "This invitation is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  async function sign(mode: "guest" | "account") {
    setError("");
    setSigning(true);
    try {
      const response = await fetch(`${API_BASE}/api/invitations/${token}/sign/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "guest" ? { mode, signerName } : { mode }),
      });
      const result = await response.json();
      if (response.status === 401 && mode === "account") {
        router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      if (!response.ok) throw new Error(result.detail || "Unable to sign this contract.");
      setSigned(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign this contract.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <ContractLoader />;

  if (error || !invitation || !contract) {
    return <main className="flex min-h-screen items-center justify-center bg-[#FAF6F2] p-6 text-center pactum-body dark:bg-[#0F0708] dark:text-white"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Invitation unavailable</p><h1 className="pactum-display text-3xl font-bold">{error || "This invitation cannot be opened."}</h1></div></main>;
  }

  if (signed) {
    return <main className="flex min-h-screen items-center justify-center bg-[#FAF6F2] p-6 text-center pactum-body dark:bg-[#0F0708] dark:text-white"><div className="max-w-md"><div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[#8B2635]/10 text-3xl text-[#8B2635] dark:bg-[#C1445A]/10 dark:text-[#E0637A]">✓</div><p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Signature recorded</p><h1 className="pactum-display text-3xl font-bold">The contract is now executed.</h1><p className="mt-4 text-sm text-black/55 dark:text-white/55">Pactum has recorded your signature and preserved the executed contract.</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#F3EEE8] px-4 py-8 pactum-body text-[#1A0F10] dark:bg-[#0F0708] dark:text-[#F0E8E8] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center border border-[#8B2635]/40 bg-[#8B2635]/10 font-bold text-[#8B2635] dark:border-[#C1445A]/40 dark:bg-[#C1445A]/10 dark:text-[#C1445A]">P</div><span className="pactum-display text-lg font-bold">Pactum</span></div><span className="text-xs text-black/45 dark:text-white/45">Invited by {invitation.creator}</span></header>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-h-180 bg-[#FFFDFB] p-8 shadow-[0_8px_35px_rgba(26,15,16,0.08)] dark:bg-[#1B1011] sm:p-14"><p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Contract for review</p><h1 className="mb-2 pactum-display text-3xl font-bold">{contract.title}</h1>{contract.subtitle && <p className="mb-8 text-sm text-black/50 dark:text-white/50">{contract.subtitle}</p>}<div className="border-t border-black/10 pt-7 text-sm leading-[1.75] dark:border-white/10" dangerouslySetInnerHTML={{ __html: contract.bodyHtml }} /></article>
          <aside className="h-fit rounded-xl border border-black/10 bg-[#FAF6F2] p-6 dark:border-white/10 dark:bg-[#160B0C]"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Your signature</p><h2 className="mb-3 pactum-display text-2xl font-bold">Review and sign</h2><p className="mb-5 text-xs leading-relaxed text-black/55 dark:text-white/55">This contract was sent to <strong>{invitation.email}</strong>. Choose how you want to sign.</p><button type="button" disabled={signing} onClick={() => sign("account")} className="mb-3 w-full rounded bg-[#C1445A] px-4 py-3 text-sm font-bold text-[#0F0708] hover:bg-[#E0637A]">Sign using an account</button><button type="button" disabled={signing} onClick={() => setGuestOpen(true)} className="w-full rounded border border-[#8B2635]/35 px-4 py-3 text-sm font-semibold text-[#8B2635] hover:bg-[#8B2635]/10 dark:border-[#C1445A]/35 dark:text-[#E0637A]">Sign as a guest</button>{guestOpen && <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10"><label className="mb-2 block text-xs font-semibold" htmlFor="guest-name">Full name</label><input id="guest-name" value={signerName} onChange={event => setSignerName(event.target.value)} className="mb-3 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#8B2635] dark:border-white/10 dark:bg-[#1B1011]" placeholder="Your legal name" /><button type="button" disabled={signing || !signerName.trim()} onClick={() => sign("guest")} className="w-full rounded bg-[#8B2635] px-4 py-3 text-sm font-bold text-white hover:bg-[#A8334A]">{signing ? "Signing..." : "Confirm guest signature"}</button></div>}{error && <p className="mt-4 text-xs text-[#8B2635] dark:text-[#E0637A]">{error}</p>}<p className="mt-5 text-[11px] leading-relaxed text-black/40 dark:text-white/40">By signing, you confirm that you reviewed the contract and intend to be legally bound by its terms.</p></aside>
        </div>
      </div>
    </main>
  );
}
