"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrganizationList } from "@clerk/nextjs";
import Image from "next/image";
import { TicketSignUpForm } from "@/components/invite/TicketSignUpForm";

function InvitePageContent() {
  const searchParams = useSearchParams();
  const ticket = searchParams?.get("__clerk_ticket") ?? null;
  const status = searchParams?.get("__clerk_status") ?? null;

  // __clerk_status=sign_up: brand-new admin, no existing Clerk account —
  // <OrganizationList> has nothing to show for an unauthenticated visitor
  // and previously just rendered blank. Redeem the ticket via a real
  // sign-up form instead (see TicketSignUpForm).
  if (ticket && status === "sign_up") {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#FFFFFF] px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center flex flex-col items-center">
          <Image
            src="/cool-cat_logo-color.svg"
            alt="Cool Cat Logo"
            width={72}
            height={72}
            className="object-contain"
          />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#1B2A6B] sm:text-4xl">
            Cool Cat Training
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">
            Create your account to accept the invitation.
          </p>
        </div>
        <TicketSignUpForm ticket={ticket} />
      </div>
    );
  }

  // __clerk_status=sign_in (existing account, e.g. today's org_admin) and the
  // no-ticket case (visiting /invite directly) both go through the
  // pre-built picker unchanged — it already handles a signed-in user's
  // pending invitations correctly.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 sm:px-6 lg:px-8">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/admin"
        appearance={{
          variables: { colorPrimary: "#C8D400" },
        }}
      />
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InvitePageContent />
    </Suspense>
  );
}
