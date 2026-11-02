"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, requireRole } from "@/lib/auth";
import * as contactRepo from "@/repositories/contactRepo";
import type { Contact } from "@/types";

export async function fetchContacts(orgId?: string, type?: string) {
  void orgId;
  return contactRepo.getContacts(await getCurrentOrgId(), type);
}

export async function fetchContact(id: string) {
  const record = await contactRepo.getContact(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Contact");
  return record;
}

export async function addContact(contact: Omit<Contact, "id" | "created_at" | "org_id">) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  const result = await contactRepo.createContact({ ...contact, org_id: orgId });
  revalidatePath("/contacts");
  return result;
}

export async function editContact(id: string, updates: Partial<Contact>) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await contactRepo.getContact(id), await getCurrentOrgId(), "Contact");
  const safeUpdates = { ...updates };
  delete safeUpdates.org_id;
  const result = await contactRepo.updateContact(id, safeUpdates);
  revalidatePath("/contacts");
  return result;
}

export async function removeContact(id: string) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await contactRepo.getContact(id), await getCurrentOrgId(), "Contact");
  await contactRepo.deleteContact(id);
  revalidatePath("/contacts");
}