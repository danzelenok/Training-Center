"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  CheckCircle,
  Clock,
  UserPlus,
  Filter,
  ArrowUpDown,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";

// Mock worker profiles
const mockWorkers = [
  {
    id: "w1",
    name: "Alex Johnson",
    username: "alex_j_safety",
    telegramId: "6483920192",
    coursesCompleted: 4,
    coursesActive: 1,
    status: "Active",
    lastActive: "10 mins ago",
  },
  {
    id: "w2",
    name: "Dmitry Petrov",
    username: "dmitry_p_saf",
    telegramId: "7294018274",
    coursesCompleted: 5,
    coursesActive: 0,
    status: "Active",
    lastActive: "2 hours ago",
  },
  {
    id: "w3",
    name: "Sarah Miller",
    username: "sarah_m_engineer",
    telegramId: "8102938472",
    coursesCompleted: 2,
    coursesActive: 2,
    status: "On Leave",
    lastActive: "3 days ago",
  },
  {
    id: "w4",
    name: "Ivan Sokolov",
    username: "ivan_s_tech",
    telegramId: "9028172645",
    coursesCompleted: 0,
    coursesActive: 1,
    status: "Active",
    lastActive: "1 day ago",
  },
  {
    id: "w5",
    name: "Elena Rostova",
    username: "elena_r_hse",
    telegramId: "5940182749",
    coursesCompleted: 6,
    coursesActive: 0,
    status: "Active",
    lastActive: "5 mins ago",
  },
];

export default function WorkersPage() {
  const [search, setSearch] = useState("");
  const [workersList] = useState(mockWorkers);

  const filteredWorkers = workersList.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.username.toLowerCase().includes(search.toLowerCase()) ||
      w.telegramId.includes(search)
  );

  const handlePingWorker = (name: string) => {
    toast.success(`Direct reminder ping dispatched to ${name}'s Telegram app!`);
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Workers Management
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Monitor registered workers, inspect active Telegram session IDs, and broadcast direct DMs.
          </p>
        </div>

        <Button className="h-11 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold shadow-lg shadow-[#C8D400]/25 gap-2 border-0 cursor-pointer transition-all duration-200">
          <UserPlus className="h-5 w-5" />
          Enroll Worker
        </Button>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">42</p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Total Enrolled
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">38</p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Active This Week
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8D400]/10 border border-[#C8D400]/20 text-[#C8D400]">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">4</p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Pending Modules
            </p>
          </div>
        </div>
      </div>

      {/* Filtering & Table Panel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by worker name, user ID..."
              className="pl-9 bg-background border-border text-foreground rounded-xl placeholder-muted-foreground focus-visible:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground bg-background hover:bg-muted hover:text-foreground rounded-lg flex items-center gap-1 w-1/2 sm:w-auto cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground bg-background hover:bg-muted hover:text-foreground rounded-lg flex items-center gap-1 w-1/2 sm:w-auto cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort
            </Button>
          </div>
        </div>

        {/* Workers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">Worker / Username</th>
                <th className="px-6 py-4">Telegram ID</th>
                <th className="px-6 py-4">Completed</th>
                <th className="px-6 py-4">Active Modules</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredWorkers.map((worker) => (
                <tr key={worker.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#1B2A6B] dark:text-white">{worker.name}</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      @{worker.username}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground text-xs">
                    {worker.telegramId}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-xs border border-border">
                      {worker.coursesCompleted} courses
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-foreground">
                    {worker.coursesActive > 0 ? (
                      <span className="text-[#C8D400] font-bold">{worker.coursesActive} active</span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {worker.lastActive}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePingWorker(worker.name)}
                      className="text-[#C8D400] hover:bg-[#C8D400]/10 hover:text-[#B6C200] text-xs font-bold rounded-lg cursor-pointer h-9 px-3"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Ping Direct
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
