-- Create storage bucket for PO attachments
insert into storage.buckets (id, name, public)
values ('po-attachments', 'po-attachments', false);

-- RLS policies for storage
create policy "Org members can upload PO attachments"
on storage.objects for insert
with check (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);

create policy "Org members can read own PO attachments"
on storage.objects for select
using (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);

create policy "Org members can delete own PO attachments"
on storage.objects for delete
using (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);
