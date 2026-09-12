import type { ReactNode } from "react";

export function GlassBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="ledger-shell min-h-screen w-full bg-background font-body text-ink">
      <div className="relative">{children}</div>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="ledger-logo grid size-10 place-items-center rounded-full border-2 border-destructive text-destructive">
        <span className="font-display text-xs font-bold">SD</span>
      </div>
      <div>
        <span className="block font-body text-sm font-semibold">SmartDeadline</span>
        <span className="hidden text-[10px] text-slate-soft sm:block">academic course ledger</span>
      </div>
    </div>
  );
}
