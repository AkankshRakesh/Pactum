"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { CommentDeleteButton, CommentStatusBadge, type CommentStatus } from "./CommentStatus";
import { useConfirm } from "./ConfirmDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type Comment = { id: number; clauseId?: string; clauseIndex?: number | null; quotedText?: string; authorName: string; authorUserId?: number | null; body: string; createdAt: string; status?: CommentStatus };
type Contract = { id: string; title: string; subtitle: string; bodyHtml: string; status: string; invitedEmail?: string; invitationStatus?: string; comments?: Comment[] };
type ClauseBox = { id: string; top: number; height: number };

function sortCommentsLatestFirst(comments: Comment[]) {
  return [...comments].sort((left, right) => {
    const timeDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return timeDifference || right.id - left.id;
  });
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return { detail: text }; }
}

const styles = {
  workspace: "min-h-screen bg-[#f3eee8] pactum-body text-[#1a0f10] dark:bg-[#0f0708] dark:text-[#f0e8e8]",
  appBar: "sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b border-black/10 bg-[#faf6f2] px-6 dark:border-white/10 dark:bg-[#160b0c]",
  brandGroup: "flex items-center gap-2.5",
  iconButton: "grid h-8 w-8 place-items-center border-0 bg-transparent text-xl text-black/50 hover:text-[#8b2635] dark:text-white/50 dark:hover:text-[#e0637a]",
  brandMark: "grid h-7 w-7 place-items-center border border-[#8b2635]/45 bg-[#8b2635]/10 text-sm font-bold text-[#8b2635] dark:border-[#c1445a]/45 dark:bg-[#c1445a]/10 dark:text-[#c1445a]",
  brandName: "pactum-display text-[17px] font-bold",
  documentName: "flex min-w-0 max-w-[420px] flex-1 flex-col items-center gap-px",
  documentTitleInput: "w-full border-0 bg-transparent text-center text-sm font-semibold text-[#1a0f10] outline-none dark:text-[#f0e8e8]",
  saveStatus: "text-[10px] text-black/50 dark:text-white/50",
  appActions: "flex items-center gap-2.5",
  ghostButton: "hidden rounded-md border border-black/10 bg-transparent px-3.5 py-2 text-xs font-semibold hover:border-[#8b2635] hover:text-[#8b2635] dark:border-white/10 dark:hover:border-[#c1445a] dark:hover:text-[#e0637a] sm:block",
  primaryButton: "rounded-md border border-transparent bg-[#8b2635] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#a8334a] dark:bg-[#c1445a] dark:hover:bg-[#e0637a]",
  avatar: "grid h-8 w-8 place-items-center rounded-full border border-[#8b2635] bg-[#8b2635]/10 text-xs font-bold text-[#8b2635] dark:border-[#c1445a] dark:bg-[#c1445a]/10 dark:text-[#c1445a]",
  editorBar: "flex min-h-12 items-center justify-between gap-4 overflow-x-auto border-b border-black/10 bg-[#faf6f2] px-3 dark:border-white/10 dark:bg-[#160b0c]",
  toolbarGroup: "flex shrink-0 items-center gap-1.5",
  editorTools: "flex shrink-0 items-center gap-1.5",
  select: "border-0 bg-transparent px-1 py-1.5 text-xs outline-none dark:bg-[#160b0c]",
  divider: "mx-1 h-5 w-px bg-black/10 dark:bg-white/10",
  toolButton: "grid h-8 w-8 place-items-center border-0 bg-transparent font-serif text-[15px] font-semibold text-black/60 hover:bg-black/5 hover:text-[#8b2635] dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-[#e0637a]",
  italic: "italic",
  textButton: "border-0 bg-transparent px-2.5 py-2 text-xs font-semibold text-[#8b2635] hover:bg-[#8b2635]/10 dark:text-[#c1445a] dark:hover:bg-[#c1445a]/10",
  body: "grid min-h-[calc(100dvh-106px)] grid-cols-1 xl:grid-cols-[220px_minmax(500px,1fr)_240px]",
  outline: "hidden border-r border-black/10 bg-[#faf6f2] p-7 px-5 dark:border-white/10 dark:bg-[#160b0c] xl:block",
  inspector: "hidden border-l border-black/10 bg-[#faf6f2] p-7 px-5 dark:border-white/10 dark:bg-[#160b0c] xl:block",
  eyebrow: "mb-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2635] dark:text-[#c1445a]",
  outlineActive: "block w-full border-0 border-l-2 border-[#8b2635] bg-[#8b2635]/10 px-2.5 py-2 text-left text-xs text-[#8b2635] dark:border-[#c1445a] dark:bg-[#c1445a]/10 dark:text-[#e0637a]",
  canvas: "min-w-0 overflow-auto bg-[#f3eee8] px-7 pb-20 pt-10 dark:bg-[#0f0708]",
  paper: "mx-auto min-h-[1060px] w-full max-w-[820px] bg-[#fffdfb] shadow-[0_3px_18px_rgba(26,15,16,0.08)] dark:bg-[#1b1011]",
  document: "min-h-[900px] p-[44px_28px] pactum-body text-sm leading-[1.75] outline-none sm:min-h-[1060px] sm:p-[82px_90px] sm:text-[15px]",
  kicker: "mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b2635] dark:text-[#c1445a]",
  subtext: "min-h-7 text-sm text-black/50 dark:text-white/50",
  partyCard: "flex items-center gap-2.5 py-2.5",
  partyAvatar: "grid h-8 w-8 place-items-center rounded-full bg-[#8b2635]/10 text-xs font-bold text-[#8b2635] dark:bg-[#c1445a]/10 dark:text-[#c1445a]",
  invitedAvatar: "border border-dashed border-[#8b2635] bg-transparent dark:border-[#c1445a]",
  statusDot: "ml-auto h-2 w-2 rounded-full bg-[#3c9b68]",
  inspectorAction: "my-3 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-left text-xs font-semibold hover:border-[#8b2635] hover:text-[#8b2635] dark:border-white/10 dark:hover:border-[#c1445a] dark:hover:text-[#e0637a]",
  inspectorRule: "-mx-5 my-6 h-px bg-black/10 dark:bg-white/10",
  setting: "flex justify-between gap-2 border-b border-black/10 py-2 text-[11px] text-black/50 dark:border-white/10 dark:text-white/50",
  enabled: "text-[#3c9b68]",
  modalBackdrop: "fixed inset-0 z-30 grid place-items-center bg-[#0f0708]/55 p-5 backdrop-blur-sm",
  inviteModal: "w-full max-w-[440px] rounded-xl border border-[#8b2635]/35 bg-[#faf6f2] p-7 shadow-[0_20px_70px_rgba(15,7,8,0.3)] dark:border-[#c1445a]/35 dark:bg-[#160b0c]",
  clauseRail: "flex w-8 shrink-0 flex-col gap-3",
  deleteClauseButton: "grid h-7 w-7 place-items-center rounded border border-transparent bg-transparent text-sm text-black/35 hover:border-[#8b2635]/40 hover:bg-[#8b2635]/10 hover:text-[#8b2635] dark:text-white/35 dark:hover:border-[#c1445a]/40 dark:hover:bg-[#c1445a]/10 dark:hover:text-[#e0637a]",
  modalHeader: "mb-6 flex items-start justify-between",
  closeButton: "border-0 bg-transparent text-2xl text-black/45 hover:text-[#8b2635] dark:text-white/45 dark:hover:text-[#e0637a]",
  formLabel: "mb-1.5 block text-[11px] font-bold",
  formInput: "w-full rounded-md border border-black/10 bg-[#fffdfb] px-3 py-2.5 text-[13px] outline-none focus:border-[#8b2635] focus:ring-4 focus:ring-[#8b2635]/10 dark:border-white/10 dark:bg-[#1b1011] dark:focus:border-[#c1445a] dark:focus:ring-[#c1445a]/10",
  formHint: "text-xs leading-normal text-black/50 dark:text-white/50",
  inviteSuccess: "border border-[#8b2635] bg-[#8b2635]/10 p-3.5 text-[13px] leading-relaxed dark:border-[#c1445a] dark:bg-[#c1445a]/10",
};

