export interface TeamRosterMember {
  id: string;
}

export interface TeamRosterResponse {
  members: TeamRosterMember[];
}

export const teamRosterKeys = {
  detail: (teamId: string) => ["team-roster", teamId] as const,
};
