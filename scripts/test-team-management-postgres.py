#!/usr/bin/env python3
"""Run team-management migration and concurrency checks on real PostgreSQL."""

from __future__ import annotations

import hashlib
import os
import sys
import threading
import time
from pathlib import Path
from typing import Callable

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]
BASE_SCHEMA_ENV = "TEAM_TEST_BASE_SCHEMA"
BASE_SCHEMA_HASH_ENV = "TEAM_TEST_BASE_SCHEMA_SHA256"
MIGRATION = ROOT / "supabase/migration-team-management.sql"
FRESH_SCHEMA = ROOT / "supabase/schema.sql"
SOCKET = os.environ.get(
    "TEAM_TEST_PG_SOCKET",
    "/Users/pash/.hermes/profiles/coding/cache/scratch/pg-team-socket",
)
PORT = int(os.environ.get("TEAM_TEST_PG_PORT", "55432"))
ADMIN_DSN = f"host={SOCKET} port={PORT} dbname=postgres"

OWNER = "10000000-0000-0000-0000-000000000001"
MEMBER = "10000000-0000-0000-0000-000000000002"
JOINER = "10000000-0000-0000-0000-000000000003"
FORGED_ADMIN = "10000000-0000-0000-0000-000000000004"
TEAM = "20000000-0000-0000-0000-000000000001"


def connect(dbname: str, *, autocommit: bool = False) -> psycopg.Connection:
    return psycopg.connect(
        f"host={SOCKET} port={PORT} dbname={dbname}", autocommit=autocommit
    )


def execute_script(conn: psycopg.Connection, path: Path) -> None:
    conn.execute(path.read_text())


def verified_baseline_path() -> Path:
    raw_path = os.environ.get(BASE_SCHEMA_ENV)
    expected_hash = os.environ.get(BASE_SCHEMA_HASH_ENV)
    if not raw_path or not expected_hash:
        raise RuntimeError(
            f"Set {BASE_SCHEMA_ENV} and {BASE_SCHEMA_HASH_ENV} to the reviewed production baseline."
        )
    path = Path(raw_path).resolve()
    actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise RuntimeError(
            f"Baseline hash mismatch: expected {expected_hash}, got {actual_hash}."
        )
    return path


def recreate_database(name: str) -> None:
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        conn.execute(sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(name)))
        conn.execute(sql.SQL("create database {}").format(sql.Identifier(name)))


def bootstrap_cluster_roles() -> None:
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        for role in ("anon", "authenticated"):
            if not conn.execute("select 1 from pg_roles where rolname = %s", (role,)).fetchone():
                conn.execute(sql.SQL("create role {} nologin").format(sql.Identifier(role)))


def bootstrap_database(name: str) -> None:
    with connect(name) as conn:
        conn.execute("create schema auth")
        conn.execute(
            "create table auth.users (id uuid primary key, raw_app_meta_data jsonb not null default '{}'::jsonb)"
        )
        conn.execute(
            """
            create function auth.uid() returns uuid
            language sql stable
            as $$
              select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
            $$
            """
        )
        conn.execute("grant usage on schema public, auth to anon, authenticated")
        conn.execute("grant execute on function auth.uid() to public")
        conn.execute(
            "alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated"
        )
        conn.execute(
            "alter default privileges in schema public grant usage, select on sequences to anon, authenticated"
        )
        conn.execute(
            "alter default privileges in schema public grant execute on functions to anon, authenticated"
        )


def prepare_migration_database(name: str) -> None:
    baseline = verified_baseline_path()
    recreate_database(name)
    bootstrap_database(name)
    with connect(name) as conn:
        conn.execute(
            "create function public.gen_join_code() returns text language sql as $$ select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) $$"
        )
        execute_script(conn, baseline)
        conn.execute("insert into auth.users(id) values (%s)", (FORGED_ADMIN,))
        conn.execute(
            """
            insert into public.profiles
              (id, full_name, business_unit, located_at_crc, age_range, team_id, is_admin)
            values (%s, 'Forged Admin', 'A', false, '30-39', null, true)
            """,
            (FORGED_ADMIN,),
        )
        execute_script(conn, MIGRATION)
        forged_flag = conn.execute(
            "select is_admin from public.profiles where id = %s", (FORGED_ADMIN,)
        ).fetchone()
        if forged_flag != (False,):
            raise AssertionError(f"migration retained an untrusted legacy admin flag: {forged_flag}")
        set_user(conn, FORGED_ADMIN)
        if conn.execute("select public.is_current_user_admin()").fetchone() != (False,):
            raise AssertionError("auth metadata did not reject the forged administrator")
        conn.execute("delete from public.profiles where id = %s", (FORGED_ADMIN,))
        conn.execute("delete from auth.users where id = %s", (FORGED_ADMIN,))


