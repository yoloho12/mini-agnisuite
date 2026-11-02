import { createClient } from "@/lib/supabase/server";
import type { Site, SiteReceiver } from "@/types";

export async function getSites(orgId: string): Promise<Site[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getSite(id: string): Promise<Site | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSite(site: Omit<Site, "id" | "created_at">): Promise<Site> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .insert(site)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSite(id: string, updates: Partial<Site>): Promise<Site> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSite(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) throw error;
}

export async function getSiteReceivers(orgId: string, siteId: string): Promise<SiteReceiver[]> {
  const supabase = await createClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) return [];

  const { data, error } = await supabase
    .from("site_receivers")
    .select("*")
    .eq("site_id", siteId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createSiteReceiver(receiver: Omit<SiteReceiver, "id">): Promise<SiteReceiver> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_receivers")
    .insert(receiver)
    .select()
    .single();
  if (error) throw error;
  return data;
}
