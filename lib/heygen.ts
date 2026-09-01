import { env } from "@/env";

// Both current production avatars (Chad_Maintenance_Front, Florin_Maintain_Front_2_public) only
// support Avatar III per their `supported_api_engines` in the HeyGen v3 avatar catalog — omitting
// `engine` defaults to Avatar IV, which these avatars reject with HTTP 400.
const HEYGEN_ENGINE = { type: "avatar_iii" as const };

type VideoStatus = "pending" | "processing" | "completed" | "failed";

function getApiKey(): string {
  const apiKey = process.env.HEYGEN_API_KEY || (typeof env !== "undefined" ? env.HEYGEN_API_KEY : undefined);
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("HeyGen configuration missing");
  }
  return apiKey;
}

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
  const apiKey = getApiKey();

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

  // Resolve avatar + voice per line (mirrors the old per-line resolution), then require every
  // line in this call to share one avatar — HeyGen v3's "avatar" video type takes a single
  // `script` string, not an array of scenes, so one call can only render one speaker.
  const resolvedLines = validLines.map((line) => {
    const slotIdx = line.slotIndex !== undefined
      ? line.slotIndex
      : (line.character === "student" ? 1 : 0);

    let avatarId = slotsArray.find((s) => s.slotIndex === slotIdx)?.avatarId;
    if (!avatarId) {
      avatarId = slotIdx === 0 ? process.env.HEYGEN_INSTRUCTOR_AVATAR_ID : process.env.HEYGEN_STUDENT_AVATAR_ID;
    }
    if (!avatarId) {
      throw new Error(
        `HeyGen avatar not configured for slot ${slotIdx}. Set HEYGEN_INSTRUCTOR_AVATAR_ID / HEYGEN_STUDENT_AVATAR_ID, or pass an explicit slots[] entry.`
      );
    }

    let voiceId = customVoiceIds[slotIdx];
    if (voiceId === undefined) {
      const slotAvatarId = slotsArray.find((s) => s.slotIndex === slotIdx)?.avatarId || "";
      const instAvatarId = process.env.HEYGEN_INSTRUCTOR_AVATAR_ID || "";
      const studAvatarId = process.env.HEYGEN_STUDENT_AVATAR_ID || "";
      if (slotAvatarId && slotAvatarId === instAvatarId) {
        voiceId = process.env.HEYGEN_INSTRUCTOR_VOICE_ID;
      } else if (slotAvatarId && slotAvatarId === studAvatarId) {
        voiceId = process.env.HEYGEN_STUDENT_VOICE_ID;
      } else if (slotIdx === 0) {
        voiceId = process.env.HEYGEN_INSTRUCTOR_VOICE_ID;
      } else {
        voiceId = process.env.HEYGEN_STUDENT_VOICE_ID;
      }
    }

    return { slotIdx, avatarId, voiceId: voiceId || "", text: line.text.trim() };
  });

  const uniqueSlots = new Set(resolvedLines.map((r) => r.slotIdx));
  if (uniqueSlots.size > 1) {
    throw new Error(
      `submitDialogueVideo: got lines for multiple speakers (slots ${[...uniqueSlots].join(", ")}) in one call. ` +
      `HeyGen v3's "avatar" video type has no multi-scene equivalent to the old video_inputs[] array — split lines by speaker before calling.`
    );
  }

  const { avatarId, voiceId } = resolvedLines[0];
  // Multiple consecutive lines from the same speaker are joined into one script, since v3 has no
  // per-line scene boundary for the "avatar" video type.
  const script = resolvedLines.map((r) => r.text).join("\n");

  console.log(`[HeyGen] Submitting ${validLines.length} lines joined into one script, slot=${resolvedLines[0].slotIdx}, avatar="${avatarId}"`);

  const submitStart = Date.now();
  const response = await fetch("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      script,
      ...(voiceId ? { voice_id: voiceId } : {}),
      engine: HEYGEN_ENGINE,
      resolution: "720p",
      aspect_ratio: "16:9",
    }),
  });
  const submitMs = Date.now() - submitStart;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HeyGen] POST /v3/videos failed in ${submitMs}ms: ${response.status} ${errorText}`);
    throw new Error(`HeyGen generate API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen API returned a response without video_id: ${JSON.stringify(result)}`);
  }

  console.log(`[HeyGen] POST /v3/videos → jobId=${videoId} in ${submitMs}ms`);
  return videoId;
}

export async function submitSingleVideo(params: {
  avatarId: string;
  voiceId: string;
  text: string;
}): Promise<string> {
  const apiKey = getApiKey();

  if (!params.text.trim()) {
    throw new Error("Speech text is required");
  }

  const payload = {
    type: "avatar",
    avatar_id: params.avatarId,
    script: params.text.trim(),
    voice_id: params.voiceId,
    engine: HEYGEN_ENGINE,
    resolution: "720p",
    aspect_ratio: "16:9",
  };

  console.log("[submitSingleVideo] payload:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.heygen.com/v3/videos", {
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
 * Checks the status of a HeyGen video job via GET /v3/videos/{videoId}.
 */
export async function checkDialogueVideoStatus(
  videoId: string
): Promise<{ status: VideoStatus; videoUrl?: string; error?: string }> {
  const apiKey = getApiKey();

  const pollStart = Date.now();
  const response = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
    headers: {
      "x-api-key": apiKey,
    },
  });
  const pollMs = Date.now() - pollStart;

  if (!response.ok) {
    const errorText = await response.text();
    return { status: "failed", error: `v3 status request failed with HTTP ${response.status} (${pollMs}ms): ${errorText}` };
  }

  const resJson = await response.json();
  const data = resJson.data;
  console.log(`[HeyGen] GET /v3/videos job=${videoId} → status="${data?.status}" in ${pollMs}ms`);

  const rawStatus = data?.status;

  if (rawStatus === "completed") {
    return { status: "completed", videoUrl: data?.video_url };
  }

  if (rawStatus === "failed") {
    const code = data?.failure_code || "UNKNOWN";
    const msg = data?.failure_message || "HeyGen rendering failed";
    return { status: "failed", error: `${code}: ${msg}` };
  }

  if (rawStatus === "processing") {
    return { status: "processing" };
  }

  // "waiting" (observed) and "pending" (documented) both mean queued, not yet rendering.
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