def prepare_fresh_database(name: str) -> None:
    recreate_database(name)
    bootstrap_database(name)
    with connect(name) as conn:
        execute_script(conn, FRESH_SCHEMA)


def set_user(conn: psycopg.Connection, user_id: str) -> None:
    conn.execute("select set_config('request.jwt.claim.sub', %s, true)", (user_id,))


def seed_team(conn: psycopg.Connection) -> None:
    conn.execute(
        "insert into auth.users(id, raw_app_meta_data) values (%s, '{\"is_admin\": true}'::jsonb), (%s, '{}'::jsonb), (%s, '{}'::jsonb)",
        (OWNER, MEMBER, JOINER),
    )
    conn.execute(
        """
        insert into public.profiles
          (id, full_name, business_unit, located_at_crc, age_range, team_id, is_admin)
        values
          (%s, 'Owner One', 'A', false, '30-39', null, false),
          (%s, 'Member Two', 'A', false, '30-39', null, false),
          (%s, 'Joiner Three', 'A', false, '30-39', null, false)
        """,
        (OWNER, MEMBER, JOINER),
    )
    conn.execute(
        "insert into public.teams(id, name, join_code, created_by) values (%s, 'Runtime Team', 'RUNTIME', %s)",
        (TEAM, OWNER),
    )
    conn.execute("update public.profiles set team_id = %s where id in (%s, %s)", (TEAM, OWNER, MEMBER))


def reset_seed(dbname: str) -> None:
    with connect(dbname) as conn:
        conn.execute("truncate public.participant_team_locks, public.activity_entries, public.wellness_checkins, public.participant_acknowledgements, public.profiles, public.teams, auth.users cascade")
        seed_team(conn)


def run_operation(
    dbname: str,
    operation: Callable[[psycopg.Connection], None],
    result: dict[str, str],
    key: str,
) -> None:
    try:
        with connect(dbname) as conn:
            conn.execute("set statement_timeout = '4s'")
            operation(conn)
        result[key] = "ok"
    except psycopg.Error as exc:
        result[key] = exc.sqlstate or type(exc).__name__


def phantom_join_race(dbname: str, *, delete_owner: bool) -> dict[str, str]:
    reset_seed(dbname)
    join_ready = threading.Event()
    release_join = threading.Event()
    result: dict[str, str] = {}

    def hold_join() -> None:
        try:
            with connect(dbname) as conn:
                conn.execute("set statement_timeout = '4s'")
                set_user(conn, JOINER)
                conn.execute("select public.join_team(%s)", (TEAM,))
                join_ready.set()
                if not release_join.wait(3):
                    raise RuntimeError("join release timed out")
            result["join"] = "ok"
        except psycopg.Error as exc:
            result["join"] = exc.sqlstate or type(exc).__name__
            join_ready.set()

    join_thread = threading.Thread(target=hold_join, daemon=True)
    join_thread.start()
    if not join_ready.wait(3):
        raise AssertionError("join did not acquire the team lock")

    if delete_owner:
        owner_operation = lambda conn: conn.execute(
            "delete from public.profiles where id = %s", (OWNER,)
        )
    else:
        def owner_operation(conn: psycopg.Connection) -> None:
            set_user(conn, OWNER)
            conn.execute("select * from public.leave_current_team()")

    owner_thread = threading.Thread(
        target=run_operation,
        args=(dbname, owner_operation, result, "owner"),
        daemon=True,
    )
    owner_thread.start()
    time.sleep(0.15)
    release_join.set()
    join_thread.join(3)

    def joiner_leave(conn: psycopg.Connection) -> None:
        set_user(conn, JOINER)
        conn.execute("select * from public.leave_current_team()")

    joiner_thread = threading.Thread(
        target=run_operation,
        args=(dbname, joiner_leave, result, "joiner_leave"),
        daemon=True,
    )
    joiner_thread.start()
    owner_thread.join(5)
    joiner_thread.join(5)

    if owner_thread.is_alive() or joiner_thread.is_alive() or join_thread.is_alive():
        raise AssertionError("concurrency test did not finish within its bound")
    if "40P01" in result.values():
        raise AssertionError(f"deadlock detected: {result}")
    if result.get("join") != "ok" or result.get("joiner_leave") != "ok":
        raise AssertionError(f"join path did not complete: {result}")
    if result.get("owner") != "40001":
        raise AssertionError(f"owner path should request a safe retry: {result}")
    return result


