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
      visualKeywords: z.string().optional(),
      imageAlign: z.enum(["top", "bottom", "full"]).optional(),
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
    content: z.union([
      z.object({
        heading: z.string().min(1),
        dialogueLines: z.array(z.object({ character: z.string().min(1), text: z.string().min(1) })).min(1),
        dialogueBelowType: z.literal("text"),
        belowText: z.string().min(1),
      }),
      z.object({
        heading: z.string().min(1),
        dialogueLines: z.array(z.object({ character: z.string().min(1), text: z.string().min(1) })).min(1),
        dialogueBelowType: z.literal("quiz"),
        belowQuizQuestion: z.string().min(1),
        belowQuizOptions: z.array(z.string().min(1)).min(2).max(8),
        belowQuizCorrectIndex: z.number().int().nonnegative(),
        belowQuizExplanation: z.string().min(1),
      }),
      z.object({
        heading: z.string().min(1),
        dialogueLines: z.array(z.object({ character: z.string().min(1), text: z.string().min(1) })).min(1),
        dialogueBelowType: z.literal("none").optional(),
      }),
    ]),
  }),
  z.object({
    type: z.literal("chat"),
    content: z.object({
      heading: z.string().min(1),
      chatBubbles: z.array(
        z.object({
          id: z.string().min(1),
          align: z.enum(["left", "right"]),
          type: z.literal("text"),
          text: z.string().min(1),
        })
      ).min(2).max(6),
    }),
  }),
  z.object({
    type: z.literal("video"),
    content: z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
      speechText: z.string().min(1).max(1400),
      avatarId: z.enum(["instructor", "student"]),
      videoMode: z.literal("generate"),
    }),
  }),
  z.object({
    type: z.literal("quiz"),
    content: z.object({
      heading: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(8),
      correctIndex: z.number().int().nonnegative(),
      explanation: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("poll"),
    content: z.object({
      heading: z.string().min(1),
      pollType: z.enum(["stars", "emojis", "thumbs"]),
    }),
  }),
]);

export type SlideInput = z.infer<typeof SlideInputSchema>;

