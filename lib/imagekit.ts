import ImageKit from "imagekit";
import { env } from "@/env";

export const imagekit = new ImageKit({
  publicKey: env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
});
