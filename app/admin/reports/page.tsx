"use client";

import React from "react";
import {
  FileText,
  TrendingUp,
  Award,
  Bell,
  CheckCircle,
  Download,
  Calendar,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";

// Mock report records
const coursesStats = [
  { title: "Fire Safety Basics", completions: 88, active: 12, avgScore: "94%" },
  { title: "Chemical Hazard Awareness", completions: 72, active: 28, avgScore: "89%" },
  { title: "Electrical Lockout/Tagout", completions: 95, active: 5, avgScore: "96%" },
  { title: "Working at Heights safely", completions: 60, active: 40, avgScore: "91%" },
];

const recentCompletions = [
  { worker: "Alex Johnson", course: "Electrical Lockout/Tagout", score: "100%", date: "10 mins ago" },
  { worker: "Elena Rostova", course: "Chemical Hazard Awareness", score: "90%", date: "1 hour ago" },
  { worker: "Dmitry Petrov", course: "Fire Safety Basics", score: "95%", date: "3 hours ago" },
  { worker: "Sarah Miller", course: "Electrical Lockout/Tagout", score: "80%", date: "1 day ago" },
];

export default function ReportsPage() {
  const handleExportData = () => {
    toast.success("Generating comprehensive XLS/PDF safety report download...");
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Analytics & Reports
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Review organizational compliance scores, average quiz statistics, and download compliance audits.
          </p>
        </div>

        <Button
          onClick={handleExportData}
          className="h-11 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold shadow-lg shadow-[#C8D400]/25 gap-2 border-0 cursor-pointer transition-all duration-200"
        >
          <Download className="h-5 w-5" />
          Export Safety Logs
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Completion Rate</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">83.8%</span>
            <span className="text-xs text-emerald-500 font-semibold">+4.2% YoY</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Average Quiz Score</span>
            <Award className="h-5 w-5 text-[#C8D400]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">92.5%</span>
            <span className="text-xs text-muted-foreground font-semibold">Passing: 80%</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Total Reminders Sent</span>
            <Bell className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">247</span>
            <span className="text-xs text-muted-foreground font-semibold">Automated in BG</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Compliant Workers</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">96.4%</span>
            <span className="text-xs text-muted-foreground font-semibold">Goal: 98%</span>
          </div>
        </div>
      </div>

      {/* Visual Chart Mockup (Pure CSS & HTML) and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Glowing CSS Progress Funnel Bar Graph */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#C8D400]" /> Module Completion Progress
            </h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Updated realtime
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {coursesStats.map((item, index) => (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground/90">{item.title}</span>
                  <span className="text-muted-foreground font-mono">
                    {item.completions}% complete ({item.active}% active)
                  </span>
                </div>
                <div className="relative h-4.5 w-full bg-background border border-border rounded-full overflow-hidden">
                  <div
                    style={{ width: `${item.completions}%` }}
                    className="h-full bg-gradient-to-r from-[#1B2A6B] to-[#C8D400] shadow-md rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Completion Feed */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 transition-all duration-300">
          <h3 className="text-base font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> Recent completions
          </h3>

          <div className="space-y-3">
            {recentCompletions.map((log, index) => (
              <div key={index} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground/90 truncate">{log.worker}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{log.course}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className="inline-flex rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20">
                    {log.score}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">{log.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