const systemInstruction = `You are an expert safety training content creator.
Generate a structured, cohesive, and educational slide deck for a safety training course based on the topic prompt.
The course must cover essential safety concepts, scaffolded logically.

CRITICAL DESIGN REQUIREMENT: Slides are displayed on a 9:16 vertical mobile screen. You MUST strictly adhere to these length constraints:

- Text Slide: heading ≤ 30 chars (max 2 lines), body ≤ 180 chars (2-3 short sentences max).
- Audio Slide: heading ≤ 25 chars, body ≤ 100 chars, audioScript ≤ 250 chars.
- Dialogue Slide: heading ≤ 25 chars, dialogueLines max 3 turns, each line ≤ 80 chars.
- Chat Slide: heading ≤ 25 chars, each bubble text ≤ 80 chars, 2-6 bubbles total.
- Video Slide: heading ≤ 25 chars, body ≤ 100 chars, speechText ≤ 1400 chars (the avatar's voiceover — max 2 minutes of speech at natural pace).
- Quiz Slide: heading (question) ≤ 50 chars, exactly 3 options each ≤ 25 chars, explanation ≤ 80 chars.
- Poll (Rate) Slide: heading ≤ 60 chars (a reflection or rating prompt).

You must return a raw JSON array of slides. Do not wrap the JSON in markdown code blocks. Return ONLY the JSON array.

AVAILABLE SLIDE TYPES — use all of them creatively based on what fits the topic best:

1. Text Slide with background image:
   Use for key facts, rules, or visually-supported concepts. Include "visualKeywords" — 2-4 English keywords for a relevant background photo.
   - "imageAlign": controls where the photo sits — "top" (image fills top portion, text below), "bottom" (image at bottom, text above), "full" (image fills entire background). Choose based on what looks best for the content.
   - IMPORTANT: every "visualKeywords" value across all slides must be UNIQUE — never repeat the same keywords twice, so each slide gets a different photo.
   {
     "type": "text",
     "content": {
       "heading": "Wear Your Hard Hat",
       "body": "Hard hats protect from falling objects. Always wear one on site.",
       "visualKeywords": "construction worker hard hat safety",
       "imageAlign": "top"
     }
   }

2. Text Slide (no image needed):
   Use when visual context would distract or isn't helpful.
   {
     "type": "text",
     "content": {
       "heading": "Key Safety Rules",
       "body": "Never bypass lockout/tagout. Always verify power is off before maintenance."
     }
   }

3. Audio Slide (auto-generated voiceover):
   Use for narrated summaries, safety reminders, or key instructions. The audioScript is spoken aloud by a voice AI.
   {
     "type": "audio",
     "content": {
       "heading": "Listen Up",
       "body": "Hear the correct procedure before starting.",
       "audioScript": "Before operating any equipment, inspect it for visible damage. Report defects immediately to your supervisor."
     }
   }

4. Dialogue Slide (two-person video roleplay, auto-generated by HeyGen):
   Use for supervisor-worker scenarios, safety briefings, or demonstrating correct behavior on site. The dialogueLines are performed by two AI avatars.
   IMPORTANT: every dialogue slide MUST include embedded below-content — either a short text reinforcement or a quiz question. Never leave dialogueBelowType as "none". Choose "text" to summarize the key takeaway, or "quiz" to test what was just shown.

   With embedded text (dialogueBelowType: "text"):
   {
     "type": "dialogue",
     "content": {
       "heading": "Scaffold Check",
       "dialogueLines": [
         { "character": "Supervisor", "text": "Have you checked the scaffolding anchors today?" },
         { "character": "Worker", "text": "Yes, all four anchor points are secure." }
       ],
       "dialogueBelowType": "text",
       "belowText": "Always inspect anchor points before starting work at height."
     }
   }

   With embedded quiz (dialogueBelowType: "quiz"):
   {
     "type": "dialogue",
     "content": {
       "heading": "PPE Reminder",
       "dialogueLines": [
         { "character": "Supervisor", "text": "Your hard hat must be on before entering the zone." },
         { "character": "Worker", "text": "Got it, putting it on now." }
       ],
       "dialogueBelowType": "quiz",
       "belowQuizQuestion": "When must a hard hat be worn?",
       "belowQuizOptions": ["Before entering the zone", "Only when working above 2m", "Only indoors"],
       "belowQuizCorrectIndex": 0,
       "belowQuizExplanation": "Hard hats are required any time you enter a designated zone."
     }
   }

5. Chat Slide (WhatsApp-style message thread):
   Use to simulate a text conversation — e.g. a worker messaging a supervisor, or a team safety check-in. Alternate left/right bubbles. Use sequential numeric string IDs ("1", "2", "3"...).
   {
     "type": "chat",
     "content": {
       "heading": "Check-In Message",
       "chatBubbles": [
         { "id": "1", "align": "left", "type": "text", "text": "All ladders secured and inspected?" },
         { "id": "2", "align": "right", "type": "text", "text": "Yes, done. Tags are up to date." },
         { "id": "3", "align": "left", "type": "text", "text": "Great. Proceed with the shift." }
       ]
     }
   }

6. Video Slide (HeyGen avatar speaking, auto-generated):
   Use for a talking-head explanation of a key concept, a personal safety message, or a module introduction/conclusion. The avatar speaks the speechText aloud.
   {
     "type": "video",
     "content": {
       "heading": "Instructor Message",
       "body": "Watch this important safety reminder.",
       "speechText": "Welcome to today's module. Remember: no task is so urgent that it cannot be done safely. Your life is the priority.",
       "avatarId": "instructor",
       "videoMode": "generate"
     }
   }

7. Quiz Slide (knowledge check):
   Use to test understanding of a rule or procedure just covered. Choose how many options fit the question — you can use 2 (true/false style), 3, 4, or up to 8 options. More options make harder questions; fewer options work for simple yes/no or binary choices.
   {
     "type": "quiz",
     "content": {
       "heading": "What protects from falls?",
       "options": ["Safety harness", "Hard hat", "Safety glasses", "Steel-toe boots"],
       "correctIndex": 0,
       "explanation": "A safety harness prevents falls from height."
     }
   }

8. Poll / Rate Slide (reflection or feedback):
   Use at the end of a section or the whole course to collect a quick learner reaction. Choose the pollType that fits: "stars" for quality rating, "emojis" for mood/feeling, "thumbs" for agree/disagree.
   {
     "type": "poll",
     "content": {
       "heading": "How confident do you feel about hammer safety?",
       "pollType": "stars"
     }
   }

Use all slide types creatively. Vary the format to keep learners engaged. All text must be in English.`;


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
      temperature: 0.7,
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
