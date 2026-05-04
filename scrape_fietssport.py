#!/usr/bin/env python3
"""
Scraper for fietssport.nl club names and email addresses by province.
URL: https://www.fietssport.nl/clubs/provincie

Usage:
    pip install requests beautifulsoup4
    python3 scrape_fietssport.py
"""

import re
import csv
import time
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.fietssport.nl"
START_URL = "https://www.fietssport.nl/clubs/provincie"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def fetch(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def extract_clubs_from_page(soup: BeautifulSoup, source_url: str = "") -> list[dict]:
    clubs: list[dict] = []

    # Pattern 1: table rows (common for club listings)
    tables = soup.find_all("table")
    for table in tables:
        headers_row = table.find("tr")
        col_names = [th.get_text(strip=True).lower() for th in headers_row.find_all(["th", "td"])] if headers_row else []
        for row in table.find_all("tr")[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            name = cells[0].get_text(strip=True)
            emails = EMAIL_RE.findall(row.get_text())
            # also check mailto hrefs
            for a in row.find_all("a", href=True):
                if a["href"].startswith("mailto:"):
                    emails.append(a["href"][7:].split("?")[0])
            if name:
                clubs.append({
                    "name": name,
                    "email": ", ".join(dict.fromkeys(emails)),
                    "source": source_url,
                })
        if clubs:
            return clubs

    # Pattern 2: list items or divs with club info
    for item in soup.select(".club, .club-item, .vereniging, li.club, .views-row"):
        name = _text(item.select_one("h2, h3, h4, .club-name, .field-title, strong"))
        emails = EMAIL_RE.findall(item.get_text())
        for a in item.find_all("a", href=True):
            if a["href"].startswith("mailto:"):
                emails.append(a["href"][7:].split("?")[0])
        if name:
            clubs.append({
                "name": name,
                "email": ", ".join(dict.fromkeys(emails)),
                "source": source_url,
            })
    if clubs:
        return clubs

    # Pattern 3: headings followed by content blocks
    for heading in soup.select("h2, h3"):
        name = heading.get_text(strip=True)
        if not name or len(name) > 100:
            continue
        emails: list[str] = []
        node = heading.find_next_sibling()
        while node and node.name not in ("h2", "h3"):
            emails += EMAIL_RE.findall(node.get_text() if hasattr(node, "get_text") else str(node))
            for a in (node.find_all("a", href=True) if hasattr(node, "find_all") else []):
                if a["href"].startswith("mailto:"):
                    emails.append(a["href"][7:].split("?")[0])
            node = node.find_next_sibling()
        clubs.append({
            "name": name,
            "email": ", ".join(dict.fromkeys(emails)),
            "source": source_url,
        })
    if clubs:
        return clubs

    # Fallback: all mailto links
    for a in soup.find_all("a", href=re.compile(r"^mailto:")):
        email = a["href"][7:].split("?")[0]
        label = ""
        for ancestor in a.parents:
            candidate = ancestor.find(["h2", "h3", "h4", "strong", "b"])
            if candidate:
                label = candidate.get_text(strip=True)
                break
        clubs.append({
            "name": label or a.get_text(strip=True) or email,
            "email": email,
            "source": source_url,
        })

    return clubs


def find_province_links(soup: BeautifulSoup) -> list[str]:
    """Return absolute URLs for per-province sub-pages if the main page links to them."""
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        # heuristic: links that look like province sub-pages
        if re.search(r"/clubs?/|/provincie|/region|/afdeling", href, re.I):
            full = href if href.startswith("http") else BASE_URL + href
            if full not in links and full != START_URL:
                links.append(full)
    return links


def find_club_detail_links(soup: BeautifulSoup) -> list[str]:
    """Return absolute URLs for individual club detail pages."""
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r"/club/|/vereniging/|/clubs/\d+", href, re.I):
            full = href if href.startswith("http") else BASE_URL + href
            if full not in links:
                links.append(full)
    return links


def _text(el) -> str:
    return el.get_text(strip=True) if el else ""


def save_csv(clubs: list[dict], path: str = "fietssport_clubs.csv") -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "source"])
        writer.writeheader()
        writer.writerows(clubs)
    print(f"\nSaved {len(clubs)} entries to {path}")


def main() -> None:
    print(f"Fetching {START_URL} ...")
    soup = fetch(START_URL)

    all_clubs: list[dict] = []

    # Try province sub-pages first
    province_links = find_province_links(soup)
    if province_links:
        print(f"Found {len(province_links)} province sub-page(s), scraping each...")
        for url in province_links:
            print(f"  -> {url}")
            time.sleep(0.8)
            try:
                sub_soup = fetch(url)
                clubs = extract_clubs_from_page(sub_soup, url)
                # If still no emails, follow club detail links
                if not any(c["email"] for c in clubs):
                    detail_links = find_club_detail_links(sub_soup)
                    for detail_url in detail_links[:50]:  # cap at 50 per province
                        time.sleep(0.5)
                        try:
                            d_soup = fetch(detail_url)
                            emails = EMAIL_RE.findall(d_soup.get_text())
                            name_el = d_soup.select_one("h1, h2, .club-name, title")
                            name = _text(name_el)
                            if emails:
                                clubs.append({"name": name, "email": ", ".join(dict.fromkeys(emails)), "source": detail_url})
                        except Exception as e:
                            print(f"    ! {detail_url}: {e}")
                all_clubs.extend(clubs)
            except Exception as e:
                print(f"    ! Error: {e}")
    else:
        # No sub-pages, extract directly from main page
        all_clubs = extract_clubs_from_page(soup, START_URL)

        # Try club detail links if emails are sparse
        if not any(c["email"] for c in all_clubs):
            detail_links = find_club_detail_links(soup)
            print(f"Following {len(detail_links)} club detail page(s)...")
            for url in detail_links[:100]:
                time.sleep(0.5)
                try:
                    d_soup = fetch(url)
                    emails = EMAIL_RE.findall(d_soup.get_text())
                    name_el = d_soup.select_one("h1, h2, .club-name, title")
                    name = _text(name_el)
                    if emails:
                        all_clubs.append({"name": name, "email": ", ".join(dict.fromkeys(emails)), "source": url})
                except Exception as e:
                    print(f"  ! {url}: {e}")

    # Deduplicate by (name, email)
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in all_clubs:
        key = (c["name"], c["email"])
        if key not in seen:
            seen.add(key)
            unique.append(c)

    if not unique:
        print("No clubs found — saving raw HTML for inspection.")
        with open("fietssport_raw.html", "w", encoding="utf-8") as f:
            f.write(soup.prettify())
        print("Inspect fietssport_raw.html and report the structure so the parser can be adjusted.")
        return

    for c in unique:
        print(f"  {c['name']:<50} {c['email']}")

    save_csv(unique)


if __name__ == "__main__":
    main()
