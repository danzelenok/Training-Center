import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";
import { parseOffice } from "officeparser";
import { decodeClerkSessionCookie, resolveOrgId } from "@/lib/org";

export const config = {
  api: {
    bodyParser: false, // Bypasses all Next.js request body size limits completely
  },
};

// Helper to recursively extract text from a node
function extractNodeText(node: any): string {
  if (node.text !== undefined && node.text !== null) {
    return node.text;
  }
  if (node.children && node.children.length > 0) {
    return node.children.map(extractNodeText).filter(Boolean).join("\n");
  }
  return "";
}

// Helper to extract slide body text, joining components with double newlines
function extractSlideText(slideNode: any): string {
  if (slideNode.children && slideNode.children.length > 0) {
    return slideNode.children
      .map((child: any) => extractNodeText(child).trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return extractNodeText(slideNode).trim();
}

// Helper to read raw stream into a Buffer
function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id } = req.query as { id: string };

    // Decode Clerk session cookie manually to verify auth since this route bypasses Next.js middleware 10MB limit
    const { userId, clerkOrgId } = decodeClerkSessionCookie(req.headers.cookie || "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const orgId = await resolveOrgId(clerkOrgId);
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1. Fetch course details, scoped to this organization
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.status !== "draft") {
      return res.status(400).json({ error: "Cannot upload slides to a published course" });
    }

    // 2. Check filename from custom headers
    const filename = decodeURIComponent((req.headers["x-filename"] as string) || "presentation.pptx");
    if (!filename.toLowerCase().endsWith(".pptx")) {
      return res.status(400).json({ error: "Only PowerPoint (.pptx) files are supported" });
    }

    // 3. Read raw request body directly as a pristine binary Buffer copy
    const buffer = await getRawBody(req);

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "No file uploaded or file is empty" });
    }

    console.log(`Successfully received raw PPTX stream. Buffer size: ${buffer.length} bytes`);

    let ast;
    try {
      console.log(`Parsing PPTX presentation upload for course ID ${id}...`);
      ast = await parseOffice(buffer, { ignoreNotes: true, fileType: "pptx" });
    } catch (parseError: any) {
      console.error("OfficeParser failed to parse presentation:", parseError);
      return res.status(422).json({
        error: "Failed to parse PPTX file structure",
        details: `${parseError.message} (Buffer size: ${buffer.length} bytes)`,
      });
    }

    if (!ast || !Array.isArray(ast.content) || ast.content.length === 0) {
      return res.status(422).json({ error: "The uploaded PPTX has an empty or invalid structure." });
    }

    // 4. Retrieve slide nodes
    let slideNodes = ast.content.filter((node: any) => node.type === "slide");
    if (slideNodes.length === 0) {
      slideNodes = [
        {
          type: "slide",
          children: ast.content,
          metadata: { slideNumber: 1 },
        },
      ];
    }

    console.log(`Found ${slideNodes.length} slides inside PPTX file. Importing into DB...`);

    // 5. Save Slides — neon-http doesn't support transactions, use sequential operations
    // Step 1: Delete existing slides for this course
    await db.delete(slides).where(eq(slides.courseId, id));

    // Step 2: Map parsed PPTX slides to DB insertion format
    const slidesToInsert = slideNodes.map((node: any, index: number) => {
      let title = "";
      if (node.children) {
        const headingNode = node.children.find((child: any) => child.type === "heading");
        if (headingNode) {
          title = extractNodeText(headingNode).trim();
        }
      }

      if (!title && node.children) {
        const firstChild = node.children.find((child: any) => extractNodeText(child).trim() !== "");
        if (firstChild) {
          title = extractNodeText(firstChild).trim();
        }
      }

      if (title.includes("\n")) {
        title = title.split("\n")[0];
      }
      if (title.length > 60) {
        title = title.slice(0, 60) + "...";
      }

      const slideNumber = node.metadata?.slideNumber || (index + 1);
      if (!title) {
        title = `Slide ${slideNumber}`;
      }

      const textContent = extractSlideText(node);

      return {
        courseId: id,
        order: index + 1,
        type: "text" as const,
        content: {
          title,
          text: textContent,
        },
      };
    });

    // Step 3: Insert new slides
    if (slidesToInsert.length > 0) {
      await db.insert(slides).values(slidesToInsert);
    }

    // Step 4: Fetch final inserted slides
    const finalSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.courseId, id))
      .orderBy(slides.order);

    return res.status(200).json({
      success: true,
      slides: finalSlides,
    });
  } catch (error: any) {
    console.error("Unhandled error processing course PPTX upload:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
