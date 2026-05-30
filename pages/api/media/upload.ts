import { imagekit } from "@/lib/imagekit";
import { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false, // Bypasses all Next.js request body size limits completely
  },
};

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

  const userId = getUserIdFromRequest(req);
  if (!userId) {
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

    // Upload to ImageKit
    const result = await imagekit.upload({
      file: parsed.buffer,
      fileName: parsed.filename,
      useUniqueFileName: true,
    });

    return res.status(200).json({
      fileId: result.fileId,
      url: result.url,
      name: result.name,
      fileType: result.fileType,
      thumbnailUrl: result.thumbnailUrl,
      size: result.size,
    });
  } catch (error: any) {
    console.error("Error uploading to ImageKit:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
