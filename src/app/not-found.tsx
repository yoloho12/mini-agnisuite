import Link from "next/link";
import { PackageSearch, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <PackageSearch size={28} className="text-primary" />
      </div>
      <p className="text-4xl font-bold text-foreground">404</p>
      <h1 className="mt-2 text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
    </div>
  );
}
