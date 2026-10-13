"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

function ConfirmDialog({ options, onResolve }: { options: ConfirmOptions; onResolve: (value: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = options.tone === "danger";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // destructive actions start on Cancel so a stray Enter can't delete anything
    (danger ? cancelRef : confirmRef).current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation(); // don't also close the sheet or popover underneath
        onResolve(false);
        return;
      }
      if (event.key === "Tab") {
        const buttons = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index === buttons.length - 1 ? 0 : index + 1);
        event.preventDefault();
        buttons[next]?.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[#0f0708]/55 p-5 backdrop-blur-sm"
      onMouseDown={event => { if (event.target === event.currentTarget) onResolve(false); }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? "confirm-message" : undefined}
        className="w-full max-w-[400px] rounded-xl border border-[#8b2635]/35 bg-[#faf6f2] p-6 text-[#1a0f10] shadow-[0_20px_70px_rgba(15,7,8,0.3)] dark:border-[#c1445a]/35 dark:bg-[#160b0c] dark:text-[#f0e8e8]"
      >
        <div className="flex items-start gap-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#8b2635]/10 text-base font-bold text-[#8b2635] dark:bg-[#c1445a]/10 dark:text-[#e0637a]" aria-hidden>
            {danger ? "!" : "✓"}
          </div>
          <div className="min-w-0">
            {options.eyebrow && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2635] dark:text-[#c1445a]">{options.eyebrow}</p>}
            <h2 id="confirm-title" className="pactum-display m-0 text-[21px] font-bold leading-tight">{options.title}</h2>
            {options.message && <div id="confirm-message" className="mt-2 text-[13px] leading-relaxed text-black/60 dark:text-white/60">{options.message}</div>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false)}
            className="rounded-md border border-black/10 bg-transparent px-3.5 py-2 text-xs font-semibold hover:border-[#8b2635] hover:text-[#8b2635] focus:outline-none focus:ring-4 focus:ring-[#8b2635]/15 dark:border-white/10 dark:hover:border-[#c1445a] dark:hover:text-[#e0637a]"
          >
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResolve(true)}
            className="rounded-md border border-transparent bg-[#8b2635] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#a8334a] focus:outline-none focus:ring-4 focus:ring-[#8b2635]/25 dark:bg-[#c1445a] dark:hover:bg-[#e0637a]"
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false); // a newer request cancels any open one
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  useEffect(() => () => { resolver.current?.(false); }, []); // unmounting counts as cancel

  const dialog = options ? <ConfirmDialog options={options} onResolve={settle} /> : null;
  return { confirm, dialog };
}