-- Private routing overrides for campaign email delivery. This keeps corrected
-- delivery addresses separate from authentication credentials and supports
-- suppressing ineligible registrations without deleting their account.

create table if not exists public.campaign_email_routing (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_override text,
  suppress boolean not null default false,
  reason text check (reason is null or char_length(reason) <= 500),
  updated_at timestamptz not null default now(),
  check (email_override is null or email_override ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

alter table public.campaign_email_routing enable row level security;
revoke all on public.campaign_email_routing from public, anon, authenticated;
