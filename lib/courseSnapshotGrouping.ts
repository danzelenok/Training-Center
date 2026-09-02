export const ROLE_UNKNOWN = "Role unknown";
export const NO_JURISDICTION = "No jurisdiction";

// Sorts group keys alphabetically but always pushes the "unknown" bucket last,
// so a handful of gap-cases don't visually dominate the top of the report.
export function sortGroupKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const aUnknown = a === ROLE_UNKNOWN || a === NO_JURISDICTION;
    const bUnknown = b === ROLE_UNKNOWN || b === NO_JURISDICTION;
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
    return a.localeCompare(b);
  });
}

interface GroupableWorker {
  roleName: string | null;
  jurisdictionName: string | null;
}

export type GroupedSnapshot<T> =
  | null
  | { kind: "single"; single: Map<string, T[]> }
  | { kind: "nested"; byRole: Map<string, Map<string, T[]>> };

// Shared by the on-screen drill-down and the PDF export so both group the
// same snapshot the same way — kept in one place rather than reimplemented
// per renderer, where the two could silently drift.
export function groupSnapshotWorkers<T extends GroupableWorker>(
  workersList: T[],
  groupByRole: boolean,
  groupByJurisdiction: boolean
): GroupedSnapshot<T> {
  if (!groupByRole && !groupByJurisdiction) return null;

  if (groupByRole && groupByJurisdiction) {
    const byRole = new Map<string, Map<string, T[]>>();
    for (const w of workersList) {
      const roleKey = w.roleName ?? ROLE_UNKNOWN;
      const jKey = w.jurisdictionName ?? NO_JURISDICTION;
      if (!byRole.has(roleKey)) byRole.set(roleKey, new Map());
      const inner = byRole.get(roleKey)!;
      if (!inner.has(jKey)) inner.set(jKey, []);
      inner.get(jKey)!.push(w);
    }
    return { kind: "nested", byRole };
  }

  const single = new Map<string, T[]>();
  for (const w of workersList) {
    const key = groupByRole ? w.roleName ?? ROLE_UNKNOWN : w.jurisdictionName ?? NO_JURISDICTION;
    if (!single.has(key)) single.set(key, []);
    single.get(key)!.push(w);
  }
  return { kind: "single", single };
}

interface StatusBearing {
  status: "not_started" | "in_progress" | "completed";
}

export function statCounts<T extends StatusBearing>(list: T[]) {
  const total = list.length;
  const completed = list.filter((w) => w.status === "completed").length;
  const inProgress = list.filter((w) => w.status === "in_progress").length;
  const notStarted = total - completed - inProgress;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, notStarted, rate };
}
