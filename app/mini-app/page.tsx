import React from "react";

export default function MiniAppPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
      <div className="w-full max-w-md text-center flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
          Safety Micro-Learning Player
        </h1>
        <p className="text-sm text-slate-400">
          Welcome to the Telegram Mini App client. Access courses and complete interactive safety training modules.
        </p>
      </div>
    </main>
  );
}
