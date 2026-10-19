-- OPTIONAL production verification AFTER migration-week3-crc-guaranteed-winner.sql.
-- Run this entire file alone in Supabase SQL editor (postgres role).
-- No COMMIT: final TESTRESULT exception ALWAYS rolls back all simulated writes.
-- Temporarily locks draw/profile tables, simulates Week 3 ONCE, then tests refusal.
-- Never deletes history or reruns a previously recorded draw. Does not print winners.
-- Requires an admin and an actual eligible Week 3 CRC + compatible department.
DO $test$
DECLARE
  v_admin uuid;
  v_first_name text;
  v_first_unit text;
  v_count integer := 0;
  v_departments integer;
  v_denied boolean;
  v_before_results jsonb;
  v_before_runs jsonb;
  v_row record;
  v_top_units text[];
BEGIN
  LOCK TABLE public.draw_runs, public.draw_results, public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.draw_runs WHERE draw_key = 'week3')
     OR EXISTS (SELECT 1 FROM public.draw_results WHERE draw_key = 'week3') THEN
    RAISE EXCEPTION 'STOP: Week 3 already recorded; no draw may be rerun, even in this verification.';
  END IF;
  SELECT p.id INTO v_admin FROM public.profiles p WHERE p.is_admin ORDER BY p.id LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'STOP: no administrator available'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key, d.user_id), '[]'::jsonb)
    INTO v_before_results FROM public.draw_results d;
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key), '[]'::jsonb)
    INTO v_before_runs FROM public.draw_runs d;

  WITH active_units AS (
    SELECT private.normalize_department(p.business_unit) AS unit, count(DISTINCT p.id) AS active_count
    FROM public.profiles p
    WHERE p.located_at_crc AND NOT p.exclude_from_standings AND NOT p.exclude_from_prizes
      AND private.normalize_department(p.business_unit) <> ''
      AND (EXISTS (SELECT 1 FROM public.activity_entries a WHERE a.user_id=p.id AND a.week=3)
        OR EXISTS (SELECT 1 FROM public.wellness_checkins c WHERE c.user_id=p.id AND c.week=3))
    GROUP BY private.normalize_department(p.business_unit)
  ), ranked AS (
    SELECT unit, rank() OVER (ORDER BY active_count DESC) AS participant_rank FROM active_units
  ) SELECT array_agg(unit) INTO v_top_units FROM ranked WHERE participant_rank <= 3;

  -- Nested sentinel exception discards the one simulated successful draw.
  BEGIN
    FOR v_row IN SELECT * FROM public.run_weekly_draw(3) LOOP
      v_count := v_count + 1;
      IF v_count = 1 THEN
        v_first_name := v_row.winner_name;
        v_first_unit := v_row.winner_business_unit;
      END IF;
    END LOOP;
    IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: expected two winners'; END IF;
    -- Returned identity is intentionally not printed. Draw-result UUIDs are authoritative.
    IF NOT EXISTS (
      SELECT 1 FROM public.draw_results d JOIN public.profiles p ON p.id=d.user_id
      WHERE d.draw_key='week3' AND p.located_at_crc AND NOT p.exclude_from_standings
        AND private.normalize_department(p.business_unit) = ANY(v_top_units)
        AND p.full_name=v_first_name AND p.business_unit=v_first_unit
    ) THEN RAISE EXCEPTION 'FAIL: first winner is not CRC'; END IF;
    SELECT count(DISTINCT private.normalize_department(p.business_unit)) INTO v_departments
    FROM public.draw_results d JOIN public.profiles p ON p.id=d.user_id WHERE d.draw_key='week3';
    IF v_departments <> 2 THEN RAISE EXCEPTION 'FAIL: normalized departments overlap'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.draw_results d JOIN public.profiles p ON p.id=d.user_id
      WHERE d.draw_key='week3' AND (
        public.user_week_points(p.id,3) < 140 OR NOT public.user_has_activity_in_week(p.id,3)
        OR p.exclude_from_prizes OR private.normalize_department(p.business_unit)=''
        OR EXISTS (SELECT 1 FROM public.draw_results x WHERE x.user_id=p.id AND x.draw_key<>'week3')
      )
    ) THEN RAISE EXCEPTION 'FAIL: ineligible winner'; END IF;
    v_denied := false;
    BEGIN
      PERFORM public.run_weekly_draw(3);
    EXCEPTION WHEN OTHERS THEN v_denied := true;
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: repeat not refused'; END IF;
    RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='rollback simulated successful draw';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET located_at_crc=false WHERE located_at_crc;
    v_denied := false;
    BEGIN
      PERFORM public.run_weekly_draw(3);
    EXCEPTION WHEN OTHERS THEN v_denied := sqlerrm LIKE '%eligible CRC%';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: no CRC pool did not fail closed'; END IF;
    IF EXISTS (SELECT 1 FROM public.draw_runs WHERE draw_key='week3')
       OR EXISTS (SELECT 1 FROM public.draw_results WHERE draw_key='week3') THEN
      RAISE EXCEPTION 'FAIL: no CRC failure left a run or result';
    END IF;
    RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='rollback temporary CRC flags';
  EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET business_unit='CRC TEST & DEPARTMENT'
    WHERE public.user_week_points(id,3)>=140 AND public.user_has_activity_in_week(id,3)
      AND NOT exclude_from_prizes
      AND NOT EXISTS (SELECT 1 FROM public.draw_results d WHERE d.user_id=profiles.id);
    v_denied := false;
    BEGIN
      PERFORM public.run_weekly_draw(3);
    EXCEPTION WHEN OTHERS THEN v_denied := sqlerrm LIKE '%at least 2 departments%';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: no compatible department did not fail closed'; END IF;
    IF EXISTS (SELECT 1 FROM public.draw_runs WHERE draw_key='week3')
       OR EXISTS (SELECT 1 FROM public.draw_results WHERE draw_key='week3') THEN
      RAISE EXCEPTION 'FAIL: department failure left a run or result';
    END IF;
    RAISE EXCEPTION USING ERRCODE='ZX003', MESSAGE='rollback temporary departments';
  EXCEPTION WHEN SQLSTATE 'ZX003' THEN NULL;
  END;

  IF v_before_results IS DISTINCT FROM (
    SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key,d.user_id),'[]'::jsonb) FROM public.draw_results d
  ) OR v_before_runs IS DISTINCT FROM (
    SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key),'[]'::jsonb) FROM public.draw_runs d
  ) THEN RAISE EXCEPTION 'FAIL: draw history changed'; END IF;
  RAISE EXCEPTION 'TESTRESULT PASS: Week3 top-three active CRC first (competition rank with ties), eligible distinct departments, one-shot, both fail-closed cases; ALL writes rolled back. Week4 verified locally only.';
END $test$;
