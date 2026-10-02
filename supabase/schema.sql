-- Run once in the Supabase SQL editor.
create table choreos (
  id text not null,                       -- uid() is an 8-char string, not a uuid
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  data jsonb not null,
  schema_version int not null default 1,
  updated_at timestamptz not null,        -- the choreography's own updatedAt (sync version)
  primary key (user_id, id)
);

alter table choreos enable row level security;

create policy own on choreos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Needed when "Automatically expose new tables" is off: only logged-in users get access.
grant select, insert, update, delete on choreos to authenticated;

-- Read-only share links (added in v0.11.0; run this block on projects created before).
alter table choreos add column if not exists share_token text unique;

create or replace function get_shared_choreo(token text) returns jsonb
language sql security definer set search_path = public as $$
  select data from choreos where share_token = token and token is not null
$$;
revoke all on function get_shared_choreo(text) from public;
grant execute on function get_shared_choreo(text) to anon, authenticated;
