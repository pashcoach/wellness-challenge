-- Keep the top-team lunch and random-team lunch with different teams.

begin;

-- Reassert the approved grand-prize rule: 140+ points in every week and no
-- participant who has already won a weekly draw.
create or replace function public.run_grand_prize_draw()
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_eligible integer;
begin
  perform public.require_current_user_admin();

  select count(*) into v_eligible
  from public.profiles p
  where public.user_week_points(p.id, 1) >= 140
    and public.user_week_points(p.id, 2) >= 140
    and public.user_week_points(p.id, 3) >= 140
    and public.user_week_points(p.id, 4) >= 140
    and not exists (
      select 1 from public.draw_results d where d.user_id = p.id
    );

  if v_eligible < 2 then
    raise exception 'Grand prize needs 2 eligible participants; only % available.', v_eligible;
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('grand', auth.uid());
  exception when unique_violation then
    raise exception 'Grand prize draw has already been run.';
  end;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, 1) >= 140
      and public.user_week_points(p.id, 2) >= 140
      and public.user_week_points(p.id, 3) >= 140
      and public.user_week_points(p.id, 4) >= 140
      and not exists (
        select 1 from public.draw_results d where d.user_id = p.id
      )
    order by random()
    limit 2
  loop
    insert into public.draw_results (draw_key, user_id) values ('grand', v_user);
    winner_name := (select p.full_name from public.profiles p where p.id = v_user);
    winner_business_unit := (select p.business_unit from public.profiles p where p.id = v_user);
    return next;
  end loop;
end;
$$;

create or replace function public.run_random_team_draw()
returns table (team_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_top_team uuid;
begin
  perform public.require_current_user_admin();

  -- This matches the admin dashboard's top-team ranking. The additional
  -- name/id ordering makes an exact tie deterministic.
  select ts.id into v_top_team
  from public.team_standings ts
  order by ts.avg desc, ts.name asc, ts.id asc
  limit 1;

  select t.id into v_team
  from public.teams t
  where t.id <> v_top_team
    and exists (
      select 1
      from public.profiles p
      join public.activity_entries a on a.user_id = p.id
      where p.team_id = t.id
    )
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'No activity-eligible teams remain after excluding the top team.';
  end if;

  begin
    insert into public.draw_runs (draw_key, run_by) values ('team_random', auth.uid());
  exception when unique_violation then
    raise exception 'Random team draw has already been run.';
  end;

  insert into public.draw_results (draw_key, team_id) values ('team_random', v_team);
  team_name := (select t.name from public.teams t where t.id = v_team);
  return next;
end;
$$;

revoke all on function public.run_random_team_draw() from public, anon, authenticated;
revoke all on function public.run_grand_prize_draw() from public, anon, authenticated;
grant execute on function public.run_random_team_draw() to authenticated;
grant execute on function public.run_grand_prize_draw() to authenticated;

commit;
