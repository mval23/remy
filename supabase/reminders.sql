-- Remy: phone reminders (push notifications).
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
--
-- How it works:
--   1. Each phone or computer that turns on notifications saves its push subscription here.
--   2. The app saves the week's reminders (what to say, and when) whenever the plan changes.
--   3. Every 10 minutes, a scheduled job (pg_cron) finds reminders that are due and sends them,
--      through the remy-push Edge Function, which holds the private notification key.

-- The scheduler and the web-request tool.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- One row per device that turned on notifications.
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  updated_at   timestamptz not null default now()
);

-- The upcoming week's reminders. The app replaces the unsent ones whenever the plan changes.
create table if not exists public.reminders (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  send_at  timestamptz not null,
  title    text not null,
  body     text not null,
  url      text not null default '',
  tag      text not null default '',
  sent_at  timestamptz
);
create index if not exists reminders_due on public.reminders (send_at) where sent_at is null;

-- Row-level security: each signed-in person sees and changes only their own rows.
alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "Own subscriptions" on public.push_subscriptions;
create policy "Own subscriptions" on public.push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Own reminders" on public.reminders;
create policy "Own reminders" on public.reminders
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions, public.reminders from anon;
grant select, insert, update, delete on public.push_subscriptions, public.reminders to authenticated;

-- Called by the scheduled job: sends reminders that are due (at most 6 hours late) and marks them sent.
-- Runs with the owner's rights, so only the scheduler may call it.
create or replace function public.send_due_reminders(fn_url text, secret text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_ids bigint[];
  payload jsonb;
begin
  select array_agg(r.id) into due_ids
  from public.reminders r
  where r.sent_at is null and r.send_at <= now() and r.send_at > now() - interval '6 hours';

  if due_ids is null then
    return 0;
  end if;

  update public.reminders set sent_at = now() where id = any (due_ids);

  select jsonb_agg(jsonb_build_object(
           'subscription', s.subscription, 'title', r.title, 'body', r.body, 'url', r.url, 'tag', r.tag))
    into payload
  from public.reminders r
  join public.push_subscriptions s on s.user_id = r.user_id
  where r.id = any (due_ids);

  if payload is not null then
    perform net.http_post(
      url := fn_url,
      body := jsonb_build_object('messages', payload),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret)
    );
  end if;

  -- Tidy up: old reminders, and devices that haven't opened Remy in 60 days.
  delete from public.reminders where send_at < now() - interval '3 days';
  delete from public.push_subscriptions where updated_at < now() - interval '60 days';

  return cardinality(due_ids);
end;
$$;

revoke all on function public.send_due_reminders(text, text) from public, anon, authenticated;
