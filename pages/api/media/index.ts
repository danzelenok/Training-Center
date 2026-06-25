import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { desc } from "drizzle-orm";

// Manual Clerk session verification (same pattern as pages/api/courses/[id]/upload.ts)
function getUserIdFromRequest(req: NextApiRequest): string | null {
  const cookies = req.headers.cookie || "";
  const sessionCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("__session="))
    ?.split("=")[1];

  if (!sessionCookie) return null;

  try {
    const payloadBase64 = sessionCookie.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // GET /api/media — list all files from R2
  if (req.method === "GET") {
    try {
      const r2Files = await db
        .select()
        .from(mediaFiles)
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
