import { createClient } from "@/lib/supabase/server";
import type { Warehouse } from "@/types";

export async function getWarehouses(orgId: string): Promise<Warehouse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getWarehouse(id: string): Promise<Warehouse | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createWarehouse(warehouse: Omit<Warehouse, "id" | "created_at">): Promise<Warehouse> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .insert(warehouse)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWarehouse(id: string, updates: Partial<Warehouse>): Promise<Warehouse> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWarehouse(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) throw error;
}
