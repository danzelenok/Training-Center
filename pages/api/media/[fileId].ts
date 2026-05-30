import { imagekit } from "@/lib/imagekit";
import { NextApiRequest, NextApiResponse } from "next";

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
      await imagekit.deleteFile(fileId);
      return res.status(200).json({ success: true, fileId });
    } catch (error: any) {
      console.error("Error deleting ImageKit file:", error);
      return res.status(500).json({ error: error.message || "Failed to delete file" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
