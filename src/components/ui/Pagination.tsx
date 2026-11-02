"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Minimal pagination: previous/next chevrons pinned to the outer edges and a
 * dynamic "Page X of Y" indicator in the middle.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  ariaLabel = "Pagination",
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("mt-4 flex items-center justify-between gap-3", className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(safePage - 1)}
        disabled={safePage <= 1}
        aria-label="Previous page"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground-dim transition-colors hover:bg-card-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-muted" aria-live="polite">
        Page {safePage} of {safeTotal}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(safePage + 1)}
        disabled={safePage >= safeTotal}
        aria-label="Next page"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground-dim transition-colors hover:bg-card-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
