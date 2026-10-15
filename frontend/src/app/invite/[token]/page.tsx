"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ContractLoader from "../../ContractLoader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type Invitation = { email: string; status: string; expiresAt: string | null; creator: string };
type Contract = { title: string; subtitle: string; bodyHtml: string; status: string };
type Comment = { id: number; clauseId?: string; clauseIndex?: number | null; quotedText?: string; authorName: string; body: string; createdAt: string };

function decorateClauses(html: string, editable: boolean) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("ol > li").forEach((clause, index) => {
    if (!editable) return;
    clause.setAttribute("data-clause-index", String(index + 1));
    const action = document.createElement("button");
    action.type = "button";
    action.setAttribute("data-comment-action", clause.getAttribute("data-clause-id") || "");
    action.setAttribute("data-clause-index", String(index + 1));
    action.textContent = "＋ Comment";
    action.style.cssText = "float:right;margin:0 0 8px 16px;border:1px solid rgba(139,38,53,.3);border-radius:999px;background:rgba(139,38,53,.06);padding:3px 9px;color:#8b2635;font:600 11px sans-serif;cursor:pointer";
    clause.appendChild(action);
  });
  return document.body.innerHTML;
}

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentClause, setCommentClause] = useState<{ id: string; index: number; quotedText: string } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/invitations/${token}/`)
      .then(async response => {
        const result = await readResponse(response);
        if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to load invitation (${response.status}).`);
        return result;
      })
      .then(result => {
        setInvitation(result.invitation as Invitation);
        setContract(result.contract as Contract);
        setComments(Array.isArray(result.comments) ? result.comments as Comment[] : []);
      })
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : "This invitation is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentClause || !commentText.trim() || !commentAuthor.trim()) return;
    setCommentSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/invitations/${token}/comments/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
        body: JSON.stringify({ clauseId: commentClause.id, clauseIndex: commentClause.index, quotedText: commentClause.quotedText, body: commentText, authorName: commentAuthor }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to add comment (${response.status}).`);
      setComments(current => [...current, result.comment as Comment]);
      setCommentText("");
      setCommentClause(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function csrfToken() {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
    const result = await readResponse(response);
    if (!response.ok || typeof result.csrfToken !== "string") throw new Error(`Unable to prepare secure request (${response.status}).`);
    return result.csrfToken as string;
  }

  async function claimInvitation() {
    setSigning(true);
    setError("");
    try {
      const claimResponse = await fetch(`${API_BASE}/api/invitations/${token}/claim/`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": await csrfToken() } });
      const claimResult = await readResponse(claimResponse);
      if (claimResponse.status === 401) { router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`); return; }
      if (!claimResponse.ok) throw new Error(typeof claimResult.detail === "string" ? claimResult.detail : `Unable to claim this invitation (${claimResponse.status}).`);
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to claim this invitation.");
      setSigning(false);
    }
  }

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
      const result = await readResponse(response);
      if (response.status === 401 && mode === "account") {
        router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to sign this contract (${response.status}).`);
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
          <article className="min-h-180 bg-[#FFFDFB] p-8 shadow-[0_8px_35px_rgba(26,15,16,0.08)] dark:bg-[#1B1011] sm:p-14"><p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Contract for review</p><h1 className="mb-2 pactum-display text-3xl font-bold">{contract.title}</h1>{contract.subtitle && <p className="mb-8 text-sm text-black/50 dark:text-white/50">{contract.subtitle}</p>}<div className="border-t border-black/10 pt-7 text-sm leading-[1.75] dark:border-white/10" onClick={event => { const target = event.target as HTMLElement; const action = target.closest<HTMLElement>("[data-comment-action]"); if (action) { const clause = action.closest("li"); const clone = clause?.cloneNode(true) as HTMLElement | null; clone?.querySelectorAll("button").forEach(button => button.remove()); setCommentClause({ id: action.dataset.commentAction || "", index: Number(action.dataset.clauseIndex), quotedText: clone?.innerText.trim().slice(0, 1000) || "" }); } }} dangerouslySetInnerHTML={{ __html: decorateClauses(contract.bodyHtml, contract.status !== "executed") }} />{contract.status !== "executed" && commentClause && <form onSubmit={addComment} className="mt-6 rounded-lg border border-[#8B2635]/25 bg-[#8B2635]/5 p-4"><p className="mb-2 text-xs font-bold text-[#8B2635]">Comment on clause {commentClause.index}</p><input value={commentAuthor} onChange={event => setCommentAuthor(event.target.value)} className="mb-2 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1B1011]" placeholder="Your name" aria-label="Your name" required /><textarea value={commentText} onChange={event => setCommentText(event.target.value)} className="mb-3 min-h-20 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1B1011]" placeholder="Suggest a change or ask a question…" aria-label="Comment" required /><div className="flex justify-end gap-2"><button type="button" onClick={() => setCommentClause(null)} className="rounded px-3 py-2 text-xs font-semibold text-black/55 dark:text-white/55">Cancel</button><button type="submit" disabled={commentSaving} className="rounded bg-[#8B2635] px-3 py-2 text-xs font-bold text-white">{commentSaving ? "Adding…" : "Add comment"}</button></div></form>}{comments.length > 0 && <div className="mt-7 border-t border-black/10 pt-5 dark:border-white/10"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B2635]">Discussion</p>{comments.map(comment => <div key={comment.id} className="mb-3 rounded-lg border border-[#8B2635]/15 bg-[#8B2635]/5 p-3"><p className="mb-1 text-[11px] font-bold text-[#8B2635]">Clause {comment.clauseIndex || comment.clauseId || "?"} · {comment.authorName}</p>{comment.quotedText && <p className="border-l-2 border-[#8B2635]/30 pl-2 text-xs italic text-black/50 dark:text-white/50">“{comment.quotedText}”</p>}<p className="text-xs leading-relaxed">{comment.body}</p></div>)}</div>}</article>
          <aside className="h-fit rounded-xl border border-black/10 bg-[#FAF6F2] p-6 dark:border-white/10 dark:bg-[#160B0C]"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B2635] dark:text-[#C1445A]">Your signature</p><h2 className="mb-3 pactum-display text-2xl font-bold">{contract.status === "executed" ? "Executed contract" : "Review and sign"}</h2><p className="mb-5 text-xs leading-relaxed text-black/55 dark:text-white/55">{contract.status === "executed" ? "This contract is executed. The document and review history remain readable." : <>This contract was sent to <strong>{invitation.email}</strong>. Add comments to any clause before you sign.</>}</p>{contract.status !== "executed" && <><button type="button" disabled={signing} onClick={() => void claimInvitation()} className="mb-3 w-full rounded bg-[#C1445A] px-4 py-3 text-sm font-bold text-[#0F0708] hover:bg-[#E0637A]">{signing ? "Claiming…" : "Access with an account"}</button><button type="button" disabled={signing} onClick={() => setGuestOpen(true)} className="w-full rounded border border-[#8B2635]/35 px-4 py-3 text-sm font-semibold text-[#8B2635] hover:bg-[#8B2635]/10 dark:border-[#C1445A]/35 dark:text-[#E0637A]">Sign as a guest</button></>}{guestOpen && contract.status !== "executed" && <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10"><label className="mb-2 block text-xs font-semibold" htmlFor="guest-name">Full name</label><input id="guest-name" value={signerName} onChange={event => setSignerName(event.target.value)} className="mb-3 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#8B2635] dark:border-white/10 dark:bg-[#1B1011]" placeholder="Your legal name" /><button type="button" disabled={signing || !signerName.trim()} onClick={() => sign("guest")} className="w-full rounded bg-[#8B2635] px-4 py-3 text-sm font-bold text-white hover:bg-[#A8334A]">{signing ? "Signing..." : "Confirm guest signature"}</button></div>}{error && <p className="mt-4 text-xs text-[#8B2635] dark:text-[#E0637A]">{error}</p>}<p className="mt-5 text-[11px] leading-relaxed text-black/40 dark:text-white/40">By signing, you confirm that you reviewed the contract and intend to be legally bound by the contract.</p></aside>
        </div>
      </div>
    </main>
  );
}
