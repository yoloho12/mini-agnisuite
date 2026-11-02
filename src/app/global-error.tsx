"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
    toast.error("Something went wrong", {
      description: friendlyErrorMessage(error, "An unexpected error occurred."),
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
          color: "#e4e4e7",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <AlertTriangle size={40} style={{ color: "#f87171", margin: "0 auto 1rem" }} />
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
            {friendlyErrorMessage(error, "An unexpected error occurred. Your data is safe — please try again.")}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#6d5ae6",
                color: "#fff",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Try again
            </button>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #27272a",
                color: "#e4e4e7",
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
