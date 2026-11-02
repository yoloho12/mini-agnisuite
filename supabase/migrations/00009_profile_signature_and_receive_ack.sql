-- Profile: site assignment + drawn digital signature (receiving end identity)
alter table profiles add column if not exists site_id uuid;
alter table profiles add column if not exists signature text;

-- Dispatch: record when/who signed for the receipt at the receiving end
alter table dispatches add column if not exists acknowledged_at timestamptz;
alter table dispatches add column if not exists acknowledged_by uuid references auth.users(id) on delete set null;

-- PO receipt: capture the receiving user's drawn signature
alter table po_receipts add column if not exists receiver_signature text;
