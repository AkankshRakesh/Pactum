"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ContractLoader from "../app/ContractLoader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

type User = { id: number; username: string; email: string };
type ContractComment = { id: number; clauseId?: string; clauseIndex?: number | null; quotedText?: string; authorName: string; body: string; createdAt: string };
type ContractRecord = { id: string; title: string; subtitle: string; bodyHtml: string; status: string; invitedEmail?: string; invitationStatus?: string; comments?: ContractComment[] };
type Format = "bold" | "italic" | "underline" | "insertUnorderedList";

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

const toolbarItems: Array<{ label: string; value: Format; icon: string }> = [
  { label: "Bold", value: "bold", icon: "B" },
  { label: "Italic", value: "italic", icon: "I" },
  { label: "Underline", value: "underline", icon: "U" },
  { label: "Bulleted list", value: "insertUnorderedList", icon: "•" },
];

export default function ContractEditor({ contractId: routeContractId }: { contractId?: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [contractId, setContractId] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitationStatus, setInvitationStatus] = useState("");
  const [contractStatus, setContractStatus] = useState("draft");
  const [comments, setComments] = useState<ContractComment[]>([]);
  const [bodyToHydrate, setBodyToHydrate] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("Untitled contract");
  const [savedState, setSavedState] = useState("Saved to Pactum");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"invite" | "send">("invite");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [clauses, setClauses] = useState<number[]>([]);
  const [clausePositions, setClausePositions] = useState<number[]>([]);
  const skipNextEmptyRemoval = useRef(false);
  const serverSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEditor() {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me/`, { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error("unauthorized");
        const result = await response.json();
        const currentUser = result.user as User & { id: number };
        setUser(currentUser);

        const requestedId = routeContractId ?? new URLSearchParams(window.location.search).get("contract");
        if (requestedId) {
          const contractResponse = await fetch(`${API_BASE}/api/contracts/${requestedId}/`, { credentials: "include", signal: controller.signal });
          if (!contractResponse.ok) throw new Error("contract_not_found");
          const contractResult = await contractResponse.json();
          const contract = contractResult.contract as ContractRecord;
          setContractId(contract.id);
          setTitle(contract.title);
          setInvitedEmail(contract.invitedEmail || "");
          setInvitationStatus(contract.invitationStatus || "");
          setContractStatus(contract.status);
          setComments(contract.comments || []);
          setBodyToHydrate(contract.bodyHtml);
          setSavedState("Saved to Pactum");
        }
        setCheckingSession(false);
      } catch {
        if (!controller.signal.aborted) router.replace("/auth");
      }
    }

    loadEditor();

    return () => controller.abort();
  }, [router, routeContractId]);

  useEffect(() => {
    if (bodyToHydrate === undefined || !editorRef.current) return;
    editorRef.current.innerHTML = bodyToHydrate;
    ensureClauseIds();
    setClauses(Array.from(editorRef.current.querySelectorAll("ol > li"), (_, index) => index + 1));
    measureClausePositions();
  }, [bodyToHydrate]);

  function ensureClauseIds() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll("ol > li").forEach(clause => {
      if (!clause.getAttribute("data-clause-id")) clause.setAttribute("data-clause-id", crypto.randomUUID());
    });
  }

  useEffect(() => () => {
    if (serverSaveTimer.current) window.clearTimeout(serverSaveTimer.current);
  }, []);

  function runFormat(command: Format) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    setSavedState("Unsaved changes");
  }

  function updateDocument() {
    setSavedState("Saving to Pactum...");
    queueServerSave();
  }

  function queueServerSave(titleOverride = title) {
    if (!editorRef.current) return;
    if (serverSaveTimer.current) window.clearTimeout(serverSaveTimer.current);
    serverSaveTimer.current = window.setTimeout(() => {
      void saveContractToServer(titleOverride).catch(error => {
        setSavedState(error instanceof Error ? error.message : "Unable to save to Pactum.");
      });
    }, 500);
  }

  async function getCsrfToken() {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
    const result = await response.json();
    return result.csrfToken as string;
  }

  async function saveContractToServer(titleOverride = title) {
    if (!editorRef.current) throw new Error("Editor is not ready.");
    if (contractStatus === "executed") throw new Error("Executed contracts cannot be edited.");
    ensureClauseIds();
    setSavedState("Saving to Pactum...");
    const response = await fetch(`${API_BASE}/api/contracts/save/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRFToken": await getCsrfToken() },
      body: JSON.stringify({ id: contractId, title: titleOverride, subtitle: "", bodyHtml: editorRef.current.innerHTML }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Unable to save contract.");

    const contract = result.contract as ContractRecord;
    setContractId(contract.id);
    setContractStatus(contract.status);
    setComments(contract.comments || []);
    window.history.replaceState({}, "", `/contract/${contract.id}`);
    setSavedState("Saved to Pactum");
    return contract;
  }

  async function handleSaveContract() {
    if (serverSaveTimer.current) {
      window.clearTimeout(serverSaveTimer.current);
      serverSaveTimer.current = null;
    }
    try {
      await saveContractToServer();
    } catch (error) {
      setSavedState(error instanceof Error ? error.message : "Unable to save contract.");
    }
  }

  function removeClause(index: number) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.querySelectorAll("ol > li")[index]?.remove();
    setClauses(current => current.filter((_, clauseIndex) => clauseIndex !== index).map((_, clauseIndex) => clauseIndex + 1));
    window.requestAnimationFrame(measureClausePositions);
    setSavedState("Unsaved changes");
  }

  function measureClausePositions() {
    const editor = editorRef.current;
    const paper = editor?.parentElement;
    if (!editor || !paper) return;

    const paperTop = paper.getBoundingClientRect().top;
    setClausePositions(Array.from(editor.querySelectorAll("ol > li"), item => item.getBoundingClientRect().top - paperTop));
  }

  function getActiveClause(target: EventTarget | null) {
    const selectionNode = window.getSelection()?.anchorNode;
    const selectionElement = selectionNode instanceof HTMLElement ? selectionNode : selectionNode?.parentElement;
    return selectionElement?.closest("li") || (target as HTMLElement | null)?.closest("li");
  }

  function handleEditorInput(event: React.FormEvent<HTMLDivElement>) {
    updateDocument();
    if (skipNextEmptyRemoval.current) {
      skipNextEmptyRemoval.current = false;
      return;
    }

    const clause = getActiveClause(event.target);
    if (!clause || clause.textContent?.trim()) return;

    const items = Array.from(editorRef.current?.querySelectorAll("ol > li") || []);
    const index = items.indexOf(clause);
    if (index >= 0) removeClause(index);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Backspace") return;

    const clause = getActiveClause(event.target);
    if (!clause || clause.textContent?.trim()) return;

    const items = Array.from(editorRef.current?.querySelectorAll("ol > li") || []);
    const index = items.indexOf(clause);
    if (index >= 0) {
      event.preventDefault();
      skipNextEmptyRemoval.current = true;
      window.setTimeout(() => {
        skipNextEmptyRemoval.current = false;
      }, 0);
      removeClause(index);
    }
  }

  useEffect(() => {
    measureClausePositions();
    const handleResize = () => measureClausePositions();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clauses]);

  function addClause() {
    const editor = editorRef.current;
    if (!editor) return;

    let clauseList = editor.querySelector("ol");
    if (!clauseList) {
      clauseList = document.createElement("ol");
      editor.appendChild(clauseList);
    }

    const clause = document.createElement("li");
    clause.className = "mb-3 min-h-7 list-item pl-2";
    clause.textContent = "";
    clauseList.appendChild(clause);
    setClauses(current => [...current, current.length + 1]);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(clause);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    setSavedState("Unsaved changes");
    window.requestAnimationFrame(measureClausePositions);
  }

  
  function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteError("");
    void (async () => {
      try {
        const contract = await saveContractToServer();
        const endpoint = inviteMode === "send" ? "/api/contracts/send/" : "/api/contracts/invite/";
        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRFToken": await getCsrfToken() },
          body: JSON.stringify({
            contractId: contract.id,
            title: contract.title,
            subtitle: contract.subtitle,
            bodyHtml: editorRef.current?.innerHTML || "",
            email: inviteEmail.trim(),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to process invitation.");
        setInviteSent(true);
        setInvitedEmail(inviteEmail.trim());
        setInvitationStatus("sent");
        if (inviteMode === "send") setSavedState("Sent to invited party");
      } catch (error) {
        setInviteError(error instanceof Error ? error.message : "Unable to process invitation.");
      }
    })();
  }

  function openInvite(mode: "invite" | "send") {
    setInviteMode(mode);
    setInviteSent(false);
    setInviteError("");
    setInviteOpen(true);
  }

  async function revokeInvitation() {
    if (!contractId || !window.confirm("Invalidate this invitation link?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}/invitation/revoke/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": await getCsrfToken() },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Unable to revoke invitation.");
      setInvitedEmail("");
      setInvitationStatus("revoked");
      setSavedState("Invitation link revoked");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Unable to revoke invitation.");
    }
  }

  async function refreshComments() {
    if (!contractId) return;
    const response = await fetch(`${API_BASE}/api/contracts/${contractId}/comments/`, { credentials: "include" });
    const result = await response.json();
    if (response.ok) setComments(result.comments || []);
  }

  const saveShortcutRef = useRef<() => void>(() => {});

  // keep the ref pointing at the latest handler (fresh contractId / title)
  useEffect(() => {
    saveShortcutRef.current = () => { void handleSaveContract(); };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSave = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s";
      if (!isSave) return;
      event.preventDefault();               // stop the browser's "Save page as..." dialog
      if (!event.repeat) saveShortcutRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (checkingSession || !user) return <ContractLoader />;

  return (
    <main className={styles.workspace}>
      <header className={styles.appBar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} type="button" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard" title="Back to dashboard">←</button>
          
        </div>
        <div className={styles.documentName}>
            <input className={styles.documentTitleInput} disabled={contractStatus === "executed"} value={title} onChange={event => { const nextTitle = event.target.value; setTitle(nextTitle); setSavedState("Saving to Pactum..."); queueServerSave(nextTitle); }} aria-label="Contract title" />
          <span className={styles.saveStatus}>{savedState}</span>
        </div>
        <div className={styles.appActions}>
          <button className={styles.ghostButton} type="button" disabled={contractStatus === "executed"} onClick={handleSaveContract}>Save contract</button>
          <button className={styles.ghostButton} type="button" disabled={contractStatus === "executed"} onClick={() => openInvite("invite")}>Invite party</button>
        </div>
      </header>

      <div className={styles.editorBar}>
        <div className={styles.toolbarGroup}>
          <select className={styles.select} aria-label="Text style" defaultValue="normal" onChange={event => { editorRef.current?.focus(); document.execCommand("formatBlock", false, event.target.value); }}>
            <option value="normal">Normal text</option>
            <option value="h1">Title</option>
            <option value="h2">Heading 1</option>
            <option value="h3">Heading 2</option>
          </select>
          <span className={styles.divider} />
          {toolbarItems.map(item => (
            <button key={item.value} type="button" disabled={contractStatus === "executed"} className={`${styles.toolButton} ${item.value === "italic" ? styles.italic : ""}`} onClick={() => runFormat(item.value)} aria-label={item.label} title={item.label}>{item.icon}</button>
          ))}
          <button type="button" className={styles.toolButton} onClick={() => { editorRef.current?.focus(); document.execCommand("justifyLeft", false); }} aria-label="Align left" title="Align left">≡</button>
          <span className={styles.divider} />
          <button type="button" className={styles.toolButton} onClick={() => { document.execCommand("undo", false); setSavedState("Unsaved changes"); }} aria-label="Undo" title="Undo">↶</button>
          <button type="button" className={styles.toolButton} onClick={() => { document.execCommand("redo", false); setSavedState("Unsaved changes"); }} aria-label="Redo" title="Redo">↷</button>
        </div>
        <div className={styles.editorTools}>
          <button type="button" disabled={contractStatus === "executed"} className={styles.textButton} onClick={addClause}>+ Clause</button>
          <button type="button" className={styles.textButton} onClick={refreshComments}>Comments · {comments.length}</button>
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.outline}>
          <p className={styles.eyebrow}>Document outline</p>
          {clauses.length === 0 ? (
            <p className="text-xs leading-relaxed text-black/40 dark:text-white/40">Your clause headings will appear here.</p>
          ) : (
            clauses.map((clause, index) => (
              <button key={clause} type="button" className={styles.outlineActive} onClick={() => editorRef.current?.querySelectorAll("ol > li")[index]?.scrollIntoView({ behavior: "smooth", block: "center" })}>Clause {clause}</button>
            ))
          )}
        </aside>

        <section className={styles.canvas} aria-label="Contract document">
          <div className="mx-auto flex w-full max-w-215 items-start gap-2">
          <div className={`${styles.paper} flex-1`}>
            <div
              ref={editorRef}
              className={styles.document}
              contentEditable={contractStatus !== "executed"}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onKeyDown={handleEditorKeyDown}
              role="textbox"
              aria-multiline="true"
              spellCheck
            >
              <p className={styles.kicker}>Pactum instrument · Draft</p>
              <h1 className="pactum-display mb-2 min-h-10 text-3xl font-bold leading-tight text-black/40 empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] dark:text-white/40 sm:text-[34px]" data-placeholder="Contract title" />
              <p className={`${styles.subtext} empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)]`} data-placeholder="Add a short description or context for this agreement" />
              <hr className="my-7 border-0 border-t border-black/10 dark:border-white/10" />
              <ol className="min-h-105 list-decimal pl-7" />
            </div>
          </div>
          {clauses.length > 0 && (
            <div className={`${styles.clauseRail} relative`} aria-label="Clause actions">
              {clauses.map((clause, index) => (
                <button key={clause} type="button" className={`${styles.deleteClauseButton} absolute left-0`} style={{ top: clausePositions[index] ?? 0 }} onClick={() => removeClause(index)} aria-label={`Delete clause ${clause}`} title={`Delete clause ${clause}`}>×</button>
              ))}
            </div>
          )}
          </div>
        </section>

        <aside className={styles.inspector}>
          <p className={styles.eyebrow}>Parties</p>
          <div className={styles.partyCard}><div className={styles.partyAvatar}>C</div><div><strong className="block text-xs font-semibold">{user.username}</strong><span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">Creator · You</span></div><i className={styles.statusDot} /></div>
          {invitedEmail ? (
            <div className={styles.partyCard}>
              <div className={`${styles.partyAvatar} ${styles.invitedAvatar}`}>+</div>
              <div className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold">{invitedEmail}</strong><span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">{invitationStatus === "accepted" ? "Signed" : invitationStatus === "revoked" ? "Revoked" : "Pending"}</span></div>
              {invitationStatus !== "accepted" && invitationStatus !== "revoked" && <button type="button" className="border-0 bg-transparent px-1 text-lg text-black/40 hover:text-[#8b2635] dark:text-white/40 dark:hover:text-[#e0637a]" onClick={revokeInvitation} title="Invalidate invitation link" aria-label="Invalidate invitation link">×</button>}
            </div>
          ) : (
            <div className={styles.partyCard}><div className={`${styles.partyAvatar} ${styles.invitedAvatar}`}>+</div><div><strong className="block text-xs font-semibold">Invite someone</strong><span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">Second signer</span></div></div>
          )}
          {!invitedEmail && <button type="button" className={styles.inspectorAction} onClick={() => openInvite("invite")}>＋ Add invited party</button>}
          <div className={styles.inspectorRule} />
          <p className={styles.eyebrow}>Document settings</p>
          <div className={styles.setting}><span>Document status</span><strong className={contractStatus === "executed" ? "text-[#8b2635]" : styles.enabled}>{contractStatus === "executed" ? "Executed · Read only" : "Editable"}</strong></div>
          <div className={styles.setting}><span>Signature order</span><strong>Any order</strong></div>
          <div className={styles.setting}><span>Expiry</span><strong>Never</strong></div>
          <div className={styles.setting}><span>Audit trail</span><strong className={styles.enabled}>Enabled</strong></div>
          <div className={styles.inspectorRule} />
          <div className="flex items-center justify-between"><p className={styles.eyebrow}>Review comments</p><button type="button" className="text-[10px] font-semibold text-[#8b2635]" onClick={() => void refreshComments()}>Refresh</button></div>
          {comments.length === 0 ? <p className="text-xs leading-relaxed text-black/40 dark:text-white/40">No comments yet.</p> : comments.map(comment => <div key={comment.id} className="mb-3 rounded-md border border-[#8b2635]/15 bg-[#8b2635]/5 p-2.5"><p className="text-[10px] font-bold text-[#8b2635]">{comment.authorName} · {comment.clauseId ? "Clause" : `Clause ${comment.clauseIndex ?? "?"}`}</p><p className="text-[9px] text-black/40 dark:text-white/40">{new Date(comment.createdAt).toLocaleString()}</p>{comment.quotedText && <p className="mt-1 border-l-2 border-[#8b2635]/30 pl-2 text-[10px] italic text-black/50 dark:text-white/50">“{comment.quotedText}”</p>}<p className="mt-1 text-[11px] leading-relaxed">{comment.body}</p></div>)}
        </aside>
      </div>

      {inviteOpen && (
        <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <section className={styles.inviteModal} role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Second signer</p><h2 id="invite-title" className="pactum-display m-0 text-[25px] font-bold">{inviteMode === "send" ? "Sign & send contract" : "Invite a party"}</h2></div><button type="button" className={styles.closeButton} onClick={() => setInviteOpen(false)} aria-label="Close invite dialog">×</button></div>
            {inviteSent ? <div className={styles.inviteSuccess}>{inviteMode === "send" ? "Contract sent to" : "Invitation sent to"} <strong>{inviteEmail}</strong>.</div> : <form onSubmit={sendInvite}><label className={styles.formLabel} htmlFor="invite-email">Email address</label><input id="invite-email" className={styles.formInput} type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="partner@company.com" required /><p className={styles.formHint}>{inviteMode === "send" ? "The contract will be saved and the invited party will receive a secure review link." : "They will receive a secure review link and remain Pending until they sign."}</p>{inviteError && <p className="my-3 text-xs text-[#8b2635] dark:text-[#e0637a]">{inviteError}</p>}<button className={styles.primaryButton} type="submit">{inviteMode === "send" ? "Save and send" : "Send invitation"}</button></form>}
          </section>
        </div>
      )}
    </main>
  );
}
