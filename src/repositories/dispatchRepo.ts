import { createClient } from "@/lib/supabase/server";
import type { Dispatch, DispatchLineItem } from "@/types";

export async function getDispatches(orgId: string): Promise<Dispatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatches")
    .select("*")
    .eq("org_id", orgId)
    .order("dispatched_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatches")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDispatch(dispatch: Omit<Dispatch, "id">): Promise<Dispatch> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatches")
    .insert(dispatch)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDispatch(id: string, updates: Partial<Dispatch>): Promise<Dispatch> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatches")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDispatchLineItems(dispatchId: string): Promise<DispatchLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_line_items")
    .select("*")
    .eq("dispatch_id", dispatchId);
  if (error) throw error;
  return data || [];
}

export async function createDispatchLineItems(items: Omit<DispatchLineItem, "id">[]): Promise<DispatchLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_line_items")
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
}
