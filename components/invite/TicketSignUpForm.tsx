"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TicketSignUpFormProps {
  ticket: string;
}

/**
 * Completes a brand-new admin's account creation from an organization
 * invitation ticket (__clerk_status=sign_up — no existing Clerk account).
 *
 * Uses @clerk/nextjs's newer signal-based useSignUp() (this SDK version's
 * default export for that hook — {signUp, errors, fetchStatus}, not the
 * classic {isLoaded, signUp, setActive} shape). signUp.create() with
 * strategy "ticket" both redeems the invitation (role/jurisdiction metadata
 * already lives on the invitation/membership, see app/api/webhooks/clerk)
 * and verifies the email automatically — no separate email-code step needed.
 *
 * Google OAuth is intentionally not offered here: Clerk's ticket-redemption
 * and OAuth sign-up are documented as separate strategies, not composable in
 * one step, and starting an OAuth sign-up here would create an account that
 * never redeems the invitation (no role/jurisdiction, no org membership).
 */
export function TicketSignUpForm({ ticket }: TicketSignUpFormProps) {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitting = fetchStatus === "fetching";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error: createError } = await signUp.create({
      strategy: "ticket",
      ticket,
      firstName,
      lastName,
      password,
    });
    if (createError) {
      setError(createError.message || "Could not complete sign-up.");
      return;
    }

    if (signUp.status !== "complete") {
      // All Attributes this instance requires (name, password) were supplied
      // above, so this shouldn't normally happen — but don't leave the user
      // staring at nothing if Clerk asks for something we didn't collect.
      setError("Additional information is required to finish setting up your account. Please contact your administrator.");
      return;
    }

    const { error: finalizeError } = await signUp.finalize({
      navigate: async () => {
        // Bootstrap this admin's own admin_roles row synchronously here,
        // before navigating — otherwise proxy.ts's role check on the very
        // first /admin request can lose the race against the async
        // organizationInvitation.accepted webhook and bounce them to
        // /access-denied. Best-effort: if this fails, the webhook is still
        // the fallback, so don't block navigation on it.
        try {
          const res = await fetch("/api/admin/team/finalize-invite", { method: "POST" });
          if (!res.ok) {
            console.error("finalize-invite failed:", await res.text().catch(() => res.statusText));
          }
        } catch (err) {
          console.error("finalize-invite request failed:", err);
        }
        router.push("/admin");
      },
    });
    if (finalizeError) {
      setError(finalizeError.message || "Could not finish signing in.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 mt-8">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">First name</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="bg-gray-50 border-[#E5E7EB]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">Last name</label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="bg-gray-50 border-[#E5E7EB]"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="bg-gray-50 border-[#E5E7EB]"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account & join"}
      </Button>
    </form>
  );
}
