import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { generateSlideAssets, regenerateSingleSlideAsset, pollHeygenJobStatus } from "@/lib/inngest-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateSlideAssets,
    regenerateSingleSlideAsset,
    pollHeygenJobStatus,
  ],
});
