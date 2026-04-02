"use client";

interface SortToggleProps {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
}

export function SortToggle({ sort, onSortChange }: SortToggleProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1">
      <button
        onClick={() => onSortChange("newest")}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          sort === "newest"
            ? "bg-neon-cyan/10 text-neon-cyan"
            : "text-muted hover:text-foreground"
        }`}
      >
        Newest
      </button>
      <button
        onClick={() => onSortChange("oldest")}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          sort === "oldest"
            ? "bg-neon-cyan/10 text-neon-cyan"
            : "text-muted hover:text-foreground"
        }`}
      >
        Oldest
      </button>
    </div>
  );
}
