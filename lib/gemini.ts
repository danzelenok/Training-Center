import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Zod schemas for Slide structure validation
export const SlideContentSchema = z.union([
  z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
    visualKeywords: z.string().min(1),
  }),
  z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
    audioScript: z.string().min(1),
  }),
  z.object({
    heading: z.string().min(1),
    dialogueLines: z.array(
      z.object({
        character: z.string().min(1),
        text: z.string().min(1),
      })
    ).min(1),
  }),
  z.object({
    heading: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().min(1),
  }),
]);

export const SlideInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    content: z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("audio"),
    content: z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
      audioScript: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("dialogue"),
    content: z.object({
      heading: z.string().min(1),
      dialogueLines: z.array(
        z.object({
          character: z.string().min(1),
          text: z.string().min(1),
        })
      ).min(1),
    }),
  }),
  z.object({
    type: z.literal("quiz"),
    content: z.object({
      heading: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
      correctIndex: z.number().int().nonnegative(),
      explanation: z.string().min(1),
    }),
  }),
]);

export type SlideInput = z.infer<typeof SlideInputSchema>;

const systemInstruction = `You are an expert safety training content creator.
Generate a structured, cohesive, and educational slide deck for a safety training course based on the topic prompt.
The course must cover essential safety concepts, scaffolded logically, and end with a relevant evaluation quiz to test knowledge.

CRITICAL DESIGN REQUIREMENT: The course slides are designed for a 9:16 vertical mobile presentation screen layout.
Therefore, you MUST strictly adhere to the following length constraints to ensure all content fits beautifully without scrolling, scrollbars, or text clipping:

- Text Slide:
  * "heading": Extremely concise, maximum 4-6 words (no more than 30 characters). Auto-wrapping is supported but must not exceed 2 lines.
  * "body": Punchy, bite-sized instructions. Maximum 2-3 short sentences (no more than 150-180 characters total). Avoid large blocks of paragraphs!

- Audio Slide:
  * "heading": Maximum 4-5 words (no more than 25 characters).
  * "body": Maximum 1-2 short sentences (no more than 100 characters).
  * "audioScript": Narration script, maximum 250 characters.

- Dialogue Slide (Conversational roleplay):
  * "heading": Maximum 4-5 words (no more than 25 characters).
  * "dialogueLines": Maximum 3 conversational turns. Each spoken text line must be very short, maximum 12-15 words (no more than 80 characters per line).

- Quiz Slide:
  * "heading" (question): A short, clear question, maximum 8-10 words (no more than 50 characters).
  * "options": Provide exactly 3 short options (maximum 25 characters per option).
  * "explanation": Extremely brief explanation, maximum 1 sentence (no more than 80 characters).

You must return a raw JSON array of slides. Do not wrap the JSON in markdown code blocks, do not output any surrounding explanation or markdown. Return ONLY the JSON array.

Each slide in the array must be an object matching one of the following schemas:

1. Text Slide:
   {
     "type": "text",
     "content": {
       "heading": "Slide Title/Heading",
       "body": "Clear, detailed safety content and instructions"
     }
   }

2. Audio Slide:
   {
     "type": "audio",
     "content": {
       "heading": "Narrated Safety Scenario",
       "body": "Brief audio summary shown to the user on screen",
       "audioScript": "Complete detailed voiceover narration script"
     }
   }

3. Dialogue Slide (Conversational roleplay):
   {
     "type": "dialogue",
     "content": {
       "heading": "Site Dialogue Scenario",
       "dialogueLines": [
         { "character": "Supervisor / Worker A", "text": "Evacuation route B is blocked by debris. We need to clear it." },
         { "character": "Worker / Worker B", "text": "Got it. I will get the site team and start moving it now." }
       ]
     }
   }

4. Quiz Slide:
   {
     "type": "quiz",
     "content": {
       "heading": "Evacuation/Safety Question?",
       "options": ["First potential answer", "Second potential answer", "Third potential answer"],
       "correctIndex": 0,
       "explanation": "Why this answer is the correct safety procedure"
     }
   }

Make sure to include a good mix of slide types (e.g. text slides, a dialogue roleplay, an audio explanation, and finally 1 or 2 quiz slides) to maximize worker engagement. All text must be in English.`;

export async function generateCourseStructure(prompt: string, modelName: string = "gemini-2.5-pro"): Promise<SlideInput[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use the specified model (e.g. gemini-3.5-flash or gemini-2.5-pro)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
  });

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: `Create a training course based on this topic: ${prompt}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = response.response.text().trim();
  if (!text) {
    throw new Error("Received empty response from Gemini API.");
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Gemini failed to output valid JSON. Output was:", text);
    throw new Error("AI generated an invalid response format. Please try again.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response did not return a valid array of slides.");
  }

  // Validate array elements
  const validatedSlides: SlideInput[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const validation = SlideInputSchema.safeParse(item);
    if (!validation.success) {
      console.error(`Slide validation failed at index ${i}:`, validation.error.format());
      console.error("Offending item:", item);
      throw new Error(`AI generated a slide with an invalid schema at index ${i + 1}.`);
    }
    validatedSlides.push(validation.data);
  }

  if (validatedSlides.length === 0) {
    throw new Error("AI did not generate any slides for the course.");
  }

  return validatedSlides;
}
