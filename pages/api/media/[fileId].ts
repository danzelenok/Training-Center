import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFromR2 } from "@/lib/r2";

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

  const { fileId } = req.query as { fileId: string };

  // DELETE /api/media/[fileId]
  if (req.method === "DELETE") {
    try {
      const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId)).limit(1);

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
