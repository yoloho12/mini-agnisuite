"use server";

import { requireRole } from "@/lib/auth";

import {
  backupToSupabase,
  restoreFromSupabase,
  getBackupStatus,
  exportSnapshotJson,
  importSnapshotJson,
  type BackupResult,
} from "@/lib/localdb/backup";

export async function runBackupAction(): Promise<BackupResult> {
  await requireRole(["owner"]);
  return backupToSupabase();
}

export async function runRestoreAction(): Promise<BackupResult> {
  await requireRole(["owner"]);
  return restoreFromSupabase();
}

export async function getBackupStatusAction() {
  return getBackupStatus();
}

export async function exportBackupJsonAction(): Promise<string> {
  await requireRole(["owner"]);
  return exportSnapshotJson();
}

export async function importBackupJsonAction(json: string): Promise<BackupResult> {
  await requireRole(["owner"]);
  if (!json || json.length > 200 * 1024 * 1024) {
    return { ok: false, message: "Backup file is empty or too large." };
  }
  return importSnapshotJson(json);
}
