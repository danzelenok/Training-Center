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

  // GET /api/media — list all files from ImageKit
  if (req.method === "GET") {
    try {
      const files = await imagekit.listFiles({ skip: 0, limit: 100 });
      return res.status(200).json(files);
    } catch (error: any) {
      console.error("Error listing ImageKit files:", error);
      return res.status(500).json({ error: error.message || "Failed to list files" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
