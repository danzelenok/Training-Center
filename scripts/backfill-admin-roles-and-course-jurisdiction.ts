/**
 * One-time backfill for the jurisdiction-based multi-admin ownership model:
 *   - sets `courses.owner_jurisdiction_id` to WA for every course missing it
 *     (this tenant's sole existing jurisdiction at the time this feature
 *     shipped — see the "Seattle" decision in the ownership-model task)
 *   - creates an `admin_roles` row with role = 'org_admin' for every current
 *     Clerk organization member who doesn't have one yet, so nobody already
 *     using the app loses access once role checks go live
 *
 * Idempotent — course backfill only touches rows WHERE owner_jurisdiction_id
 * IS NULL; admin_roles insert is ON CONFLICT (organization_id, clerk_user_id)
 * DO NOTHING.
 *
 * Run with:
 *   npx tsx scripts/backfill-admin-roles-and-course-jurisdiction.ts
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { createClerkClient } from "@clerk/backend";

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const sql = neon(process.env.DATABASE_URL!);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  // 1. Courses -> WA
  const [wa] = await sql`SELECT id FROM jurisdictions WHERE code = 'WA' LIMIT 1`;
  if (!wa) throw new Error("WA jurisdiction not found — run scripts/seed-jurisdictions.ts first");

  const coursesBefore = await sql`SELECT count(*)::int as n FROM courses WHERE owner_jurisdiction_id IS NULL`;
  await sql`UPDATE courses SET owner_jurisdiction_id = ${wa.id} WHERE owner_jurisdiction_id IS NULL`;
  console.log(`Backfilled owner_jurisdiction_id = WA (${wa.id}) on ${coursesBefore[0].n} course(s).`);

  // 2. admin_roles for existing Clerk org members
  const orgs = await sql`SELECT id, clerk_org_id, name FROM organizations`;
  let totalGranted = 0;
  for (const org of orgs) {
    const members = await clerk.organizations.getOrganizationMembershipList({
      organizationId: org.clerk_org_id as string,
    });
    for (const member of members.data) {
      const clerkUserId = member.publicUserData?.userId;
      if (!clerkUserId) continue;
      const result = await sql`
        INSERT INTO admin_roles (organization_id, clerk_user_id, role, jurisdiction_id)
        VALUES (${org.id}, ${clerkUserId}, 'org_admin', NULL)
        ON CONFLICT (organization_id, clerk_user_id) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) {
        totalGranted++;
        console.log(`Granted org_admin to ${member.publicUserData?.identifier ?? clerkUserId} in ${org.name}.`);
      }
    }
  }
  console.log(`Done. Granted org_admin to ${totalGranted} previously-unrecorded member(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
