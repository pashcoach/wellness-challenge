-- READ ONLY. Run entire file before and after apply; never invokes a draw.
SELECT p.prosecdef AS security_definer, p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
 position('perform public.require_current_user_admin()' in pg_get_functiondef(p.oid))>0 AS rule_admin,
 position('in (''energy and ag'', ''consumer products'')' in pg_get_functiondef(p.oid))>0 AS rule_named_units,
 (length(pg_get_functiondef(p.oid))-length(replace(pg_get_functiondef(p.oid),'p.located_at_crc is true','')))/length('p.located_at_crc is true')=3 AS rule_crc_all_pools,
 (length(pg_get_functiondef(p.oid))-length(replace(pg_get_functiondef(p.oid),'and not p.exclude_from_standings','')))/length('and not p.exclude_from_standings')=3 AS rule_hidden_all_pools,
 position('v_top_crc_units' in pg_get_functiondef(p.oid))=0 AND position('rank()' in pg_get_functiondef(p.oid))=0 AS rule_no_ranking,
 pg_get_functiondef(p.oid) AS installed_definition
FROM pg_proc p WHERE p.oid='public.run_weekly_draw(integer)'::regprocedure;

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

-- Both rows must have eligible_candidates > 0. No participant identities.
WITH required(unit) AS (VALUES ('energy and ag'),('consumer products'))
SELECT r.unit, count(p.id) AS eligible_candidates
FROM required r LEFT JOIN public.profiles p
 ON private.normalize_department(p.business_unit)=r.unit
 AND p.located_at_crc IS TRUE AND NOT p.exclude_from_prizes AND NOT p.exclude_from_standings
 AND public.user_week_points(p.id,3)>=140 AND public.user_has_activity_in_week(p.id,3)
 AND NOT EXISTS(SELECT 1 FROM public.draw_results d WHERE d.user_id=p.id)
GROUP BY r.unit ORDER BY r.unit;
