"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerReportsTab } from "@/components/admin/reports/WorkerReportsTab";
import { CourseReportsTab } from "@/components/admin/reports/CourseReportsTab";

export default function ReportsPage() {
  const [tab, setTab] = useState<"workers" | "courses">("workers");

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Analytics & Reports
          </h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "workers" | "courses")}>
          <TabsList>
            <TabsTrigger value="workers" className="text-xs gap-1.5">
              Workers
            </TabsTrigger>
            <TabsTrigger value="courses" className="text-xs gap-1.5">
              Courses
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "workers" ? <WorkerReportsTab /> : <CourseReportsTab />}
    </div>
  );
}