export default function ContractReview({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");     // full-page error (load failed)
  const [actionError, setActionError] = useState(""); // inline banner (comment/sign failed)
  const [activeClause, setActiveClause] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [boxes, setBoxes] = useState<ClauseBox[]>([]);
  const paperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { confirm, dialog } = useConfirm();

  // ── load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    async function loadContract(showLoading = false) {
      try {
        if (showLoading) setLoading(true);
        const response = await fetch(`${API_BASE}/api/contracts/${contractId}/review/`, { credentials: "include", signal: controller.signal });
        const result = await readResponse(response);
        if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to load contract (${response.status}).`);
        const nextContract = result.contract as Contract;
        setContract({ ...nextContract, comments: sortCommentsLatestFirst(nextContract.comments || []) });
        setCurrentUserId(typeof result.currentUserId === "number" ? result.currentUserId : null);
      } catch (error) {
        if (!controller.signal.aborted && showLoading) setLoadError(error instanceof Error ? error.message : "Unable to load contract.");
      } finally {
        if (!controller.signal.aborted && showLoading) setLoading(false);
      }
    }

    void loadContract(true);
    const interval = window.setInterval(() => void loadContract(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [contractId]);

  // ── measure clause positions (relative to the paper) ──────────────
  const measure = useCallback(() => {
    const paper = paperRef.current;
    const content = contentRef.current;
    if (!paper || !content) return;
    const paperTop = paper.getBoundingClientRect().top;
    setBoxes(Array.from(content.querySelectorAll<HTMLElement>("ol > li"), li => {
      const rect = li.getBoundingClientRect();
      return { id: li.getAttribute("data-clause-id") || "", top: rect.top - paperTop, height: rect.height };
    }));
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [contract?.bodyHtml, measure]);

  // ── overlays: Escape, scroll lock, focus ──────────────────────────
  useEffect(() => {
    if (!panelOpen && activeClause === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setPanelOpen(false); setActiveClause(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, activeClause]);

  useEffect(() => {
    if (!panelOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [panelOpen]);

  useEffect(() => {
    if (activeClause !== null) textareaRef.current?.focus();
  }, [activeClause]);

  // ── helpers ───────────────────────────────────────────────────────
  const comments = contract?.comments || [];
  const editable = contract ? contract.status !== "executed" : false;

  function clauseIndexOf(comment: Comment) {
    if (comment.clauseId) return boxes.findIndex(box => box.id === comment.clauseId); // -1 = clause was removed
    return comment.clauseIndex ? comment.clauseIndex - 1 : -1;
  }
  const commentsFor = (index: number) => comments.filter(comment => clauseIndexOf(comment) === index);

  function openClause(index: number) {
    if (activeClause !== index) setDraft("");
    setActiveClause(activeClause === index ? null : index);
  }

  function jumpTo(index: number) {
    setPanelOpen(false);
    contentRef.current?.querySelectorAll("ol > li")[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveClause(index);
  }

  async function csrfToken() {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
    const result = await readResponse(response);
    if (!response.ok || typeof result.csrfToken !== "string") throw new Error("Unable to establish a secure session.");
    return result.csrfToken;
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeClause === null || !draft.trim() || saving || !editable) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/comments/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
        body: JSON.stringify({ clauseId: boxes[activeClause]?.id || "", clauseIndex: activeClause + 1, body: draft.trim() }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to add comment (${response.status}).`);
      setContract(current => current ? { ...current, comments: sortCommentsLatestFirst([...(current.comments || []), result.comment as Comment]) } : current);
      setDraft(""); // popover stays open so the new comment appears in the thread
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to add comment.");
    } finally {
      setSaving(false);
    }
  }

  async function signContract() {
    if (!contract || !editable || signing) return;
    const ok = await confirm({
      eyebrow: "Final step",
      title: "Sign this contract?",
      message: "Signing is final. The contract will be executed and can no longer be edited or commented on.",
      confirmLabel: "Sign contract",
    });
    if (!ok) return;
    setSigning(true);
    setActionError("");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/sign/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": await csrfToken() },
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to sign contract (${response.status}).`);
      setActiveClause(null);
      setContract(current => current ? { ...current, status: "executed" } : current);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to sign contract.");
    } finally {
      setSigning(false);
    }
  }

  async function deleteComment(comment: Comment) {
    if (!editable || deletingId !== null) return;
    const ok = await confirm({
      eyebrow: "Delete comment",
      title: "Delete this comment?",
      message: "It will be removed for everyone on this contract, whatever its status. This can't be undone.",
      confirmLabel: "Delete comment",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(comment.id);
    setActionError("");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/comments/${comment.id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRFToken": await csrfToken() },
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Unable to delete comment (${response.status}).`);
      setContract(current => current ? { ...current, comments: (current.comments || []).filter(c => c.id !== comment.id) } : current);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete comment.");
    } finally {
      setDeletingId(null);
    }
  }

  function deleteControl(comment: Comment) {
    if (!editable || comment.authorUserId == null || comment.authorUserId !== currentUserId) return null;
    return (
      <div className="mt-2 flex gap-1.5">
        <CommentDeleteButton busy={deletingId === comment.id} onClick={() => void deleteComment(comment)} />
      </div>
    );
  }

  // ── early returns (after all hooks) ───────────────────────────────
  if (loading) return <main className={`${styles.workspace} grid place-items-center text-sm`}>Loading contract…</main>;
  if (loadError || !contract) {
    return (
      <main className={`${styles.workspace} grid place-items-center p-6 text-center`}>
        <div>
          <p className="text-sm text-[#8b2635] dark:text-[#e0637a]">{loadError || "Contract not found."}</p>
          <button type="button" className={`${styles.primaryButton} mt-4`} onClick={() => router.push("/dashboard")}>Back to dashboard</button>
        </div>
      </main>
    );
  }

  // ── sidebar / sheet content (shared) ──────────────────────────────
  const sidePanel = (
    <>
      <p className={styles.eyebrow}>Review</p>
      <div className={styles.partyCard}>
        <div className={styles.partyAvatar}>Y</div>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold">{contract.invitedEmail || "You"}</strong>
          <span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">Reviewer · You</span>
        </div>
        <i className={styles.statusDot} />
      </div>
      <div className={styles.inspectorRule} />
      <p className={styles.eyebrow}>Document settings</p>
      <div className={styles.setting}><span>Document status</span><strong className={editable ? styles.enabled : "text-[#8b2635]"}>{editable ? "Open for review" : "Executed · Read only"}</strong></div>
      <div className={styles.setting}><span>Clauses</span><strong>{boxes.length}</strong></div>
      <div className={styles.inspectorRule} />
      <p className={styles.eyebrow}>Review comments · {comments.length}</p>
      {comments.length === 0 ? (
        <p className="text-xs leading-relaxed text-black/40 dark:text-white/40">{editable ? "Tap the + beside any clause to add a comment." : "No comments were made."}</p>
      ) : comments.map(comment => {
        const index = clauseIndexOf(comment);
        return (
          <div key={comment.id} className="mb-3 rounded-md border border-[#8b2635]/15 bg-[#8b2635]/5 p-2.5">
            <button type="button" disabled={index < 0} onClick={() => jumpTo(index)} className="block w-full text-left disabled:cursor-default">
              <p className="text-[10px] font-bold text-[#8b2635] dark:text-[#e0637a]">
                {comment.authorName} · {index >= 0 ? `Clause ${index + 1}` : "Removed clause"} <CommentStatusBadge status={comment.status} />
              </p>
              <p className="text-[9px] text-black/40 dark:text-white/40">{new Date(comment.createdAt).toLocaleString()}</p>
              {comment.quotedText && <p className="mt-1 border-l-2 border-[#8b2635]/30 pl-2 text-[10px] italic text-black/50 dark:text-white/50">“{comment.quotedText}”</p>}
              <p className="mt-1 text-[11px] leading-relaxed">{comment.body}</p>
            </button>
            {deleteControl(comment)}
          </div>
        );
      })}
    </>
  );

  return (
    <main className={styles.workspace}>
      {/* app bar */}
      <header className={styles.appBar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} type="button" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard" title="Back to dashboard">←</button>
        </div>
        <div className={styles.documentName}>
          <span className="w-full truncate text-center text-sm font-semibold">{contract.title}</span>
          <span className={styles.saveStatus}>{editable ? "Review only" : "Executed · Read only"}</span>
        </div>
        <div className={styles.appActions}>
          {editable && (
            <button className={`${styles.primaryButton} disabled:opacity-50`} type="button" disabled={signing} onClick={() => void signContract()}>
              {signing ? "Signing…" : "Sign contract"}
            </button>
          )}
        </div>
      </header>

      {/* sub-bar (mirrors the editor toolbar row) */}
      <div className={styles.editorBar}>
        <div className={styles.toolbarGroup}>
          <span className="text-xs text-black/50 dark:text-white/50">{editable ? "Tap a marker beside a clause to comment" : "This contract has been executed"}</span>
        </div>
        <div className={styles.editorTools}>
          <button type="button" className={`${styles.textButton} xl:hidden`} onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setActiveClause(null); setPanelOpen(true); }}>
            Comments · {comments.length}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 border-b border-[#8b2635]/20 bg-[#8b2635]/10 px-6 py-2 text-xs text-[#8b2635] dark:text-[#e0637a]" role="alert">
          <span>{actionError}</span>
          <button type="button" className={styles.closeButton} onClick={() => setActionError("")} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className={styles.body}>
        {/* outline */}
        <aside className={styles.outline}>
          <p className={styles.eyebrow}>Document outline</p>
          {boxes.length === 0 ? (
            <p className="text-xs leading-relaxed text-black/40 dark:text-white/40">No clauses in this contract.</p>
          ) : boxes.map((box, index) => {
            const count = commentsFor(index).length;
            return (
              <button key={box.id || index} type="button" className={`${styles.outlineActive} flex items-center justify-between`} onClick={() => jumpTo(index)}>
                <span>Clause {index + 1}</span>
                {count > 0 && <span className="rounded-full bg-[#8b2635] px-1.5 text-[10px] font-bold text-white dark:bg-[#c1445a]">{count}</span>}
              </button>
            );
          })}
        </aside>

        {/* paper */}
        <section className={styles.canvas} aria-label="Contract document">
          <div className="mx-auto w-full max-w-215">
            <div ref={paperRef} className={`${styles.paper} relative`}>
              <div className={styles.document}>
                <div ref={contentRef} dangerouslySetInnerHTML={{ __html: contract.bodyHtml }} />
              </div>

              {/* highlight for the active clause (overlay, so the document HTML is never touched) */}
              {activeClause !== null && boxes[activeClause] && (
                <div
                  className="pointer-events-none absolute inset-x-2 rounded bg-[#8b2635]/[0.07] ring-1 ring-[#8b2635]/20 sm:inset-x-6"
                  style={{ top: boxes[activeClause].top - 4, height: boxes[activeClause].height + 8 }}
                />
              )}

              {/* clause markers + popover */}
              {boxes.map((box, index) => {
                const list = commentsFor(index);
                if (!editable && list.length === 0) return null;
                const open = activeClause === index;
                return (
                  <div key={box.id || index}>
                    <button
                      type="button"
                      onClick={() => openClause(index)}
                      style={{ top: box.top + 2 }}
                      aria-expanded={open}
                      aria-label={list.length ? `${list.length} comment${list.length > 1 ? "s" : ""} on clause ${index + 1}` : `Add comment on clause ${index + 1}`}
                      className={`absolute right-1 z-[5] grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold shadow-sm sm:right-4 ${
                        list.length
                          ? "bg-[#8b2635] text-white hover:bg-[#a8334a] dark:bg-[#c1445a] dark:hover:bg-[#e0637a]"
                          : "border border-[#8b2635]/40 bg-[#fffdfb] text-[#8b2635] opacity-70 hover:opacity-100 dark:border-[#c1445a]/50 dark:bg-[#1b1011] dark:text-[#e0637a]"
                      }`}
                    >
                      {list.length || "+"}
                    </button>

                    {open && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveClause(null)} />
                        <div
                          role="dialog"
                          aria-label={`Comments on clause ${index + 1}`}
                          style={{ top: box.top + 30 }}
                          className="absolute right-2 z-20 max-h-[70vh] w-[min(320px,calc(100%-16px))] overflow-y-auto rounded-xl border border-[#8b2635]/25 bg-[#faf6f2] p-3.5 text-[#1a0f10] shadow-[0_12px_40px_rgba(15,7,8,0.25)] sm:right-4 dark:border-[#c1445a]/30 dark:bg-[#160b0c] dark:text-[#f0e8e8]"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className={`${styles.eyebrow} !mb-0`}>Clause {index + 1}</p>
                            <button type="button" className={styles.closeButton} onClick={() => setActiveClause(null)} aria-label="Close comments">×</button>
                          </div>

                          {list.map(comment => (
                            <div key={comment.id} className="mb-2.5 border-b border-black/10 pb-2.5 dark:border-white/10">
                              <p className="text-[11px] font-bold text-[#8b2635] dark:text-[#e0637a]">
                                {comment.authorName} <span className="font-normal text-black/40 dark:text-white/40">· {new Date(comment.createdAt).toLocaleString()}</span> <CommentStatusBadge status={comment.status} />
                              </p>
                              {comment.quotedText && <p className="mt-1 border-l-2 border-[#8b2635]/30 pl-2 text-[11px] italic text-black/50 dark:text-white/50">“{comment.quotedText}”</p>}
                              <p className="mt-1 text-xs leading-relaxed">{comment.body}</p>
                              {deleteControl(comment)}
                            </div>
                          ))}

                          {editable ? (
                            <form onSubmit={addComment}>
                              <label htmlFor="review-comment" className="sr-only">Comment on clause {index + 1}</label>
                              <textarea
                                ref={textareaRef}
                                id="review-comment"
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                                disabled={saving}
                                placeholder="Suggest a change or ask a question…"
                                className={`${styles.formInput} min-h-20 resize-y leading-relaxed`}
                              />
                              <div className="mt-2.5 flex justify-end gap-2">
                                <button type="button" className={styles.textButton} onClick={() => setActiveClause(null)}>Cancel</button>
                                <button type="submit" className={`${styles.primaryButton} disabled:opacity-50`} disabled={saving || !draft.trim()}>{saving ? "Adding…" : "Add comment"}</button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className={styles.inspector}>{sidePanel}</aside>
      </div>

      {/* bottom sheet (phones) / slide-over (sm+), hidden at xl where the sidebar shows */}
      {panelOpen && (
        <div className="fixed inset-0 z-20 xl:hidden" role="dialog" aria-modal="true" aria-label="Review comments">
          <div className="absolute inset-0 bg-[#0f0708]/45" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-black/10 bg-[#faf6f2] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,7,8,0.25)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[340px] sm:rounded-none sm:border-l sm:border-t-0 dark:border-white/10 dark:bg-[#160b0c]">
            <div className="mb-4 flex items-center">
              <span className="mx-auto h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />
              <button type="button" className={`${styles.closeButton} ml-auto`} onClick={() => setPanelOpen(false)} aria-label="Close panel">×</button>
            </div>
            {sidePanel}
          </div>
        </div>
      )}
      {dialog}
    </main>
  );
}
