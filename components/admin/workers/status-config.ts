import { CircleDashed, PlayCircle, CheckCircle } from "lucide-react";

export const STATUS_CONFIG = {
  not_started: {
    label: "Not Started",
    icon: CircleDashed,
    className: "text-muted-foreground bg-muted border-border",
  },
  in_progress: {
    label: "In Progress",
    icon: PlayCircle,
    className: "text-blue-600 bg-blue-500/10 border-blue-500/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  },
};
