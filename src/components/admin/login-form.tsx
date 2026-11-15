"use client";

import { useActionState } from "react";
import { loginAdmin, type AdminActionState } from "@/app/admin/actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, { ok: false, message: "" } as AdminActionState);
  return <form action={action} className="mt-8 space-y-5">
    <div><label htmlFor="email" className="text-sm font-semibold">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="mt-2 w-full border border-white/15 bg-[#111] px-4" /></div>
    <div><label htmlFor="password" className="text-sm font-semibold">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="mt-2 w-full border border-white/15 bg-[#111] px-4" /></div>
    <button disabled={pending} className="w-full bg-[#E11D2E] px-4 py-3 font-bold uppercase disabled:opacity-50">{pending ? "Verifying…" : "Sign in"}</button>
    {state.message && <p role="alert" className="text-sm text-red-300">{state.message}</p>}
  </form>;
}
