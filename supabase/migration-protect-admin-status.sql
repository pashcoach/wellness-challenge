-- Production security hardening — step 2: protect administrator status
--
-- Row policies control which profile row a participant may modify. Column
-- privileges below independently control which fields the authenticated role
-- may insert or update, so a participant cannot set or change is_admin.

begin;

-- Replace broad table-level write grants with explicit safe columns.
revoke insert, update on table public.profiles from authenticated;

grant insert (
  id,
  full_name,
  username,
  business_unit,
  located_at_crc,
  age_range,
  team_id
) on table public.profiles to authenticated;

grant update (
  full_name,
  username,
  business_unit,
  located_at_crc,
  age_range,
  team_id
) on table public.profiles to authenticated;

-- Keep the existing own-row policies, but make the row checks explicit.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and is_admin = false);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Fail and roll back this migration if the protected column remains writable.
do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT') then
    raise exception 'Security check failed: authenticated can insert profiles.is_admin';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE') then
    raise exception 'Security check failed: authenticated can update profiles.is_admin';
  end if;
end;
$$;

commit;
