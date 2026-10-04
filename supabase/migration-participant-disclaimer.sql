-- One-time, versioned participant acknowledgement with private audit records.

begin;

create table if not exists public.participant_acknowledgements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  disclaimer_version text not null,
  health_risk_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.participant_acknowledgements enable row level security;
revoke all on table public.participant_acknowledgements from public, anon, authenticated;
grant select on table public.participant_acknowledgements to authenticated;

drop policy if exists "acknowledgements_select_own" on public.participant_acknowledgements;
create policy "acknowledgements_select_own"
on public.participant_acknowledgements
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.has_current_disclaimer_acknowledgement()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participant_acknowledgements a
    where a.user_id = auth.uid()
      and a.disclaimer_version = '2026-10-04-v1'
      and a.health_risk_accepted_at is not null
      and a.privacy_accepted_at is not null
  );
$$;

create or replace function public.accept_participant_disclaimer(p_version text)
returns table (
  disclaimer_version text,
  health_risk_accepted_at timestamptz,
  privacy_accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if p_version <> '2026-10-04-v1' then
    raise exception using errcode = '22023', message = 'The participant disclaimer has changed. Refresh and review the current version.';
  end if;

  insert into public.participant_acknowledgements (
    user_id,
    disclaimer_version,
    health_risk_accepted_at,
    privacy_accepted_at,
    created_at,
    updated_at
  )
  values (auth.uid(), p_version, now(), now(), now(), now())
  on conflict (user_id) do update
  set disclaimer_version = excluded.disclaimer_version,
      health_risk_accepted_at = excluded.health_risk_accepted_at,
      privacy_accepted_at = excluded.privacy_accepted_at,
      updated_at = excluded.updated_at;

  return query
  select a.disclaimer_version, a.health_risk_accepted_at, a.privacy_accepted_at
  from public.participant_acknowledgements a
  where a.user_id = auth.uid();
end;
$$;

revoke all on function public.has_current_disclaimer_acknowledgement() from public, anon, authenticated;
revoke all on function public.accept_participant_disclaimer(text) from public, anon, authenticated;
grant execute on function public.has_current_disclaimer_acknowledgement() to authenticated;
grant execute on function public.accept_participant_disclaimer(text) to authenticated;

-- A participant cannot create new challenge entries until the current
-- disclaimer and display-name notice have been acknowledged.
drop policy if exists "activity_insert_own" on public.activity_entries;
create policy "activity_insert_own"
on public.activity_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.has_current_disclaimer_acknowledgement()
);

drop policy if exists "checkins_insert_own" on public.wellness_checkins;
create policy "checkins_insert_own"
on public.wellness_checkins
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.has_current_disclaimer_acknowledgement()
);

-- Structural checks fail the migration if privacy or enforcement drifts.
do $$
begin
  if not exists (
    select 1
    from pg_class c
    where c.oid = 'public.participant_acknowledgements'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'Disclaimer migration failed: RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.participant_acknowledgements', 'SELECT')
     or has_table_privilege('authenticated', 'public.participant_acknowledgements', 'INSERT')
     or has_table_privilege('authenticated', 'public.participant_acknowledgements', 'UPDATE')
     or has_table_privilege('authenticated', 'public.participant_acknowledgements', 'DELETE') then
    raise exception 'Disclaimer migration failed: acknowledgement privileges are too broad';
  end if;
end;
$$;

commit;
