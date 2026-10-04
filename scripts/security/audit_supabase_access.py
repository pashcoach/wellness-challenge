"""Audit anonymous access to sensitive Supabase REST resources.

Loads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
.env.local without printing either value or any returned records.

Exit status is non-zero when the anonymous role can read at least one row from
a protected resource. Empty tables cannot prove a policy is safe, so this is a
production smoke test rather than a replacement for SQL policy review.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROTECTED_RESOURCES = {
    "profiles": "id",
    "activity_entries": "id",
    "wellness_checkins": "id",
    "survey_responses": "id",
    "draw_results": "id",
    "user_badges": "id",
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    env = load_env(Path(".env.local"))
    base_url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/"
    anon_key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    failures: list[str] = []

    for resource, column in PROTECTED_RESOURCES.items():
        query = urllib.parse.urlencode({"select": column, "limit": 1})
        request = urllib.request.Request(
            f"{base_url}{resource}?{query}",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Prefer": "count=exact",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                rows = json.load(response)
                exposed = len(rows) > 0
                print(f"{resource}: {'EXPOSED' if exposed else 'no rows visible'}")
                if exposed:
                    failures.append(resource)
        except urllib.error.HTTPError as error:
            # A permission error is also a secure result. Do not print provider
            # response bodies because they can include implementation details.
            if error.code in (401, 403):
                print(f"{resource}: blocked ({error.code})")
            else:
                print(f"{resource}: audit error ({error.code})")
                failures.append(resource)

    if failures:
        print("Anonymous access audit FAILED: " + ", ".join(failures))
        return 1

    print("Anonymous access audit passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
