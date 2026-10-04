"""Collect public GoJoe product pages for competitive feature research.

Run from the repository root:
  uv run --python 3.13 --with 'scrapling[fetchers]' \
    python scripts/research/scrape_gojoe.py

The crawler follows only a small, curated set of public pages, checks robots.txt,
and pauses between requests. It does not access accounts, forms, or personal data.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from scrapling.fetchers import Fetcher

BASE_URL = "https://www.gojoe.com"
USER_AGENT = "WellnessChallengeResearch/1.0"
OUTPUT = Path("docs/research/gojoe-public-pages.json")
PATHS = [
    "/us",
    "/us/one-off-corporate-challenges",
    "/us/our-solutions/data-reporting",
    "/us/our-solutions/employee-rewards-platform",
    "/us/our-solutions/interactive-maps",
    "/us/our-solutions/clubs",
    "/us/our-solutions/journeys",
    "/us/our-solutions/integrations",
    "/us/case-studies/natwest",
    "/us/case-studies/pwc",
]


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def main() -> None:
    robots_url = f"{BASE_URL}/robots.txt"
    robots_response = Fetcher.get(robots_url, headers={"User-Agent": USER_AGENT})
    robots_text = str(robots_response.body, "utf-8", errors="replace")
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(robots_text.splitlines())

    records: list[dict[str, object]] = []
    for index, path in enumerate(PATHS):
        url = urljoin(BASE_URL, path)
        if not parser.can_fetch(USER_AGENT, url):
            records.append({"url": url, "status": "blocked_by_robots"})
            continue

        page = Fetcher.get(url, headers={"User-Agent": USER_AGENT})
        headings = unique([clean(item.text) for item in page.css("h1,h2,h3")])
        paragraphs = unique([clean(item.text) for item in page.css("main p, section p")])
        links: list[dict[str, str]] = []
        seen_links: set[tuple[str, str]] = set()
        for anchor in page.css("main a, section a"):
            label = clean(anchor.text)
            href = clean(anchor.attrib.get("href"))
            absolute = urljoin(url, href)
            key = (label, absolute)
            if label and href and urlparse(absolute).netloc == "www.gojoe.com" and key not in seen_links:
                seen_links.add(key)
                links.append({"text": label, "url": absolute})

        records.append(
            {
                "url": url,
                "status": int(page.status),
                "title": clean(page.css("title::text").get()),
                "description": clean(page.css('meta[name="description"]::attr(content)').get()),
                "headings": headings,
                "paragraphs": paragraphs,
                "internal_links": links,
            }
        )
        if index < len(PATHS) - 1:
            time.sleep(0.75)

    output = {
        "source": BASE_URL,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "robots_url": robots_url,
        "robots_allowed": all(record.get("status") != "blocked_by_robots" for record in records),
        "scope": "Public marketing pages only; no accounts, forms, or personal data.",
        "pages": records,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(records)} pages to {OUTPUT}")


if __name__ == "__main__":
    main()
