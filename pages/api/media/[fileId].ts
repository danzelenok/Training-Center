import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteFromR2 } from "@/lib/r2";
import { decodeClerkSessionCookie, resolveOrgId } from "@/lib/org";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, clerkOrgId } = decodeClerkSessionCookie(req.headers.cookie || "");
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orgId = await resolveOrgId(clerkOrgId);
  if (!orgId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { fileId } = req.query as { fileId: string };

  // DELETE /api/media/[fileId]
  if (req.method === "DELETE") {
    try {
      const [file] = await db
        .select()
        .from(mediaFiles)
        .where(and(eq(mediaFiles.id, fileId), eq(mediaFiles.organizationId, orgId)))
        .limit(1);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      await deleteFromR2(file.r2Key);
      await db.delete(mediaFiles).where(eq(mediaFiles.id, fileId));

      return res.status(200).json({ success: true, fileId });
    } catch (error: any) {
      console.error("Error deleting R2 file:", error);
      return res.status(500).json({ error: error.message || "Failed to delete file" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
