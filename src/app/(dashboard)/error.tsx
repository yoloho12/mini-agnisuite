"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";

/**
 * Route-segment error boundary — catches render/action failures inside the
 * dashboard and shows a friendly recovery UI instead of a raw crash page.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
    toast.error("Page failed to load", {
      description: friendlyErrorMessage(error, "An unexpected error occurred."),
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15">
        <AlertTriangle size={24} className="text-danger" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {friendlyErrorMessage(error, "This page hit an unexpected error. Your data is safe — try again.")}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <RefreshCw size={14} /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover transition-colors"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
