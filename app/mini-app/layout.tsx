"use client";

import Script from "next/script";
import { useEffect } from "react";

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      if (tg.requestFullscreen) {
        tg.requestFullscreen();
      }
    }
  }, []);

  return (
    <div className="bg-black text-white h-[100dvh] w-screen overflow-hidden flex flex-col select-none relative font-sans">
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </div>
  );
}
