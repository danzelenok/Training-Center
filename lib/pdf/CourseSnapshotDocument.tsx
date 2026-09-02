import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { CourseSnapshotWorkerResult } from "@/lib/courseSnapshot";
import { sortGroupKeys, groupSnapshotWorkers, statCounts, type GroupedSnapshot } from "@/lib/courseSnapshotGrouping";

const NAVY = "#1B2A6B";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const STATUS_LABELS: Record<CourseSnapshotWorkerResult["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLORS: Record<CourseSnapshotWorkerResult["status"], string> = {
  not_started: "#71717a",
  in_progress: "#2563eb",
  completed: "#059669",
};

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: NAVY },
  logo: { width: 40, height: 52, marginRight: 14 },
  brand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 1.5 },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 3 },
  meta: { fontSize: 9, color: MUTED, marginTop: 3 },
  statsRow: { flexDirection: "row", marginBottom: 18 },
  statBox: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8 },
  statLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 3 },
  groupHeader: {
    backgroundColor: "#f4f5f0",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 3,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  groupLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY },
  groupStats: { fontSize: 8, color: MUTED },
  subGroupLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, paddingLeft: 12, paddingVertical: 3 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingBottom: 5,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.3 },
  td: { fontSize: 8, color: "#1a1a1a" },
  colWorker: { width: "24%", paddingRight: 4 },
  colRole: { width: "18%", paddingRight: 4 },
  colJurisdiction: { width: "18%", paddingRight: 4 },
  colStatus: { width: "14%", paddingRight: 4 },
  colCompleted: { width: "14%", paddingRight: 4 },
  colScore: { width: "12%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

function TableHead() {
  return (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.th, styles.colWorker]}>Worker</Text>
      <Text style={[styles.th, styles.colRole]}>Role</Text>
      <Text style={[styles.th, styles.colJurisdiction]}>Jurisdiction</Text>
      <Text style={[styles.th, styles.colStatus]}>Status</Text>
      <Text style={[styles.th, styles.colCompleted]}>Completed</Text>
      <Text style={[styles.th, styles.colScore]}>Quiz Score</Text>
    </View>
  );
}

function WorkerRow({ w }: { w: CourseSnapshotWorkerResult }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.td, styles.colWorker]}>{w.workerName}</Text>
      <Text style={[styles.td, styles.colRole]}>{w.roleName ?? "Role unknown"}</Text>
      <Text style={[styles.td, styles.colJurisdiction]}>{w.jurisdictionName ?? "No jurisdiction"}</Text>
      <Text style={[styles.td, styles.colStatus, { color: STATUS_COLORS[w.status] }]}>{STATUS_LABELS[w.status]}</Text>
      <Text style={[styles.td, styles.colCompleted]}>
        {w.completedAt ? format(new Date(w.completedAt), "yyyy-MM-dd HH:mm") : "—"}
      </Text>
      <Text style={[styles.td, styles.colScore]}>{w.quizScore !== null ? `${w.quizScore}%` : "—"}</Text>
    </View>
  );
}

function GroupHeaderRow({ label, list }: { label: string; list: CourseSnapshotWorkerResult[] }) {
  const stats = statCounts(list);
  return (
    <View style={styles.groupHeader} wrap={false}>
      <Text style={styles.groupLabel}>{label}</Text>
      <Text style={styles.groupStats}>
        {stats.completed}/{stats.total} completed ({stats.rate}%)
      </Text>
    </View>
  );
}

function GroupedRows({ grouped }: { grouped: GroupedSnapshot<CourseSnapshotWorkerResult> }) {
  if (!grouped) return null;

  if (grouped.kind === "single") {
    return (
      <>
        {sortGroupKeys([...grouped.single.keys()]).map((key) => {
          const list = grouped.single.get(key)!;
          return (
            <View key={key}>
              <GroupHeaderRow label={key} list={list} />
              {list.map((w) => (
                <WorkerRow key={w.workerId} w={w} />
              ))}
            </View>
          );
        })}
      </>
    );
  }

  return (
    <>
      {sortGroupKeys([...grouped.byRole.keys()]).map((roleKey) => {
        const inner = grouped.byRole.get(roleKey)!;
        const roleList = [...inner.values()].flat();
        return (
          <View key={roleKey}>
            <GroupHeaderRow label={roleKey} list={roleList} />
            {sortGroupKeys([...inner.keys()]).map((jKey) => {
              const list = inner.get(jKey)!;
              return (
                <View key={jKey}>
                  <Text style={styles.subGroupLabel}>
                    {jKey} ({list.length})
                  </Text>
                  {list.map((w) => (
                    <WorkerRow key={w.workerId} w={w} />
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

export interface CourseSnapshotDocumentProps {
  course: { title: string; publishedAt: Date };
  workers: CourseSnapshotWorkerResult[];
  statusFilterLabel: string | null;
  groupByRole: boolean;
  groupByJurisdiction: boolean;
  logoBuffer: Buffer;
  generatedAt: Date;
}

export function CourseSnapshotDocument({
  course,
  workers,
  statusFilterLabel,
  groupByRole,
  groupByJurisdiction,
  logoBuffer,
  generatedAt,
}: CourseSnapshotDocumentProps) {
  const overall = statCounts(workers);
  const grouped = groupSnapshotWorkers(workers, groupByRole, groupByJurisdiction);

  return (
    <Document title={`${course.title} — Workforce Snapshot`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Image style={styles.logo} src={{ data: logoBuffer, format: "png" }} />
          <View>
            <Text style={styles.brand}>Cool Cat Training</Text>
            <Text style={styles.title}>{course.title}</Text>
            <Text style={styles.meta}>
              Workforce snapshot as of publish date — {format(course.publishedAt, "MMM d, yyyy")}
            </Text>
            {statusFilterLabel ? <Text style={styles.meta}>Filter: {statusFilterLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox label="Workforce" value={String(overall.total)} />
          <StatBox label="Completed" value={String(overall.completed)} valueColor="#059669" />
          <StatBox label="In Progress" value={String(overall.inProgress)} valueColor="#2563eb" />
          <StatBox label="Completion Rate" value={`${overall.rate}%`} />
        </View>

        <TableHead />
        {!grouped ? (
          workers.map((w) => <WorkerRow key={w.workerId} w={w} />)
        ) : (
          <GroupedRows grouped={grouped} />
        )}

        {workers.length === 0 ? (
          <Text style={{ ...styles.meta, marginTop: 12, textAlign: "center" }}>
            No workers match this snapshot/filter.
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>Cool Cat Training — Workforce Snapshot Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Generated ${format(generatedAt, "yyyy-MM-dd HH:mm")} — Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
