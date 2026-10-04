-- Remove only records explicitly marked as test feedback.
-- Preserve all 196 registered profiles and 24 pre-launch teams.
begin;

with deleted as (
  delete from public.survey_responses
  where feedback like '[TEST FEEDBACK]%'
  returning id
)
select count(*) as deleted_test_feedback from deleted;

do $$
begin
  if exists (
    select 1
    from public.survey_responses
    where feedback like '[TEST FEEDBACK]%'
  ) then
    raise exception 'Cleanup verification failed: marked test feedback remains';
  end if;
end;
$$;

commit;
