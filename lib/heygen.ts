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
  lines: { slotIndex?: number; character?: string; text: string }[],
  slots?: { slotIndex: number; avatarId: string }[] | string,
  voiceIdsOrStudentAvatarId?: Record<number, string | undefined> | string,
  instructorVoiceId?: string,
  studentVoiceId?: string,
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

  // Normalize slots configuration and voice IDs
  let slotsArray: { slotIndex: number; avatarId: string }[] = [];
  let customVoiceIds: Record<number, string | undefined> = {};

  if (Array.isArray(slots)) {
    slotsArray = slots;
    if (typeof voiceIdsOrStudentAvatarId === "object" && voiceIdsOrStudentAvatarId !== null) {
      customVoiceIds = voiceIdsOrStudentAvatarId as Record<number, string | undefined>;
    }
  } else {
    // Legacy signature: submitDialogueVideo(lines, instructorAvatarId, studentAvatarId, instructorVoiceId, studentVoiceId)
    const instAvatar = typeof slots === "string" ? slots : "";
    const studAvatar = typeof voiceIdsOrStudentAvatarId === "string" ? voiceIdsOrStudentAvatarId : "";
    slotsArray = [
      { slotIndex: 0, avatarId: instAvatar },
      { slotIndex: 1, avatarId: studAvatar }
    ];
    customVoiceIds = {
      0: instructorVoiceId,
      1: studentVoiceId
    };
  }

  // Map valid dialogue lines to HeyGen video inputs (scenes)
  const videoInputs = validLines.map((line, idx) => {
    const slotIdx = line.slotIndex !== undefined
      ? line.slotIndex
      : (line.character === "student" ? 1 : 0);

    let avatarId = slotsArray.find((s) => s.slotIndex === slotIdx)?.avatarId;
    if (!avatarId) {
      if (slotIdx === 0) {
        avatarId = process.env.HEYGEN_INSTRUCTOR_AVATAR_ID || DEFAULT_INSTRUCTOR_AVATAR_ID;
      } else {
        avatarId = process.env.HEYGEN_STUDENT_AVATAR_ID || DEFAULT_STUDENT_AVATAR_ID;
      }
    }

    let voiceId = "";
    if (customVoiceIds[slotIdx] !== undefined) {
      voiceId = customVoiceIds[slotIdx] || "";
    } else {
      if (slotIdx === 0) {
        voiceId = process.env.HEYGEN_INSTRUCTOR_VOICE_ID || "";
      } else {
        voiceId = process.env.HEYGEN_STUDENT_VOICE_ID || "";
      }
    }

    console.log(`[submitDialogueVideo] Line ${idx + 1}: Slot ${slotIdx}, Avatar ID "${avatarId}", Voice ID "${voiceId}"`);
    return {
      character: {
        type: "avatar",
        avatar_id: avatarId,
        avatar_style: "normal",
      },
      voice: {
        type: "text",
        input_text: line.text,
        voice_id: voiceId,
      },
    };
  });

  console.log(`[HeyGen] Submitting ${validLines.length} lines, ${videoInputs.length} scenes`);

  const submitStart = Date.now();
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
  const submitMs = Date.now() - submitStart;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HeyGen] POST /v2/video/generate failed in ${submitMs}ms: ${response.status} ${errorText}`);
    throw new Error(`HeyGen generate API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen API returned a response without video_id: ${JSON.stringify(result)}`);
  }

  console.log(`[HeyGen] POST /v2/video/generate → jobId=${videoId} in ${submitMs}ms`);
  return videoId;
}

export async function submitSingleVideo(params: {
  avatarId: string;
  voiceId: string;
  text: string;
}): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("HeyGen configuration missing");
  }

  if (!params.text.trim()) {
    throw new Error("Speech text is required");
  }

  const payload = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: params.avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: params.text,
          voice_id: params.voiceId,
        },
      },
    ],
    dimension: { width: 1280, height: 720 },
  };

  console.log("[submitSingleVideo] payload:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[submitSingleVideo] error response:", response.status, errorText);
    throw new Error(`HeyGen API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen API returned no video_id: ${JSON.stringify(result)}`);
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
    const pollStart = Date.now();
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: {
        "x-api-key": apiKey,
      },
    });
    const pollMs = Date.now() - pollStart;

    if (!response.ok) {
      throw new Error(`v1 status request failed with HTTP ${response.status} (${pollMs}ms)`);
    }

    const resJson = await response.json();
    data = resJson.data;
    console.log(`[HeyGen] GET /v1/video_status.get job=${videoId} → status="${data?.status}" in ${pollMs}ms`);
  } catch (err) {
    console.warn(`[HeyGen] v1 status check failed for job=${videoId}, falling back to v3...`, err);
    try {
      const pollStart = Date.now();
      const responseV3 = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      const pollMs = Date.now() - pollStart;
      if (!responseV3.ok) {
        throw new Error(`v3 status request failed with HTTP ${responseV3.status} (${pollMs}ms)`);
      }
      const resJsonV3 = await responseV3.json();
      data = resJsonV3.data;
      console.log(`[HeyGen] GET /v3/videos job=${videoId} → status="${data?.status}" in ${pollMs}ms`);
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
