import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check user authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse query params to determine if generating audio, image, or video
    const { searchParams } = new URL(req.url);
    const asset = searchParams.get("asset") as "audio" | "image" | "video";

    if (!asset || (asset !== "audio" && asset !== "image" && asset !== "video")) {
      return new NextResponse("Invalid asset type. Must be 'audio', 'image', or 'video'", { status: 400 });
    }

    // Verify slide exists
    const [slide] = await db
      .select()
      .from(slides)
      .where(eq(slides.id, id))
      .limit(1);

    if (!slide) {
      return new NextResponse("Slide not found", { status: 404 });
    }

    // Parse request body for optional inline content updates (like audioScript, visualKeywords, or dialogueLines)
    let body: any = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json();
      }
    } catch (e) {
      // Ignore empty or invalid JSON bodies
    }

    // Update database content if non-empty script, keywords, dialogue lines, or speechText were passed inline
    const hasNewAudioScript = body.audioScript?.trim();
    const hasNewVisualKeywords = body.visualKeywords?.trim();
    const hasNewDialogueLines = body.dialogueLines && Array.isArray(body.dialogueLines);
    const hasNewSpeechText = body.speechText?.trim();
    if (hasNewAudioScript || hasNewVisualKeywords || hasNewDialogueLines || hasNewSpeechText) {
      const updatedContent = {
        ...(slide.content as Record<string, any>),
        ...(hasNewAudioScript ? { audioScript: body.audioScript } : {}),
        ...(hasNewVisualKeywords ? { visualKeywords: body.visualKeywords } : {}),
        ...(hasNewDialogueLines ? { dialogueLines: body.dialogueLines } : {}),
        ...(hasNewSpeechText ? { speechText: body.speechText } : {}),
      };
      await db.update(slides).set({ content: updatedContent, updatedAt: new Date() }).where(eq(slides.id, id));
      slide.content = updatedContent;
    }

    // Set slide status to generating and parent course to generating
    await db.update(slides).set({ assetStatus: "generating", updatedAt: new Date() }).where(eq(slides.id, id));
    await db.update(courses).set({ generationStatus: "generating", updatedAt: new Date() }).where(eq(courses.id, slide.courseId));

    // Dispatch background asset regeneration event via Inngest
    await inngest.send({
      name: "slide/regenerate",
      data: {
        slideId: id,
        assetType: asset,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error triggering slide asset regeneration:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger slide asset regeneration" },
      { status: 500 }
    );
  }
}
