import { env } from "@/env";

/**
 * Searches Pexels for the best-match landscape photo and returns its URL.
 */
export async function searchPhoto(keywords: string): Promise<string> {
  const apiKey = env.PEXELS_API_KEY || process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not configured on the server.");
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", keywords);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pexels Search API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const data = await response.json();
  if (!data.photos || data.photos.length === 0) {
    throw new Error(`No landscape photos found on Pexels for keywords: "${keywords}"`);
  }

  // Return the best-match landscape image URL
  const photo = data.photos[0];
  return photo.src.landscape || photo.src.large || photo.src.original;
}