def assert_privileges(dbname: str) -> None:
    with connect(dbname) as conn:
        seed_team(conn)

    with connect(dbname) as conn:
        conn.execute("set role anon")
        try:
            conn.execute("select name, join_code, created_by from public.teams").fetchall()
        except psycopg.errors.InsufficientPrivilege:
            conn.rollback()
        else:
            raise AssertionError("anonymous role could read private team rows")

    anonymous_rpc_calls = (
        "select public.can_current_user_change_teams()",
        "select * from public.get_team_member_counts()",
        "select public.get_my_team_member_count()",
        "select * from public.get_my_team_roster()",
        "select * from public.get_my_team_activity()",
        "select public.create_team_and_join('Anonymous')",
        f"select public.join_team('{TEAM}'::uuid)",
        "select * from public.leave_current_team()",
        "select public.delete_my_team()",
    )
    for statement in anonymous_rpc_calls:
        with connect(dbname) as conn:
            conn.execute("set role anon")
            try:
                conn.execute(statement)
            except psycopg.errors.InsufficientPrivilege:
                conn.rollback()
            else:
                raise AssertionError(f"anonymous role could execute RPC: {statement}")

    with connect(dbname) as conn:
        conn.execute("set role authenticated")
        set_user(conn, OWNER)
        rows = conn.execute("select id from public.teams").fetchall()
        if [str(row[0]) for row in rows] != [TEAM]:
            raise AssertionError(f"authenticated team read failed: {rows}")

        try:
            conn.execute(
                "insert into public.teams(id, name, join_code, created_by) values (gen_random_uuid(), 'Bypass', 'BYPASS', %s)",
                (OWNER,),
            )
        except psycopg.errors.InsufficientPrivilege:
            conn.rollback()
        else:
            raise AssertionError("authenticated role could insert a team directly")

    for statement in (
        f"update public.teams set name = 'Bypass' where id = '{TEAM}'::uuid",
        f"delete from public.teams where id = '{TEAM}'::uuid",
    ):
        with connect(dbname) as conn:
            conn.execute("set role authenticated")
            set_user(conn, OWNER)
            try:
                conn.execute(statement)
            except psycopg.errors.InsufficientPrivilege:
                conn.rollback()
            else:
                raise AssertionError(f"authenticated role could mutate teams directly: {statement}")

    with connect(dbname) as conn:
        conn.execute("set role authenticated")
        set_user(conn, OWNER)
        try:
            conn.execute("update public.profiles set team_id = null where id = %s", (OWNER,))
        except psycopg.errors.InsufficientPrivilege:
            conn.rollback()
        else:
            raise AssertionError("authenticated role could update team_id directly")


def main() -> int:
    bootstrap_cluster_roles()
    prepare_migration_database("team_migration_test")
    prepare_fresh_database("team_fresh_test")

    for dbname in ("team_migration_test", "team_fresh_test"):
        assert_privileges(dbname)
        for attempt in range(1, 11):
            leave = phantom_join_race(dbname, delete_owner=False)
            delete = phantom_join_race(dbname, delete_owner=True)
            if attempt == 10:
                print(f"{dbname}: 10/10 creator-leave races passed; last={leave}")
                print(f"{dbname}: 10/10 profile-delete races passed; last={delete}")

    print("Runtime PostgreSQL migration, privilege, and concurrency checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
