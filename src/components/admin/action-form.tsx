"use client";

import { useActionState } from "react";
import { mutateBookingAction, updateSettingsAction, type AdminActionState } from "@/app/admin/actions";

const initial: AdminActionState = { ok: false, message: "" };

export function BookingActionForm({ bookingId, operation, children }: { bookingId: string; operation: string; children?: React.ReactNode }) {
  const [state, action, pending] = useActionState(mutateBookingAction, initial);
  return <form action={action} className="space-y-3 rounded border border-white/10 bg-black/20 p-3">
    <input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operation" value={operation} />
    {children}
    {["reject", "cancel"].includes(operation) && <input name="reason" required minLength={3} maxLength={500} placeholder="Reason" className="w-full border border-white/15 bg-[#111] px-3 text-sm" />}
    <button disabled={pending} className="min-h-11 bg-[#E11D2E] px-4 text-sm font-bold uppercase disabled:opacity-50">{pending ? "Working…" : operation}</button>
    {state.message && <p role="status" className={`text-xs ${state.ok ? "text-emerald-400" : "text-red-300"}`}>{state.message}</p>}
  </form>;
}

export function SettingsForm({ kind, id, children }: { kind: string; id: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(updateSettingsAction, initial);
  return <form action={action} className="space-y-3 border border-white/10 bg-[#141414] p-4">
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />{children}
    <button disabled={pending} className="bg-[#E11D2E] px-4 py-2 text-sm font-bold disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    {state.message && <p role="status" className={`text-xs ${state.ok ? "text-emerald-400" : "text-red-300"}`}>{state.message}</p>}
  </form>;
}
