#!/usr/bin/env python3
"""
Scraper for LRV Tirol club names and email addresses.
URL: https://www.lrv-tirol.at/die-vereine/

Usage:
    pip install requests beautifulsoup4
    python3 scrape_lrv_tirol.py
"""

import re
import csv
import time
import requests
from bs4 import BeautifulSoup

URL = "https://www.lrv-tirol.at/die-vereine/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def fetch_page(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def extract_clubs(soup: BeautifulSoup) -> list[dict]:
    clubs = []

    # Try common WordPress/theme patterns for club listings
    # Pattern 1: accordion / toggle items with title + content
    for item in soup.select(".accordion-item, .wp-block-group, .verein-item, .club-item"):
        name = _text(item.select_one("h2, h3, h4, .accordion-title, .entry-title"))
        emails = EMAIL_RE.findall(item.get_text())
        if name:
            clubs.append({"name": name, "email": ", ".join(set(emails))})

    if clubs:
        return clubs

    # Pattern 2: headings followed by paragraphs containing mailto links
    for heading in soup.select("h2, h3, h4"):
        name = heading.get_text(strip=True)
        if not name:
            continue
        # Collect text from siblings until the next heading
        emails: list[str] = []
        node = heading.find_next_sibling()
        while node and node.name not in ("h2", "h3", "h4"):
            emails += EMAIL_RE.findall(node.get_text())
            # also check mailto hrefs
            for a in node.find_all("a", href=True):
                href = a["href"]
                if href.startswith("mailto:"):
                    emails.append(href[7:].split("?")[0])
            node = node.find_next_sibling()
        clubs.append({"name": name, "email": ", ".join(dict.fromkeys(emails))})

    if clubs:
        return clubs

    # Pattern 3: table rows
    for row in soup.select("table tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) >= 2:
            name = cells[0].get_text(strip=True)
            emails = EMAIL_RE.findall(row.get_text())
            if name and emails:
                clubs.append({"name": name, "email": ", ".join(set(emails))})

    if clubs:
        return clubs

    # Fallback: grab every mailto link and the nearest heading/strong as name
    for a in soup.find_all("a", href=re.compile(r"^mailto:")):
        email = a["href"][7:].split("?")[0]
        # walk up the DOM to find a label
        label = ""
        for ancestor in a.parents:
            candidate = ancestor.find(["h2", "h3", "h4", "strong", "b"])
            if candidate:
                label = candidate.get_text(strip=True)
                break
        if not label:
            label = a.get_text(strip=True) or email
        clubs.append({"name": label, "email": email})

    return clubs


def _text(el) -> str:
    return el.get_text(strip=True) if el else ""


def save_csv(clubs: list[dict], path: str = "lrv_tirol_clubs.csv") -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email"])
        writer.writeheader()
        writer.writerows(clubs)
    print(f"Saved {len(clubs)} entries to {path}")


def main() -> None:
    print(f"Fetching {URL} ...")
    soup = fetch_page(URL)

    # Check for sub-pages / pagination
    all_clubs: list[dict] = extract_clubs(soup)

    # Follow any "next page" links
    for a in soup.select("a.next, a[rel='next'], .pagination a"):
        href = a.get("href", "")
        if href and href != URL:
            time.sleep(1)
            print(f"  -> following pagination: {href}")
            sub_soup = fetch_page(href)
            all_clubs.extend(extract_clubs(sub_soup))

    # Deduplicate by email
    seen: set[str] = set()
    unique: list[dict] = []
    for club in all_clubs:
        key = club["email"] or club["name"]
        if key not in seen:
            seen.add(key)
            unique.append(club)

    if not unique:
        print("No clubs found — the page structure may differ from expected patterns.")
        print("Raw page text saved to lrv_tirol_raw.html for inspection.")
        with open("lrv_tirol_raw.html", "w", encoding="utf-8") as f:
            f.write(soup.prettify())
        return

    for club in unique:
        print(f"  {club['name']:<50} {club['email']}")

    save_csv(unique)


if __name__ == "__main__":
    main()
