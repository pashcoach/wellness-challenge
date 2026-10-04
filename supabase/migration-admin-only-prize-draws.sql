-- Production security hardening — step 3: administrator-only prize RPCs
--
-- Authenticated users need EXECUTE permission so the admin web page can call
-- these functions, but every function must also verify the caller's profile.
-- Anonymous and PUBLIC execution are explicitly revoked.

begin;

create or replace function public.require_current_user_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Administrator access required.';
  end if;
end;
$$;

revoke all on function public.require_current_user_admin() from public, anon;
grant execute on function public.require_current_user_admin() to authenticated;

create or replace function public.run_weekly_draw(p_week integer)
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_key text := 'week' || p_week;
  v_user uuid;
begin
  perform public.require_current_user_admin();

  if exists (select 1 from public.draw_results where draw_key = v_draw_key) then
    raise exception 'Week % draw has already been run.', p_week;
  end if;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, p_week) >= 140
      and not exists (select 1 from public.draw_results d where d.user_id = p.id)
    order by random()
  loop
    if (select count(*) from public.draw_results where draw_key = v_draw_key) < 2 then
      insert into public.draw_results (draw_key, user_id) values (v_draw_key, v_user);
      winner_name := (select full_name from public.profiles where id = v_user);
      winner_business_unit := (select business_unit from public.profiles where id = v_user);
      return next;
    else
      exit;
    end if;
  end loop;

  if not exists (select 1 from public.draw_results where draw_key = v_draw_key) then
    raise exception 'No eligible participants for week % draw (need 140+ points).', p_week;
  end if;
end;
$$;

create or replace function public.run_grand_prize_draw()
returns table (winner_name text, winner_business_unit text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform public.require_current_user_admin();

  if exists (select 1 from public.draw_results where draw_key = 'grand') then
    raise exception 'Grand prize draw has already been run.';
  end if;

  for v_user in
    select p.id
    from public.profiles p
    where public.user_week_points(p.id, 1) >= 140
      and public.user_week_points(p.id, 2) >= 140
      and public.user_week_points(p.id, 3) >= 140
      and public.user_week_points(p.id, 4) >= 140
      and not exists (select 1 from public.draw_results d where d.user_id = p.id)
    order by random()
  loop
    if (select count(*) from public.draw_results where draw_key = 'grand') < 2 then
      insert into public.draw_results (draw_key, user_id) values ('grand', v_user);
      winner_name := (select full_name from public.profiles where id = v_user);
      winner_business_unit := (select business_unit from public.profiles where id = v_user);
      return next;
    else
      exit;
    end if;
  end loop;

  if not exists (select 1 from public.draw_results where draw_key = 'grand') then
    raise exception 'No eligible participants for the grand prize (need 140 pts every week).';
  end if;
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
begin
  perform public.require_current_user_admin();

  if exists (select 1 from public.draw_results where draw_key = 'team_random') then
    raise exception 'Random team draw has already been run.';
  end if;

  select t.id into v_team
  from public.teams t
  where exists (
    select 1
    from public.profiles p
    join public.activity_entries a on a.user_id = p.id
    where p.team_id = t.id
  )
  order by random()
  limit 1;

  if v_team is null then
    raise exception 'No teams with activity found for the random draw.';
  end if;

  insert into public.draw_results (draw_key, team_id) values ('team_random', v_team);
  team_name := (select name from public.teams where id = v_team);
  return next;
end;
$$;

revoke all on function public.run_weekly_draw(integer) from public, anon, authenticated;
revoke all on function public.run_grand_prize_draw() from public, anon, authenticated;
revoke all on function public.run_random_team_draw() from public, anon, authenticated;

grant execute on function public.run_weekly_draw(integer) to authenticated;
grant execute on function public.run_grand_prize_draw() to authenticated;
grant execute on function public.run_random_team_draw() to authenticated;

-- Migration self-check: the anonymous role must not retain execution rights.
do $$
begin
  if has_function_privilege('anon', 'public.run_weekly_draw(integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.run_grand_prize_draw()', 'EXECUTE')
    or has_function_privilege('anon', 'public.run_random_team_draw()', 'EXECUTE') then
    raise exception 'Security check failed: anon can execute a prize function';
  end if;
end;
$$;

commit;
