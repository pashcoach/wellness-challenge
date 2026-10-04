-- Read-only launch cleanup inventory. This query does not delete anything.
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.teams) as teams,
  (select count(*) from public.activity_entries) as activity_entries,
  (select count(*) from public.wellness_checkins) as wellness_checkins,
  (select count(*) from public.survey_responses) as survey_responses,
  (select count(*) from public.user_badges) as user_badges,
  (select count(*) from public.draw_results) as draw_results,
  (select count(*) from public.draw_runs) as draw_runs,
  (select count(*) from public.survey_responses where feedback like '[TEST FEEDBACK]%') as marked_test_feedback;
