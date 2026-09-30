"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ContractLoader from "../ContractLoader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

type User = { username: string; email: string };
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
  editorBar: "flex min-h-12 items-center justify-between gap-4 overflow-x-auto border-b border-black/10 bg-[#faf6f2] px-3 pl-[74px] dark:border-white/10 dark:bg-[#160b0c]",
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

export default function NewContractPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [title, setTitle] = useState("Untitled contract");
  const [savedState, setSavedState] = useState("Saved to Pactum");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [clauses, setClauses] = useState<number[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/auth/me/`, { credentials: "include", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then(result => {
        setUser(result.user);
        setCheckingSession(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) router.replace("/auth");
      });

    return () => controller.abort();
  }, [router]);

  function runFormat(command: Format) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    setSavedState("Unsaved changes");
  }

  function updateDocument() {
    setSavedState("Saving...");
    window.setTimeout(() => setSavedState("Saved to Pactum"), 650);
  }

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
  }

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

  function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSent(true);
  }

  if (checkingSession || !user) return <ContractLoader />;

  return (
    <main className={styles.workspace}>
      <header className={styles.appBar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} type="button" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard" title="Back to dashboard">←</button>
          <div className={styles.brandMark}>P</div>
          <div className={styles.brandName}>Pactum</div>
        </div>
        <div className={styles.documentName}>
          <input className={styles.documentTitleInput} value={title} onChange={event => { setTitle(event.target.value); setSavedState("Unsaved changes"); }} aria-label="Contract title" />
          <span className={styles.saveStatus}>{savedState}</span>
        </div>
        <div className={styles.appActions}>
          <button className={styles.ghostButton} type="button" onClick={() => setInviteOpen(true)}>Invite party</button>
          <button className={styles.primaryButton} type="button" onClick={() => setSavedState("Ready to send")}>Sign &amp; send</button>
          <button className={styles.avatar} type="button" onClick={handleSignOut} title="Sign out">{user.username.slice(0, 1).toUpperCase()}</button>
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
            <button key={item.value} type="button" className={`${styles.toolButton} ${item.value === "italic" ? styles.italic : ""}`} onClick={() => runFormat(item.value)} aria-label={item.label} title={item.label}>{item.icon}</button>
          ))}
          <button type="button" className={styles.toolButton} onClick={() => { editorRef.current?.focus(); document.execCommand("justifyLeft", false); }} aria-label="Align left" title="Align left">≡</button>
          <span className={styles.divider} />
          <button type="button" className={styles.toolButton} onClick={() => { document.execCommand("undo", false); setSavedState("Unsaved changes"); }} aria-label="Undo" title="Undo">↶</button>
          <button type="button" className={styles.toolButton} onClick={() => { document.execCommand("redo", false); setSavedState("Unsaved changes"); }} aria-label="Redo" title="Redo">↷</button>
        </div>
        <div className={styles.editorTools}>
          <button type="button" className={styles.textButton} onClick={addClause}>+ Clause</button>
          <button type="button" className={styles.textButton} onClick={() => setInviteOpen(true)}>Comments</button>
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
          <div className={styles.paper}>
            <div
              ref={editorRef}
              className={styles.document}
              contentEditable
              suppressContentEditableWarning
              onInput={updateDocument}
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
        </section>

        <aside className={styles.inspector}>
          <p className={styles.eyebrow}>Parties</p>
          <div className={styles.partyCard}><div className={styles.partyAvatar}>C</div><div><strong className="block text-xs font-semibold">{user.username}</strong><span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">Creator · You</span></div><i className={styles.statusDot} /></div>
          <div className={styles.partyCard}><div className={`${styles.partyAvatar} ${styles.invitedAvatar}`}>+</div><div><strong className="block text-xs font-semibold">Invite someone</strong><span className="mt-0.5 block text-[10px] text-black/50 dark:text-white/50">Second signer</span></div></div>
          <button type="button" className={styles.inspectorAction} onClick={() => setInviteOpen(true)}>＋ Add invited party</button>
          <div className={styles.inspectorRule} />
          <p className={styles.eyebrow}>Document settings</p>
          <div className={styles.setting}><span>Signature order</span><strong>Any order</strong></div>
          <div className={styles.setting}><span>Expiry</span><strong>Never</strong></div>
          <div className={styles.setting}><span>Audit trail</span><strong className={styles.enabled}>Enabled</strong></div>
        </aside>
      </div>

      {inviteOpen && (
        <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <section className={styles.inviteModal} role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Second signer</p><h2 id="invite-title" className="pactum-display m-0 text-[25px] font-bold">Invite a party</h2></div><button type="button" className={styles.closeButton} onClick={() => setInviteOpen(false)} aria-label="Close invite dialog">×</button></div>
            {inviteSent ? <div className={styles.inviteSuccess}>Invitation staged for <strong>{inviteEmail}</strong>.</div> : <form onSubmit={sendInvite}><label className={styles.formLabel} htmlFor="invite-email">Email address</label><input id="invite-email" className={styles.formInput} type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="partner@company.com" required /><p className={styles.formHint}>They will receive a secure link to review and sign this contract.</p><button className={styles.primaryButton} type="submit">Send invitation</button></form>}
          </section>
        </div>
      )}
    </main>
  );
}
