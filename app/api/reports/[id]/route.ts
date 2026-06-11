import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    await db.delete(progress).where(eq(progress.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting report:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
