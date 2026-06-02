import { env } from "@/env";

// Fallbacks for avatar IDs if not configured
export const DEFAULT_INSTRUCTOR_AVATAR_ID = "Edward_public_20240311";
export const DEFAULT_STUDENT_AVATAR_ID = "Diana_public_20240311";

/**
 * Submits dialogue video generation request to HeyGen.
 * If HEYGEN_API_KEY is missing, throws "HeyGen configuration missing".
 * Empty or whitespace-only lines are filtered out. If no lines remain, throws.
 */
export async function submitDialogueVideo(
  lines: { character: "instructor" | "student"; text: string }[],
  instructorAvatarId?: string,
  studentAvatarId?: string
): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY || (typeof env !== "undefined" ? env.HEYGEN_API_KEY : undefined);
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("HeyGen configuration missing");
  }

  // Filter out empty lines
  const validLines = lines.filter((line) => line.text && line.text.trim() !== "");
  if (validLines.length === 0) {
    throw new Error("No valid dialogue lines to generate video.");
  }

  const instAvatar = instructorAvatarId || process.env.HEYGEN_INSTRUCTOR_AVATAR_ID || DEFAULT_INSTRUCTOR_AVATAR_ID;
  const studAvatar = studentAvatarId || process.env.HEYGEN_STUDENT_AVATAR_ID || DEFAULT_STUDENT_AVATAR_ID;
  const instLookId = process.env.HEYGEN_INSTRUCTOR_AVATAR_LOOK_ID;
  const studLookId = process.env.HEYGEN_STUDENT_AVATAR_LOOK_ID;

  // Map valid dialogue lines to HeyGen video inputs (scenes)
  const videoInputs = validLines.map((line) => {
    const avatarId = line.character === "instructor" ? instAvatar : studAvatar;
    const lookId = line.character === "instructor" ? instLookId : studLookId;
    return {
      character: {
        type: "avatar",
        avatar_id: avatarId,
        ...(lookId ? { avatar_look_id: lookId } : {}),
        avatar_style: "normal",
      },
      voice: {
        type: "text",
        input_text: line.text,
      },
    };
  });

  const response = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      video_inputs: videoInputs,
      dimension: {
        width: 1280,
        height: 720,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen generate API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen API returned a response without video_id: ${JSON.stringify(result)}`);
  }

  return videoId;
}

/**
 * Checks the status of a HeyGen video job.
 * Polls GET /v1/video_status.get?video_id={videoId} with fallback to GET /v3/videos/{videoId}.
 */
export async function checkDialogueVideoStatus(
  videoId: string
): Promise<{ status: "pending" | "processing" | "completed" | "failed"; videoUrl?: string; error?: string }> {
  const apiKey = process.env.HEYGEN_API_KEY || (typeof env !== "undefined" ? env.HEYGEN_API_KEY : undefined);
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("HeyGen configuration missing");
  }

  let data: any;
  try {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`v1 status request failed with HTTP ${response.status}`);
    }

    const resJson = await response.json();
    data = resJson.data;
  } catch (err) {
    console.warn(`HeyGen v1 status check failed for video ${videoId}, falling back to v3...`, err);
    try {
      const responseV3 = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      if (!responseV3.ok) {
        throw new Error(`v3 status request failed with HTTP ${responseV3.status}`);
      }
      const resJsonV3 = await responseV3.json();
      data = resJsonV3.data;
    } catch (v3Err: any) {
      return { status: "failed", error: v3Err.message || "Failed to query video status" };
    }
  }

  const status = data?.status || "pending";
  const videoUrl = data?.video_url;

  if (status === "completed") {
    return { status: "completed", videoUrl };
  }

  if (status === "failed") {
    const code = data?.error?.code || data?.failure_code || "UNKNOWN";
    const msg = data?.error?.message || data?.failure_message || "HeyGen rendering failed";
    return { status: "failed", error: `${code}: ${msg}` };
  }

  if (status === "processing" || status === "pending" || status === "waiting") {
    return { status: "processing" };
  }

  return { status: "pending" };
}

/**
 * Standard implementation that submits and polls until complete (using exponential backoff).
 */
export async function createDialogueVideo(
  lines: { character: "instructor" | "student"; text: string }[],
  instructorAvatarId?: string,
  studentAvatarId?: string
): Promise<string> {
  const videoId = await submitDialogueVideo(lines, instructorAvatarId, studentAvatarId);

  const maxTimeMs = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();
  let delay = 5000; // 5s initial delay

  while (Date.now() - startTime < maxTimeMs) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    const check = await checkDialogueVideoStatus(videoId);
    if (check.status === "completed") {
      if (!check.videoUrl) throw new Error("HeyGen job completed but videoUrl was not returned.");
      return check.videoUrl;
    }
    if (check.status === "failed") {
      throw new Error(`HeyGen video generation failed: ${check.error}`);
    }

    // Exponential backoff up to 30s max
    delay = Math.min(delay * 2, 30000);
  }

  throw new Error("HeyGen video generation timed out after 10 minutes.");
}
