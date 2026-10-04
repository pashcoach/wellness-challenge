-- Remove only the completed production support-workflow test request.
-- Abort without deleting anything unless exactly one matching row exists.
begin;

lock table public.survey_responses in share row exclusive mode;

do $$
declare
  matching_rows integer;
begin
  select count(*)
    into matching_rows
  from public.survey_responses s
  join public.profiles p on p.id = s.user_id
  where s.feedback = 'Test comment'
    and s.category = 'help'
    and s.status = 'resolved'
    and p.first_name = 'Patrick'
    and p.last_name = 'Ash'
    and s.created_at >= timestamptz '2026-10-02 00:00:00+00'
    and s.created_at < timestamptz '2026-10-04 00:00:00+00';

  if matching_rows <> 1 then
    raise exception 'Expected exactly one completed support test request, found %.', matching_rows;
  end if;
end;
$$;

delete from public.survey_responses s
using public.profiles p
where p.id = s.user_id
  and s.feedback = 'Test comment'
  and s.category = 'help'
  and s.status = 'resolved'
  and p.first_name = 'Patrick'
  and p.last_name = 'Ash'
  and s.created_at >= timestamptz '2026-10-02 00:00:00+00'
  and s.created_at < timestamptz '2026-10-04 00:00:00+00';

do $$
begin
  if exists (
    select 1
    from public.survey_responses s
    join public.profiles p on p.id = s.user_id
    where s.feedback = 'Test comment'
      and s.category = 'help'
      and p.first_name = 'Patrick'
      and p.last_name = 'Ash'
      and s.created_at >= timestamptz '2026-10-02 00:00:00+00'
      and s.created_at < timestamptz '2026-10-04 00:00:00+00'
  ) then
    raise exception 'Support test request cleanup did not complete.';
  end if;
end;
$$;

commit;
