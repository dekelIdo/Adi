-- ============================================================================
-- contact_leads — every valid submission of the site's contact form.
--
-- HOW TO APPLY: this project has no Supabase CLI link and no service key in
-- the repository (by design). Open the Supabase dashboard → SQL Editor, paste
-- this whole file, run it once. It is idempotent: running it again is safe.
--
-- SECURITY MODEL (the same one the testimonials table relies on):
--   • anon (the public site, using the publishable key)  → INSERT only, and
--     only a fresh lead: status 'new', no admin notes. It can never read,
--     change or delete anything in this table.
--   • authenticated (a signed-in admin session, the existing /admin login)
--     → SELECT and UPDATE.
--   • nobody can DELETE through the API: no policy and no grant exist for it.
-- The service-role key is never used by the site and must never be shipped.
-- ============================================================================

create table if not exists public.contact_leads (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  full_name     text        not null,
  phone         text        not null,
  email         text,
  business_name text,
  message       text,
  source_path   text        not null    default '/',
  status        text        not null    default 'new',
  admin_notes   text        not null    default '',

  constraint contact_leads_full_name_len
    check (char_length(btrim(full_name)) between 2 and 100),
  constraint contact_leads_phone_len
    check (char_length(btrim(phone)) between 7 and 20),
  constraint contact_leads_email_len
    check (email is null or char_length(email) <= 254),
  constraint contact_leads_business_name_len
    check (business_name is null or char_length(business_name) <= 150),
  constraint contact_leads_message_len
    check (message is null or char_length(message) <= 2000),
  constraint contact_leads_source_path_len
    check (char_length(source_path) <= 200),
  constraint contact_leads_admin_notes_len
    check (char_length(admin_notes) <= 4000),
  constraint contact_leads_status_allowed
    check (status in ('new', 'contacted', 'closed'))
);

create index if not exists contact_leads_created_at_idx
  on public.contact_leads (created_at desc);
create index if not exists contact_leads_status_idx
  on public.contact_leads (status);

alter table public.contact_leads enable row level security;

-- Privileges first: RLS decides which rows, grants decide which verbs. Both
-- are set explicitly so the table does not inherit anything wider.
revoke all on table public.contact_leads from anon, authenticated;
grant insert          on table public.contact_leads to anon;
grant select, update  on table public.contact_leads to authenticated;

-- The public site may create a lead, and only a lead that looks like one.
drop policy if exists "contact_leads: public may insert a fresh lead" on public.contact_leads;
create policy "contact_leads: public may insert a fresh lead"
  on public.contact_leads
  for insert
  to anon
  with check (status = 'new' and admin_notes = '');

-- Signed-in admins may read every lead...
drop policy if exists "contact_leads: admins may read" on public.contact_leads;
create policy "contact_leads: admins may read"
  on public.contact_leads
  for select
  to authenticated
  using (true);

-- ...and update it (status and notes; the constraints above still apply).
drop policy if exists "contact_leads: admins may update" on public.contact_leads;
create policy "contact_leads: admins may update"
  on public.contact_leads
  for update
  to authenticated
  using (true)
  with check (status in ('new', 'contacted', 'closed'));

-- Intentionally no DELETE policy and no DELETE grant.
