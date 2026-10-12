export type CommentStatus = "pending" | "resolved" | "rejected";

const LABEL: Record<CommentStatus, string> = { pending: "Pending", resolved: "Resolved", rejected: "Rejected" };
const BADGE: Record<CommentStatus, string> = {
  pending: "bg-[#b7791f]/15 text-[#8a5a12] dark:text-[#e0b050]",
  resolved: "bg-[#3c9b68]/15 text-[#2c7a50] dark:text-[#5cc08a]",
  rejected: "bg-[#8b2635]/12 text-[#8b2635] dark:text-[#e0637a]",
};

export function CommentStatusBadge({ status = "pending" }: { status?: CommentStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${BADGE[status]}`}>{LABEL[status]}</span>;
}

// editor only
export function CommentStatusActions({ status = "pending", busy, onChange }: {
  status?: CommentStatus; busy?: boolean; onChange: (next: CommentStatus) => void;
}) {
  const base = "rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-50";
  return (
    <div className="mt-2 flex gap-1.5">
      <button type="button" disabled={busy} onClick={() => onChange("resolved")}
        className={`${base} ${status === "resolved" ? "border-[#3c9b68] bg-[#3c9b68] text-white" : "border-black/15 hover:border-[#3c9b68] hover:text-[#3c9b68] dark:border-white/15"}`}>
        {status === "resolved" ? "✓ Resolved" : "Resolve"}
      </button>
      <button type="button" disabled={busy} onClick={() => onChange("rejected")}
        className={`${base} ${status === "rejected" ? "border-[#8b2635] bg-[#8b2635] text-white" : "border-black/15 hover:border-[#8b2635] hover:text-[#8b2635] dark:border-white/15"}`}>
        {status === "rejected" ? "✕ Rejected" : "Reject"}
      </button>
    </div>
  );
}

export function CommentDeleteButton({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded border border-black/15 px-2 py-1 text-[10px] font-semibold hover:border-[#8b2635] hover:text-[#8b2635] disabled:opacity-50 dark:border-white/15 dark:hover:border-[#e0637a] dark:hover:text-[#e0637a]"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}