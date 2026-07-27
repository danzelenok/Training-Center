import { db } from "@/db";
import { assignments, courseAutoAssignTeams, courses, workers } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// When a worker joins a team, immediately grant them any published courses that
// team auto-assigns to its members. This mirrors `autoAssignNewWorkers` for the
// "all" scope, but is triggered by team membership rather than a hire-date window.
// Deactivated workers are silently skipped — they never pick up new assignments
// through team mechanisms.
export async function autoAssignTeamCoursesForNewMemberships(
  memberships: { workerId: string; teamId: string }[]
) {
  if (memberships.length === 0) return;

  const teamIds = Array.from(new Set(memberships.map((m) => m.teamId)));
  const workerIds = Array.from(new Set(memberships.map((m) => m.workerId)));

  const activeWorkers = await db
    .select({ id: workers.id })
    .from(workers)
    .where(and(inArray(workers.id, workerIds), eq(workers.active, true)));
  const activeWorkerIds = new Set(activeWorkers.map((w) => w.id));

  const activeMemberships = memberships.filter((m) => activeWorkerIds.has(m.workerId));
  if (activeMemberships.length === 0) return;

  const teamCourses = await db
    .select({ teamId: courseAutoAssignTeams.teamId, courseId: courseAutoAssignTeams.courseId })
    .from(courseAutoAssignTeams)
    .innerJoin(courses, eq(courses.id, courseAutoAssignTeams.courseId))
    .where(and(inArray(courseAutoAssignTeams.teamId, teamIds), eq(courses.status, "published")));

  if (teamCourses.length === 0) return;

  const courseIdsByTeam = new Map<string, string[]>();
  for (const tc of teamCourses) {
    const list = courseIdsByTeam.get(tc.teamId) ?? [];
    list.push(tc.courseId);
    courseIdsByTeam.set(tc.teamId, list);
  }

  const rows: { workerId: string; courseId: string }[] = [];
  for (const m of activeMemberships) {
    const courseIds = courseIdsByTeam.get(m.teamId);
    if (!courseIds) continue;
    for (const courseId of courseIds) {
      rows.push({ workerId: m.workerId, courseId });
    }
  }

  if (rows.length === 0) return;

  await db
    .insert(assignments)
    .values(rows)
    .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
}
