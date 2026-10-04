-- Track exactly-once support resolution email delivery.
-- This migration does not delete or rewrite support messages.
begin;

lock table public.survey_responses in share row exclusive mode;

alter table public.survey_responses
  add column if not exists resolution_email_sent_at timestamptz;

comment on column public.survey_responses.resolution_email_sent_at is
  'Set by the resolve-support-request Edge Function after Resend accepts the resolution email.';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'survey_responses'
      and column_name = 'resolution_email_sent_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'survey_responses.resolution_email_sent_at was not created';
  end if;
end
$$;

commit;
