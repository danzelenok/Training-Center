import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Zod schemas for Slide structure validation
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
        dialogueLines: z.array(z.object({ character: z.string().min(1), text: z.string().min(1) })).min(2).max(2),
        dialogueBelowType: z.literal("text"),
        belowText: z.string().min(1),
      }),
      z.object({
        heading: z.string().min(1),
        dialogueLines: z.array(z.object({ character: z.string().min(1), text: z.string().min(1) })).min(2).max(2),
        dialogueBelowType: z.literal("quiz"),
        belowQuizQuestion: z.string().min(1),
        belowQuizOptions: z.array(z.string().min(1)).min(2).max(8),
        belowQuizType: z.enum(["single", "multiple"]),
        belowQuizCorrectIndices: z.array(z.number().int().nonnegative()).min(1),
        belowQuizExplanation: z.string().min(1),
      }),
    ]),
  }),
  z.object({
    type: z.literal("chat"),
    content: z.union([
      z.object({
        heading: z.string().min(1),
        chatBubbles: z.array(z.object({ id: z.string().min(1), align: z.enum(["left", "right"]), type: z.literal("text"), text: z.string().min(1) })).min(2).max(6),
        belowType: z.literal("text"),
        body: z.string().min(1),
        chatVolume: z.number().int().min(40).max(80),
      }),
      z.object({
        heading: z.string().min(1),
        chatBubbles: z.array(z.object({ id: z.string().min(1), align: z.enum(["left", "right"]), type: z.literal("text"), text: z.string().min(1) })).min(2).max(6),
        belowType: z.literal("image"),
        visualKeywords: z.string().min(1),
        chatVolume: z.number().int().min(40).max(80),
      }),
      z.object({
        heading: z.string().min(1),
        chatBubbles: z.array(z.object({ id: z.string().min(1), align: z.enum(["left", "right"]), type: z.literal("text"), text: z.string().min(1) })).min(2).max(6),
      }),
    ]),
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
      quizType: z.enum(["single", "multiple"]),
      correctIndices: z.array(z.number().int().nonnegative()).min(1),
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

// Shuffles a list of options and remaps a set of correct-answer indices onto their
// new positions. `indices` maps new position -> old position, so an old index i now
// lives at indices.indexOf(i).
function shuffleOptionsAndIndices(options: string[], correctIndices: number[]): { options: string[]; correctIndices: number[] } {
  const indices = options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const newOptions = indices.map((i) => options[i]);
  const newCorrectIndices = correctIndices.map((old) => indices.indexOf(old));

  return { options: newOptions, correctIndices: newCorrectIndices };
}

function shuffleQuizOptions(slide: SlideInput): SlideInput {
  if (slide.type === "quiz") {
    const { options, correctIndices } = shuffleOptionsAndIndices(slide.content.options, slide.content.correctIndices);
    return {
      ...slide,
      content: { ...slide.content, options, correctIndices },
    };
  }

  if (slide.type === "dialogue" && slide.content.dialogueBelowType === "quiz") {
    const { options, correctIndices } = shuffleOptionsAndIndices(
      slide.content.belowQuizOptions,
      slide.content.belowQuizCorrectIndices
    );
    return {
      ...slide,
      content: { ...slide.content, belowQuizOptions: options, belowQuizCorrectIndices: correctIndices },
    };
  }

  return slide;
}

// Slides that reference an externally-generated asset (image/audio/video)
// start out "pending" until the async asset-generation pipeline fills them in.
export function slideNeedsGeneratedAsset(slide: { type: string; content: any }): boolean {
  return (
    slide.type === "audio" ||
    slide.type === "dialogue" ||
    slide.type === "video" ||
    (slide.type === "text" && !!slide.content?.visualKeywords) ||
    (slide.type === "chat" && slide.content?.belowType === "image" && !!slide.content?.visualKeywords)
  );
}

// Parses and validates a Gemini JSON response against SlideInputSchema. Shared
// by generateCourseStructure and generateJurisdictionAddendum so both go
// through the exact same validation + quiz-option-shuffling path.
function parseAndValidateSlides(text: string): SlideInput[] {
  if (!text) {
    throw new Error("Received empty response from Gemini API.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Gemini failed to output valid JSON. Output was:", text);
    throw new Error("AI generated an invalid response format. Please try again.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response did not return a valid array of slides.");
  }

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
    throw new Error("AI did not generate any slides.");
  }

  return validatedSlides.map(shuffleQuizOptions);
}

// One-line summary of a slide for feeding into the addendum prompt as
// "here's what the course already covers" context, without shipping the
// full slide JSON (which would eat into the context budget for no benefit).
function summarizeSlideForContext(slide: SlideInput): string {
  switch (slide.type) {
    case "text":
    case "audio":
    case "video":
      return `${slide.content.heading} — ${slide.content.body}`;
    case "quiz":
      return `${slide.content.heading} (quiz)`;
    case "poll":
      return `${slide.content.heading} (poll)`;
    case "dialogue":
      return slide.content.dialogueBelowType === "quiz"
        ? `${slide.content.heading} (roleplay + quiz: ${slide.content.belowQuizQuestion})`
        : `${slide.content.heading} (roleplay: ${slide.content.belowText})`;
    case "chat":
      return `${slide.content.heading} (chat)`;
    default:
      return "";
  }
}

const slideLengthConstraints = `CRITICAL DESIGN REQUIREMENT: Slides are displayed on a 9:16 vertical mobile screen. You MUST strictly adhere to these length constraints:

- Text Slide: heading ≤ 30 chars (max 2 lines), body ≤ 180 chars (2-3 short sentences max).
- Audio Slide: heading ≤ 25 chars, body ≤ 100 chars, audioScript ≤ 250 chars.
- Dialogue Slide: heading ≤ 25 chars, exactly 2 dialogue lines, each line up to 200 chars.
- Chat Slide: heading ≤ 25 chars, each bubble text ≤ 80 chars, 2-6 bubbles total.
- Video Slide: heading ≤ 25 chars, body ≤ 100 chars, speechText ≤ 1400 chars (the avatar's voiceover — max 2 minutes of speech at natural pace).
- Quiz Slide: heading (question) ≤ 50 chars, 2 to 8 options each ≤ 25 chars (vary the count across quiz slides in the same course), explanation ≤ 80 chars.
- Poll (Rate) Slide: heading ≤ 60 chars (a reflection or rating prompt).

You must return a raw JSON array of slides. Do not wrap the JSON in markdown code blocks. Return ONLY the JSON array.`;

const slideTypeCatalog = `AVAILABLE SLIDE TYPES — use all of them creatively based on what fits the topic best:

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
   Use for supervisor-worker scenarios, safety briefings, or demonstrating correct behavior on site.
   IMPORTANT: dialogueLines must contain EXACTLY 2 entries — no more, no less. The first line belongs to the LEFT avatar (the instructor/supervisor, character name can be "Supervisor" or "Instructor"). The second line is the reply from the RIGHT avatar (the worker/student, character name can be "Worker" or "Student"). Each line can be up to 200 characters — make them substantive and realistic, not just one short sentence.
   IMPORTANT: every dialogue slide MUST include embedded below-content — either a short text reinforcement or a quiz question. Never leave dialogueBelowType as "none". Choose "text" to summarize the key takeaway, or "quiz" to test what was just shown.

   With embedded text (dialogueBelowType: "text"):
   {
     "type": "dialogue",
     "content": {
       "heading": "Scaffold Check",
       "dialogueLines": [
         { "character": "Supervisor", "text": "Before we start today, I need you to inspect all four scaffolding anchor points. Check that each one is fully secured and that the safety clips are locked in place." },
         { "character": "Worker", "text": "Done — all four anchors are secure and the clips are locked. I also checked the platform boards for any loose sections. Everything looks good." }
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
         { "character": "Supervisor", "text": "You must have your hard hat on before stepping into any designated zone on site. No exceptions — it's a non-negotiable rule regardless of how brief your visit is." },
         { "character": "Worker", "text": "Understood. I'll always put it on before entering. I'll also make sure my high-vis vest is on since I know that's required too." }
       ],
       "dialogueBelowType": "quiz",
       "belowQuizQuestion": "When must a hard hat be worn?",
       "belowQuizOptions": ["Before entering the zone", "Only when working above 2m", "Only indoors"],
       "belowQuizType": "single",
       "belowQuizCorrectIndices": [0],
       "belowQuizExplanation": "Hard hats are required any time you enter a designated zone."
     }
   }

5. Chat Slide (WhatsApp-style message thread):
   Use to simulate a text conversation — e.g. a worker messaging a supervisor, or a team safety check-in. Alternate left/right bubbles. Use sequential numeric string IDs ("1", "2", "3"...).
   IMPORTANT: if the chat thread is short (2-3 bubbles) it will only fill the top half of the screen. In that case you MUST fill the bottom half with either a text reinforcement or a photo — use "belowType": "text" with a "body" summary, or "belowType": "image" with "visualKeywords". Set "chatVolume" to 55-65 to split the space. Only skip belowType when the chat fills the screen naturally (5-6 long bubbles).

   Short chat with text below:
   {
     "type": "chat",
     "content": {
       "heading": "Morning Check-In",
       "chatBubbles": [
         { "id": "1", "align": "left", "type": "text", "text": "All ladders secured and inspected?" },
         { "id": "2", "align": "right", "type": "text", "text": "Yes, tags are up to date." }
       ],
       "belowType": "text",
       "body": "Always confirm equipment status before starting a shift.",
       "chatVolume": 60
     }
   }

   Short chat with image below:
   {
     "type": "chat",
     "content": {
       "heading": "PPE Check",
       "chatBubbles": [
         { "id": "1", "align": "left", "type": "text", "text": "Is your PPE on?" },
         { "id": "2", "align": "right", "type": "text", "text": "Helmet, gloves, boots — all on." }
       ],
       "belowType": "image",
       "visualKeywords": "worker ppe protective equipment site",
       "chatVolume": 55
     }
   }

   Long chat (no below needed):
   {
     "type": "chat",
     "content": {
       "heading": "Incident Report",
       "chatBubbles": [
         { "id": "1", "align": "left", "type": "text", "text": "There was a near-miss at zone C." },
         { "id": "2", "align": "right", "type": "text", "text": "Is anyone hurt?" },
         { "id": "3", "align": "left", "type": "text", "text": "No injuries. Reported to safety officer." },
         { "id": "4", "align": "right", "type": "text", "text": "Good. File the incident report by end of day." },
         { "id": "5", "align": "left", "type": "text", "text": "Will do. Area is cordoned off." }
       ]
     }
   }

6. Video Slide (HeyGen avatar speaking, auto-generated):
   Use for a talking-head explanation of a key concept or a personal safety message. This is not a required intro or outro — place it wherever it fits best in the course, not always first or last. The avatar speaks the speechText aloud.
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
   Set "quizType" to "single" when exactly one option is correct, or "multiple" when more than one fact/option applies — list every correct option's index in "correctIndices". Favor "single" for most questions; use "multiple" only when the question genuinely has more than one correct answer (e.g. "Which of these are required PPE?").

   Single-answer example:
   {
     "type": "quiz",
     "content": {
       "heading": "What protects from falls?",
       "options": ["Safety harness", "Hard hat", "Safety glasses", "Steel-toe boots"],
       "quizType": "single",
       "correctIndices": [0],
       "explanation": "A safety harness prevents falls from height."
     }
   }

   Multiple-answer example:
   {
     "type": "quiz",
     "content": {
       "heading": "Which are required before working at height?",
       "options": ["Safety harness", "Hard hat", "Anchor point inspection", "Sunglasses"],
       "quizType": "multiple",
       "correctIndices": [0, 1, 2],
       "explanation": "Harness, hard hat, and a checked anchor point are all required before working at height."
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
`;

const systemInstruction = `You are an expert safety training content creator.
Generate a structured, cohesive, and educational slide deck for a safety training course based on the topic prompt.
The course must cover essential safety concepts, scaffolded logically.

${slideLengthConstraints}

${slideTypeCatalog}
Use all slide types creatively. Vary the format to keep learners engaged. All text must be in English.`;

const addendumSystemInstruction = `You are an expert safety training content creator, writing a short addendum to an existing safety training course.
You will be given a summary of the course's existing slides and official regulatory reference materials for a specific jurisdiction.

Generate 2 to 4 NEW slides that add requirements, procedures, or details that are SPECIFIC to that jurisdiction and are not already covered by the existing slides. Ground every factual claim strictly in the reference materials provided — do not introduce safety requirements, numbers, or practices that are not present in them. Do not repeat content the existing slides already cover; if the reference materials don't reveal anything meaningfully different from the base course, it's fine to focus the addendum on jurisdiction-specific context instead (e.g. which agency enforces it, the applicable state plan name) as long as it stays grounded in the reference materials.

${slideLengthConstraints}

${slideTypeCatalog}
Generate 2 to 4 slides total. All text must be in English.`;

export async function generateCourseStructure(
  prompt: string,
  modelName: string = "gemini-2.5-pro",
  lniContext?: string,
  regulatorName: string = "Washington State L&I"
): Promise<SlideInput[]> {
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

  const userMessage = lniContext
    ? `REFERENCE MATERIALS FROM ${regulatorName.toUpperCase()}:\n${lniContext}\n\nBase all factual claims, requirements, and procedures strictly on the reference materials above. Do not introduce safety requirements, numbers, or practices that are not present in the reference materials. You may vary the structure, wording, examples, and order of presentation freely — but the underlying factual content must come only from the source above. Create a training course based on this topic: ${prompt}`
    : `Create a training course based on this topic: ${prompt}`;

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  return parseAndValidateSlides(response.response.text().trim());
}

// Generates 2-4 additional slides that supplement an already-generated base
// course with content specific to one jurisdiction, grounded in that
// jurisdiction's regulatory reference materials. Uses a separate system
// prompt from generateCourseStructure — this is explicitly an addendum, not
// a full course, and must be told what's already covered so it doesn't repeat it.
export async function generateJurisdictionAddendum(
  baseSlides: SlideInput[],
  jurisdictionName: string,
  regulatoryContext: string,
  topic: string,
  modelName: string = "gemini-2.5-pro"
): Promise<SlideInput[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: addendumSystemInstruction,
  });

  const baseSlidesSummary = baseSlides
    .map((slide, i) => `${i + 1}. [${slide.type}] ${summarizeSlideForContext(slide)}`)
    .join("\n");

  const userMessage = `COURSE TOPIC: ${topic}\n\nEXISTING COURSE SLIDES (do not repeat this content):\n${baseSlidesSummary}\n\nOFFICIAL REFERENCE MATERIALS FROM ${jurisdictionName.toUpperCase()}:\n${regulatoryContext}\n\nGenerate 2-4 additional slides that supplement the course above with requirements specific to ${jurisdictionName}, grounded strictly in the reference materials.`;

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  return parseAndValidateSlides(response.response.text().trim());
}
