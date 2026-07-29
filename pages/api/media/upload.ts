import { NextApiRequest, NextApiResponse } from "next";
import { uploadToR2 } from "@/lib/r2";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { decodeClerkSessionCookie, resolveOrgId } from "@/lib/org";

export const config = {
  api: {
    bodyParser: false, // Bypasses all Next.js request body size limits completely
  },
};

// Read entire raw request body into a Buffer (same helper as PPTX upload)
function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Minimal multipart/form-data parser.
 * Extracts the first file field from the raw body buffer.
 */
function parseMultipartBuffer(
  raw: Buffer,
  boundary: string
): { buffer: Buffer; filename: string } | null {
  const boundaryBuf = Buffer.from("--" + boundary);
  const CRLF = Buffer.from("\r\n");
  const CRLFCRLF = Buffer.from("\r\n\r\n");

  // Find start of first part
  let start = raw.indexOf(boundaryBuf);
  if (start === -1) return null;
  start += boundaryBuf.length;

  // Find end of part headers (double CRLF)
  const headerEnd = raw.indexOf(CRLFCRLF, start);
  if (headerEnd === -1) return null;

  const headerSection = raw.slice(start, headerEnd).toString("utf-8");

  // Extract filename from Content-Disposition
  const filenameMatch = headerSection.match(/filename="([^"]+)"/i);
  const filename = filenameMatch ? filenameMatch[1] : "upload";

  // File data starts after the double CRLF
  const dataStart = headerEnd + CRLFCRLF.length;

  // Find the closing boundary
  const closingBoundary = Buffer.from("\r\n--" + boundary);
  const dataEnd = raw.indexOf(closingBoundary, dataStart);
  if (dataEnd === -1) return null;

  const fileBuffer = raw.slice(dataStart, dataEnd);
  return { buffer: fileBuffer, filename };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { userId, clerkOrgId } = decodeClerkSessionCookie(req.headers.cookie || "");
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orgId = await resolveOrgId(clerkOrgId);
  if (!orgId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
    if (!boundaryMatch) {
      return res.status(400).json({ error: "Missing multipart boundary in Content-Type" });
    }
    const boundary = boundaryMatch[1].trim();

    // Read the full raw body with no size restriction
    const raw = await getRawBody(req);

    if (!raw || raw.length === 0) {
      return res.status(400).json({ error: "Empty request body" });
    }

    const parsed = parseMultipartBuffer(raw, boundary);
    if (!parsed || parsed.buffer.length === 0) {
      return res.status(400).json({ error: "No file found in upload" });
    }

    const ext = parsed.filename.split(".").pop()?.toLowerCase() || "";
    const videoExts = ["mp4", "webm", "mov", "m4v"];
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp"];
    const audioExts = ["mp3", "wav", "m4a", "ogg"];

    const mimeMap: Record<string, string> = {
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v",
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
      mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
    };

    if (videoExts.includes(ext) || imageExts.includes(ext) || audioExts.includes(ext)) {
      const fileType = videoExts.includes(ext) ? "video" : imageExts.includes(ext) ? "image" : "audio";
      const mimeType = mimeMap[ext] || "application/octet-stream";
      const uniqueName = `${Date.now()}_${parsed.filename}`;
      const r2Key = `uploads/${fileType}/${uniqueName}`;

      const publicUrl = await uploadToR2(parsed.buffer, r2Key, mimeType);

      const [inserted] = await db.insert(mediaFiles).values({
        organizationId: orgId,
        r2Key,
        url: publicUrl,
        fileName: parsed.filename,
        fileType,
        mimeType,
        size: parsed.buffer.length,
      }).returning();

      return res.status(200).json({
        fileId: inserted.id,
        url: publicUrl,
        name: parsed.filename,
        fileType: mimeType,
        size: parsed.buffer.length,
      });
    }

    return res.status(400).json({ error: "Unsupported file extension" });
  } catch (error: any) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
