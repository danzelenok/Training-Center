export type AdminRole = "org_admin" | "jurisdiction_admin";

export interface JurisdictionRef {
  id: string;
  code: string;
  name: string;
}

export interface TeamMember {
  clerkUserId: string;
  identifier: string;
  firstName: string | null;
  lastName: string | null;
  role: AdminRole | null; // null = Clerk member with no admin_roles row yet ("role not set")
  jurisdiction: JurisdictionRef | null;
}

export interface PendingTeamInvitation {
  id: string;
  email: string;
  requestedRole: AdminRole | null;
  jurisdiction: JurisdictionRef | null;
}

export interface TeamResponse {
  members: TeamMember[];
  pendingInvitations: PendingTeamInvitation[];
}

export const teamKeys = {
  all: () => ["admin-team"] as const,
};
