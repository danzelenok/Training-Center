import { GoogleGenerativeAI } from "@google/generative-ai";

const LNI_FETCH_TIMEOUT_MS = 5000;
const MAX_TEXT_PER_PAGE = 3000;
const MAX_TOTAL_CONTEXT = 8000;

async function extractEnglishSearchQuery(prompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return prompt;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `You are helping search the Washington State L&I (Labor & Industries) safety website. Read the following course request (in any language) and decide what workplace safety topic to search for. If a specific topic is mentioned, use it. If the request is vague or says "any topic", pick a common workplace safety topic yourself (e.g. fall protection, electrical safety, scaffold safety, PPE, etc.). Reply with 3-5 English keywords only — no explanation, no punctuation.\n\nCourse request: ${prompt}`
    );
    const keywords = result.response.text().trim().replace(/\n+/g, " ").replace(/\s{2,}/g, " ");
    return keywords.length > 2 ? keywords : prompt;
  } catch {
    return prompt;
  }
}

function withTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrainingBot/1.0)" },
  }).finally(() => clearTimeout(timer));
}


function extractPageText(html: string): { title: string; text: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  const title = rawTitle.replace(/\s*[-|]\s*.*$/, "").trim(); // strip " | Washington State ..." suffix

  // Remove script/style blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    // Collapse whitespace
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length > MAX_TEXT_PER_PAGE) {
    text = text.slice(0, MAX_TEXT_PER_PAGE);
  }

  return { title, text };
}

export async function fetchLNIContext(topic: string): Promise<{
  sources: { url: string; title: string; text: string }[];
  sourcesText: string;
  sourcesDescription: string;
}> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn("[LNI] BRAVE_SEARCH_API_KEY is not set, skipping L&I context fetch.");
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }

  const searchQuery = await extractEnglishSearchQuery(topic);
  console.log("[LNI] search query:", searchQuery);
  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(`site:lni.wa.gov ${searchQuery}`)}&count=3`;
  console.log("[LNI] brave url:", searchUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LNI_FETCH_TIMEOUT_MS);
  const searchRes = await fetch(searchUrl, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  console.log("[LNI] brave status:", searchRes.status);
  if (!searchRes.ok) {
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }
  const data = await searchRes.json();
  console.log("[LNI] brave results count:", data.web?.results?.length ?? 0);
  const braveResults: { url: string; title: string; description: string }[] =
    (data.web?.results || []).map((item: any) => ({
      url: item.url,
      title: item.title || "",
      description: (item.description || "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim(),
    }));

  if (braveResults.length === 0) {
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }

  const isPdf = (url: string) => /\.(pdf|doc|docx)(\?|$)/i.test(url);

  const sources: { url: string; title: string; text: string }[] = [];

  for (const result of braveResults) {
    if (isPdf(result.url)) {
      // Use Brave snippet for non-HTML documents
      if (result.description.length > 50) {
        sources.push({ url: result.url, title: result.title || result.url, text: result.description });
      }
      continue;
    }
    try {
      const pageRes = await withTimeout(result.url, LNI_FETCH_TIMEOUT_MS);
      if (!pageRes.ok) {
        if (result.description.length > 50) {
          sources.push({ url: result.url, title: result.title || result.url, text: result.description });
        }
        continue;
      }
      const contentType = pageRes.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        if (result.description.length > 50) {
          sources.push({ url: result.url, title: result.title || result.url, text: result.description });
        }
        continue;
      }
      const html = await pageRes.text();
      const { title, text } = extractPageText(html);
      sources.push({ url: result.url, title: title || result.title || result.url, text: text.length > 100 ? text : result.description });
    } catch {
      if (result.description.length > 50) {
        sources.push({ url: result.url, title: result.title || result.url, text: result.description });
      }
    }
  }

  if (sources.length === 0) {
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }

  // Build combined context, capped at MAX_TOTAL_CONTEXT
  let combined = "";
  for (const src of sources) {
    const chunk = `--- Source: ${src.title} (${src.url}) ---\n${src.text}\n\n`;
    if (combined.length + chunk.length > MAX_TOTAL_CONTEXT) {
      const remaining = MAX_TOTAL_CONTEXT - combined.length;
      if (remaining > 200) combined += chunk.slice(0, remaining);
      break;
    }
    combined += chunk;
  }

  const sourcesDescription =
    "Based on Washington State L&I materials:\n" +
    sources.map((s) => `- ${s.title} - ${s.url}`).join("\n");

  return {
    sources,
    sourcesText: combined.trim(),
    sourcesDescription,
  };
}
