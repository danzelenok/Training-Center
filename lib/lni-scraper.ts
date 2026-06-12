const LNI_FETCH_TIMEOUT_MS = 5000;
const MAX_TEXT_PER_PAGE = 3000;
const MAX_TOTAL_CONTEXT = 8000;

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

  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(`site:lni.wa.gov ${topic}`)}&count=3`;

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

  if (!searchRes.ok) {
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }
  const data = await searchRes.json();
  const urls: string[] = (data.web?.results || []).map((item: any) => item.url);

  if (urls.length === 0) {
    return { sources: [], sourcesText: "", sourcesDescription: "" };
  }

  const sources: { url: string; title: string; text: string }[] = [];

  for (const url of urls) {
    try {
      const pageRes = await withTimeout(url, LNI_FETCH_TIMEOUT_MS);
      if (!pageRes.ok) continue;
      const html = await pageRes.text();
      const { title, text } = extractPageText(html);
      if (text.length > 100) {
        sources.push({ url, title: title || url, text });
      }
    } catch {
      // skip failed pages
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
