import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const published = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
    })
    .from(courses)
    .where(eq(courses.status, "published"));

  return NextResponse.json(published);
}
