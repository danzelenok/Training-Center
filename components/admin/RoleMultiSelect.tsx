"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RoleOption {
  id: string;
  name: string;
}

interface RoleMultiSelectProps {
  roles: RoleOption[];
  selectedIds: string[];
  onToggle: (roleId: string, checked: boolean) => void;
  placeholder?: string;
}

export function RoleMultiSelect({ roles, selectedIds, onToggle, placeholder = "Select roles" }: RoleMultiSelectProps) {
  const selectedNames = roles.filter((r) => selectedIds.includes(r.id)).map((r) => r.name);
  const summary =
    selectedNames.length === 0
      ? placeholder
      : selectedNames.length <= 2
        ? selectedNames.join(", ")
        : `${selectedNames.length} roles selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background border-border rounded-xl h-10 text-xs font-normal"
        >
          <span className={selectedNames.length === 0 ? "text-muted-foreground" : "text-foreground"}>{summary}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-card border border-border" align="start">
        {roles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No roles yet.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {roles.map((role) => {
              const checked = selectedIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                    checked ? "bg-[#C8D400]/10" : "hover:bg-muted/30"
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={(v) => onToggle(role.id, v === true)} />
                  <span className="text-xs font-medium text-foreground">{role.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
