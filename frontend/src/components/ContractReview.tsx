"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
const PANEL_WIDTH = 344;
const VIEWPORT_PADDING = 16;
const PANEL_GAP = 20;

type Comment = {
  id: number;
  clauseId?: string;
  clauseIndex?: number | null;
  quotedText?: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type Contract = {
  id: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  status: string;
  invitedEmail?: string;
  invitationStatus?: string;
  comments?: Comment[];
};

type SelectedClause = {
  id: string;
  index: number;
  element: HTMLElement;
  trigger: HTMLButtonElement;
};

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  mode: "margin" | "overlay";
};

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { detail: text };
  }
}

function decorateClauses(html: string, editable: boolean) {
  if (typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("ol > li").forEach((clause, index) => {
    if (!editable) return;
    const id = clause.getAttribute("data-clause-id") || "";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "＋ Comment";
    button.setAttribute("data-comment-action", id);
    button.setAttribute("data-clause-index", String(index + 1));
    button.setAttribute("aria-label", `Comment on clause ${index + 1}`);
    button.className = "float-right ml-3 inline-flex cursor-pointer items-center rounded border-0 bg-transparent px-1.5 py-0.5 text-[10px] font-semibold text-[#8b2635] hover:bg-[#8b2635]/10 focus:outline-none focus:ring-2 focus:ring-[#8b2635]/40 dark:text-[#e0637a]";
    clause.insertBefore(button, clause.firstChild);
  });
  return document.body.innerHTML;
}

export default function ContractReview({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentClause, setCommentClause] = useState<SelectedClause | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadContract() {
      try {
        const response = await fetch(`${API_BASE}/api/contracts/${contractId}/review/`, {
          credentials: "include",
          signal: controller.signal,
        });
        const result = await readResponse(response);
        if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to load contract (${response.status}).`);
        setContract(result.contract as Contract);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Unable to load contract.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadContract();
    return () => controller.abort();
  }, [contractId]);

  async function csrfToken() {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
    const result = await readResponse(response);
    if (!response.ok || typeof result.csrfToken !== "string") throw new Error("Unable to establish a secure session.");
    return result.csrfToken;
  }

  const closeComposer = useCallback((clearDraft = true) => {
    const trigger = commentClause?.trigger;
    setCommentClause(null);
    setPanelPosition(null);
    if (clearDraft) setCommentText("");
    window.requestAnimationFrame(() => trigger?.focus());
  }, [commentClause]);

  function selectClause(action: HTMLButtonElement) {
    const element = action.closest("li");
    if (!element) return;
    const next: SelectedClause = {
      id: action.dataset.commentAction || "",
      index: Number(action.dataset.clauseIndex) || 0,
      element,
      trigger: action,
    };
    selectedElementRef.current = element;
    if (!commentClause || commentClause.id !== next.id || commentClause.index !== next.index) setCommentText("");
    setCommentClause(next);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentClause || !commentText.trim() || commentSaving || contract?.status === "executed") return;
    setCommentSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/comments/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
        body: JSON.stringify({ clauseId: commentClause.id, clauseIndex: commentClause.index, body: commentText }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to add comment (${response.status}).`);
      setContract(current => current ? { ...current, comments: [...(current.comments || []), result.comment as Comment] } : current);
      setCommentText("");
      closeComposer(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function signContract() {
    if (!contract || contract.status === "executed" || signing) return;
    setSigning(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/sign/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": await csrfToken() },
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to sign contract (${response.status}).`);
      closeComposer(true);
      setContract(current => current ? { ...current, status: "executed" } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign contract.");
    } finally {
      setSigning(false);
    }
  }

  useLayoutEffect(() => {
    if (!commentClause || !articleRef.current) return;
    let frame = 0;
    const reposition = () => {
      frame = window.requestAnimationFrame(() => {
        if (!commentClause.element.isConnected || !articleRef.current) return;
        const clauseRect = commentClause.element.getBoundingClientRect();
        const paperRect = articleRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_PADDING * 2);
        const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - 280);
        const marginLeft = paperRect.right + PANEL_GAP;
        const fitsBesidePaper = marginLeft + width <= viewportWidth - VIEWPORT_PADDING;
        if (fitsBesidePaper) {
          setPanelPosition({ left: marginLeft, top: Math.min(Math.max(clauseRect.top, VIEWPORT_PADDING), maxTop), width, mode: "margin" });
          return;
        }
        const overlayTop = clauseRect.bottom + 12 > window.innerHeight - 280 ? clauseRect.top - 292 : clauseRect.bottom + 12;
        const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING);
        setPanelPosition({
          left: Math.min(Math.max(clauseRect.left, VIEWPORT_PADDING), maxLeft),
          top: Math.min(Math.max(overlayTop, VIEWPORT_PADDING), maxTop),
          width,
          mode: "overlay",
        });
      });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.cancelAnimationFrame(frame);
    };
  }, [commentClause, commentText]);

  useEffect(() => {
    if (!commentClause) return;
    const element = selectedElementRef.current;
    if (!element) return;
    const previous = {
      background: element.style.backgroundColor,
      shadow: element.style.boxShadow,
      radius: element.style.borderRadius,
    };
    element.style.backgroundColor = "rgba(139, 38, 53, 0.08)";
    element.style.boxShadow = "0 0 0 3px rgba(139, 38, 53, 0.12)";
    element.style.borderRadius = "4px";
    return () => {
      element.style.backgroundColor = previous.background;
      element.style.boxShadow = previous.shadow;
      element.style.borderRadius = previous.radius;
    };
  }, [commentClause]);

  useEffect(() => {
    if (!commentClause) return;
    textareaRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeComposer(true);
    }
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [commentClause, closeComposer]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f3eee8] p-6 text-sm dark:bg-[#0f0708]">Loading contract…</main>;
  if (error || !contract) return <main className="grid min-h-screen place-items-center bg-[#f3eee8] p-6 text-center dark:bg-[#0f0708]"><div><p className="text-sm text-[#8b2635] dark:text-[#e0637a]">{error || "Contract not found."}</p><button type="button" className="mt-4 rounded border border-black/15 px-4 py-2 text-xs font-semibold" onClick={() => router.push("/dashboard")}>Back to dashboard</button></div></main>;

  const editable = contract.status !== "executed";
  const comments = contract.comments || [];
  const composer = mounted && editable && commentClause && panelPosition ? createPortal(
    <form
      ref={panelRef}
      onSubmit={addComment}
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      className="fixed z-[100] rounded-xl border border-[#8b2635]/25 bg-[#fffdfb] p-4 text-[#1a0f10] shadow-[0_16px_45px_rgba(26,15,16,0.2)] dark:border-[#c1445a]/35 dark:bg-[#1b1011] dark:text-[#f0e8e8]"
      style={{ left: panelPosition.left, top: panelPosition.top, width: panelPosition.width, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}
      aria-label={`Comment on clause ${commentClause.index}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2635] dark:text-[#e0637a]">Clause {commentClause.index}</p><p className="mt-1 text-sm font-semibold">Add a review comment</p></div>
        <button type="button" onClick={() => closeComposer(true)} className="rounded p-1 text-lg leading-none text-black/45 hover:bg-black/5 hover:text-[#8b2635] focus:outline-none focus:ring-2 focus:ring-[#8b2635]/40 dark:text-white/45" aria-label="Close comment composer">×</button>
      </div>
      <label htmlFor="contract-review-comment" className="sr-only">Comment on clause {commentClause.index}</label>
      <textarea ref={textareaRef} id="contract-review-comment" value={commentText} onChange={event => setCommentText(event.target.value)} className="min-h-24 w-full resize-y rounded-lg border border-black/15 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#8b2635] focus:ring-2 focus:ring-[#8b2635]/20 dark:border-white/15 dark:bg-[#12090a]" placeholder="Suggest a change or ask a question…" disabled={commentSaving} />
      {error && <p className="mt-2 text-xs text-[#8b2635] dark:text-[#e0637a]">{error}</p>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => closeComposer(true)} className="rounded px-3 py-2 text-xs font-semibold text-black/55 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#8b2635]/40 dark:text-white/55">Cancel</button><button type="submit" disabled={commentSaving || !commentText.trim()} className="rounded bg-[#8b2635] px-3 py-2 text-xs font-bold text-white hover:bg-[#a8334a] disabled:cursor-not-allowed disabled:opacity-50">{commentSaving ? "Adding…" : "Add comment"}</button></div>
    </form>,
    document.body,
  ) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3eee8] px-4 py-6 text-[#1a0f10] pactum-body dark:bg-[#0f0708] dark:text-[#f0e8e8] sm:px-6">
      {composer}
      <div className="mx-auto max-w-[1220px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => router.push("/dashboard")} className="text-xs font-semibold text-[#8b2635] hover:underline dark:text-[#e0637a]">← Dashboard</button><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b2635] dark:text-[#e0637a]">Review contract</p><span className="rounded-full border border-black/10 px-3 py-1 text-[10px] font-semibold dark:border-white/10">{editable ? "Review only" : "Executed · Read only"}</span></header>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,820px)_260px] xl:justify-center">
          <article ref={articleRef} className="min-h-[900px] min-w-0 bg-[#fffdfb] p-7 shadow-[0_8px_35px_rgba(26,15,16,0.08)] dark:bg-[#1b1011] sm:p-14">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b2635] dark:text-[#c1445a]">Contract for review</p>
            <h1 className="mb-2 pactum-display text-3xl font-bold">{contract.title}</h1>
            {contract.subtitle && <p className="mb-8 text-sm text-black/50 dark:text-white/50">{contract.subtitle}</p>}
            <div className="border-t border-black/10 pt-7 text-sm leading-[1.75] dark:border-white/10" onClick={event => { const target = event.target; if (!(target instanceof Element)) return; const action = target.closest<HTMLButtonElement>("button[data-comment-action]"); if (!action) return; event.preventDefault(); event.stopPropagation(); selectClause(action); }} dangerouslySetInnerHTML={{ __html: decorateClauses(contract.bodyHtml, editable) }} />
            {comments.length > 0 && <div className="mt-7 border-t border-black/10 pt-5 dark:border-white/10"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2635]">Discussion</p>{comments.map(comment => <div key={comment.id} className="mb-3 rounded-lg border border-[#8b2635]/15 bg-[#8b2635]/5 p-3"><p className="mb-1 text-[11px] font-bold text-[#8b2635]">Clause {comment.clauseIndex || comment.clauseId || "?"} · {comment.authorName}</p>{comment.quotedText && <p className="border-l-2 border-[#8b2635]/30 pl-2 text-xs italic text-black/50 dark:text-white/50">“{comment.quotedText}”</p>}<p className="text-xs leading-relaxed">{comment.body}</p></div>)}</div>}
          </article>
          <aside className="h-fit rounded-xl border border-black/10 bg-[#faf6f2] p-5 dark:border-white/10 dark:bg-[#160b0c]"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b2635] dark:text-[#c1445a]">Review</p><h2 className="mb-3 pactum-display text-2xl font-bold">{editable ? "Review and sign" : "Executed contract"}</h2><p className="text-xs leading-relaxed text-black/55 dark:text-white/55">{editable ? `This contract was shared with ${contract.invitedEmail || "you"}. Add comments to any clause before signing.` : "The document and review history remain readable after execution."}</p>{editable && <><button type="button" disabled={signing} onClick={() => void signContract()} className="mt-5 w-full rounded bg-[#8b2635] px-4 py-3 text-sm font-bold text-white hover:bg-[#a8334a] disabled:cursor-not-allowed disabled:opacity-50">{signing ? "Signing…" : "Sign contract"}</button>{error && <p className="mt-3 text-xs text-[#8b2635] dark:text-[#e0637a]">{error}</p>}</>}</aside>
        </div>
      </div>
    </main>
  );
}
