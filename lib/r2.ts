import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

/**
 * Uploads a file to R2. Accepts a Buffer or a remote URL (downloads it first).
 * Returns the public URL.
 */
export async function uploadToR2(
  file: Buffer | string,
  key: string,
  contentType: string
): Promise<string> {
  let body: Buffer;

  if (typeof file === "string") {
    // Remote URL (e.g. HeyGen's temporary video URL) — download first
    const res = await fetch(file);
    if (!res.ok) throw new Error(`Failed to fetch source file: ${res.status}`);
    body = Buffer.from(await res.arrayBuffer());
  } else {
    body = file;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Extracts the R2 object key from a full public URL. */
export function keyFromR2Url(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, "");
}
