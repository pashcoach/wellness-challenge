-- Read-only BEFORE apply and AFTER apply / rollback verification. Never executes a draw.
-- Expected post-apply: all rule_* true; security_definer true; search_path empty;
-- anon_can_execute false, authenticated_can_execute true. Inspect full definition too.
SELECT p.prosecdef AS security_definer, p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
  position('rank() over (order by active_participants desc)' in pg_get_functiondef(p.oid)) > 0 AS rule_competition_rank,
  position('participant_rank <= 3' in pg_get_functiondef(p.oid)) > 0 AS rule_top_three,
  position('count(distinct p.id)' in pg_get_functiondef(p.oid)) > 0 AS rule_distinct_people,
  position('public.wellness_checkins' in pg_get_functiondef(p.oid)) > 0 AS rule_checkin_activity_union,
  position('any(v_top_crc_units)' in pg_get_functiondef(p.oid)) > 0 AS rule_restricted_first_pool,
  pg_get_functiondef(p.oid) AS installed_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='run_weekly_draw'
  AND pg_get_function_identity_arguments(p.oid)='p_week integer';

-- Record BOTH fingerprints before applying; require exact equality afterward.
-- No names or UUIDs printed. Counts alone cannot prove unchanged history.
SELECT 'results' AS ledger, count(*) AS row_count,
  md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key,d.user_id)::text,'[]')) AS history_fingerprint
FROM public.draw_results d
UNION ALL
SELECT 'runs', count(*), md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.draw_key)::text,'[]'))
FROM public.draw_runs d;

SELECT draw_key, count(*) AS winner_rows
FROM public.draw_results GROUP BY draw_key ORDER BY draw_key;
SELECT draw_key, count(*) AS run_rows
FROM public.draw_runs GROUP BY draw_key ORDER BY draw_key;
-- Expected Week1/Week2 winner_rows: 2 each; run_rows: 1 each.
-- Week3/Week4 absent until deliberately run later; do not run them here.

-- Read-only pool audit: ranking uses active people, NOT prize eligibility or wins.
WITH active_units AS (
  SELECT private.normalize_department(p.business_unit) AS unit, count(DISTINCT p.id) AS active_participants
  FROM public.profiles p
  WHERE p.located_at_crc AND NOT p.exclude_from_standings AND NOT p.exclude_from_prizes
    AND private.normalize_department(p.business_unit) <> ''
    AND (EXISTS (SELECT 1 FROM public.activity_entries a WHERE a.user_id=p.id AND a.week=3)
      OR EXISTS (SELECT 1 FROM public.wellness_checkins c WHERE c.user_id=p.id AND c.week=3))
  GROUP BY private.normalize_department(p.business_unit)
), ranked AS (
  SELECT *, rank() OVER (ORDER BY active_participants DESC) AS participant_rank FROM active_units
)
SELECT unit, active_participants, participant_rank, participant_rank <= 3 AS in_guaranteed_pool
FROM ranked ORDER BY participant_rank, unit;
