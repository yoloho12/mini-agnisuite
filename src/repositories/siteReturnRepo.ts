import { createClient } from "@/lib/supabase/server";
import type { SiteReturn, SiteReturnLineItem } from "@/types";

export async function getSiteReturns(orgId: string): Promise<SiteReturn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_returns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSiteReturn(id: string): Promise<SiteReturn | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_returns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSiteReturn(returnData: Omit<SiteReturn, "id" | "created_at">): Promise<SiteReturn> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_returns")
    .insert(returnData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSiteReturn(id: string, updates: Partial<SiteReturn>): Promise<SiteReturn> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_returns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSiteReturnLineItems(returnId: string): Promise<SiteReturnLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_return_line_items")
    .select("*")
    .eq("return_id", returnId);
  if (error) throw error;
  return data || [];
}

export async function createSiteReturnLineItems(items: Omit<SiteReturnLineItem, "id">[]): Promise<SiteReturnLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_return_line_items")
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
}
