"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { registerOrganization } from "./actions";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clerk's membership list is the source of truth for "does this org already
  // exist", independent of whether it's the session's *active* org — so this
  // catches a prior attempt dying at any point (right after createOrganization,
  // before setActive ran; after setActive but before the DB insert; etc).
  const existingMembership = userMemberships.data?.[0];

  // Self-heal: if the user already has a Clerk org membership when this page
  // loads, finish activating + registering *that* org instead of letting the
  // user submit the form again and create a second, orphaned Clerk organization.
  useEffect(() => {
    if (!isLoaded || !existingMembership || !setActive) return;
    setSubmitting(true);
    setActive({ organization: existingMembership.organization.id })
      .then(() => registerOrganization(existingMembership.organization.id, existingMembership.organization.name))
      .then(() => router.push("/admin"))
      .catch((err: any) => {
        setError(err?.message || "Failed to finish organization setup. Please try again.");
        setSubmitting(false);
      });
  }, [isLoaded, existingMembership, setActive, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !createOrganization || !setActive) return;
    if (existingMembership) return; // already handled by the effect above

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Organization name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const org = await createOrganization({ name: trimmed });
      await setActive({ organization: org.id });
      await registerOrganization(org.id, org.name);
      router.push("/admin");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || err?.message || "Failed to create organization.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="text-center flex flex-col items-center">
          <Image
            src="/cool-cat_logo-color.svg"
            alt="Cool Cat Logo"
            width={72}
            height={72}
            className="object-contain"
          />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#1B2A6B] sm:text-4xl">
            Create your organization
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">
            Set up your workspace to start managing courses and workers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label htmlFor="orgName" className="block text-xs font-semibold text-[#1B2A6B] mb-1">
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Construction"
              className="w-full rounded-xl border border-[#E5E7EB] bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#C8D400] focus:outline-none"
              disabled={submitting}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !isLoaded}
            className="w-full rounded-xl bg-[#C8D400] px-4 py-3 font-bold text-[#1B2A6B] shadow-md hover:bg-[#B6C200] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
