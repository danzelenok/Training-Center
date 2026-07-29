import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
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

  // GET /api/media — list all files from R2
  if (req.method === "GET") {
    try {
      const r2Files = await db
        .select()
        .from(mediaFiles)
        .where(eq(mediaFiles.organizationId, orgId))
        .orderBy(desc(mediaFiles.createdAt))
        .limit(100);

      const r2Formatted = r2Files.map((f) => ({
        fileId: f.id,
        name: f.fileName,
        url: f.url,
        fileType: f.mimeType,
        thumbnailUrl: f.fileType === "image" ? f.url : undefined,
        size: f.size,
      }));

      return res.status(200).json(r2Formatted);
    } catch (error: any) {
      console.error("Error listing R2 media files:", error);
      return res.status(500).json({ error: error.message || "Failed to list files" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
