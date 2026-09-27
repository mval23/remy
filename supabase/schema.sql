-- Remy: cloud copy for sign-in and sync.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- One row per person. `interview` and `plan` hold the same data the app saves on the device.
-- `interview_at` / `plan_at` record when each last changed (milliseconds), so the newest copy wins.

create table if not exists public.user_data (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  interview    jsonb,
  plan         jsonb,
  interview_at bigint not null default 0,
  plan_at      bigint not null default 0,
  updated_at   timestamptz not null default now()
);

-- Row-level security: each signed-in person can only see and change their own row.
alter table public.user_data enable row level security;

drop policy if exists "Read own data" on public.user_data;
drop policy if exists "Add own data" on public.user_data;
drop policy if exists "Change own data" on public.user_data;
drop policy if exists "Delete own data" on public.user_data;

create policy "Read own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-in users may use the table (row-level security above still limits them to their own row).
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;
