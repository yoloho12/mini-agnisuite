"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, CloudDownload, Download, Upload, HardDrive } from "lucide-react";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  runBackupAction,
  runRestoreAction,
  getBackupStatusAction,
  exportBackupJsonAction,
  importBackupJsonAction,
} from "@/app/actions/backupActions";

type Status = Awaited<ReturnType<typeof getBackupStatusAction>>;

function fmt(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BackupCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | "export" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getBackupStatusAction());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doBackup = async () => {
    setBusy("backup");
    try {
      const res = await runBackupAction();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const doRestore = async () => {
    if (!confirm("Replace ALL local data with the latest Supabase backup? This cannot be undone.")) {
      return;
    }
    setBusy("restore");
    try {
      const res = await runRestoreAction();
      if (res.ok) {
        toast.success(res.message);
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(res.message);
      }
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const doExport = async () => {
    setBusy("export");
    try {
      const json = await exportBackupJsonAction();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agnisuite-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup file downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const res = await importBackupJsonAction(text);
      if (res.ok) {
        toast.success(res.message);
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <HardDrive size={18} className="text-primary" />
        <CardTitle>Backup &amp; Sync</CardTitle>
        {status && (
          <Badge variant={status.dirty ? "warning" : "success"}>
            {status.dirty ? "Unsaved changes" : "Synced"}
          </Badge>
        )}
      </div>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Data is stored in a local database on this machine. Backups are pushed
          to Supabase Storage as JSON snapshots (auto-backup runs every 15
          minutes while the app is running).
        </p>

        {status && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted">
            <div>
              Supabase:{" "}
              {status.configured ? (
                <span className="text-success">configured</span>
              ) : (
                <span className="text-danger">not configured</span>
              )}
            </div>
            <div>Last backup: {fmt(status.lastBackupAt)}</div>
            <div>Last restore: {fmt(status.lastRestoredAt)}</div>
            {status.lastBackupError && (
              <div className="text-danger sm:col-span-2">
                Last error: {status.lastBackupError}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={doBackup}
            loading={busy === "backup"}
            disabled={!status?.configured}
            title={status?.configured ? "Push local data to Supabase" : "Configure SUPABASE_URL / SUPABASE_SECRET_KEY first"}
          >
            <CloudUpload size={14} /> Backup now
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={doRestore}
            loading={busy === "restore"}
            disabled={!status?.configured}
          >
            <CloudDownload size={14} /> Restore from cloud
          </Button>
          <Button size="sm" variant="secondary" onClick={doExport} loading={busy === "export"}>
            <Download size={14} /> Download file
          </Button>
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
              e.target.value = "";
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
