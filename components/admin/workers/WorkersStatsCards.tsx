import { Users, CheckCircle, Clock, Loader2 } from "lucide-react";

interface WorkersStatsCardsProps {
  loading: boolean;
  totalEnrolled: number;
  activeThisWeek: number;
  pendingModules: number;
}

export function WorkersStatsCards({
  loading,
  totalEnrolled,
  activeThisWeek,
  pendingModules,
}: WorkersStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalEnrolled}
          </p>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
            Total Workers
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : activeThisWeek}
          </p>
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
          <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : pendingModules}
          </p>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
            Pending Modules
          </p>
        </div>
      </div>
    </div>
  );
}
