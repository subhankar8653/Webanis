from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from bs4 import BeautifulSoup
import re
from typing import Optional

app = FastAPI(title="AnimeZone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://toono.app"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://toono.app/",
}


async def fetch_page(url: str) -> str:
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url, headers=HEADERS)
        resp.raise_for_status()
        return resp.text


def extract_image(tag) -> str:
    if not tag:
        return ""
    src = tag.get("src") or tag.get("data-src") or tag.get("data-lazy-src") or ""
    if src.startswith("//"):
        src = "https:" + src
    return src


# ─── HOME ────────────────────────────────────────────────────────────────────

@app.get("/api/home")
async def get_home():
    try:
        html = await fetch_page(f"{BASE_URL}/home/")
        soup = BeautifulSoup(html, "html.parser")
        anime_list = []

        # Try multiple common card selectors
        cards = (
            soup.select("div.film-list div.flw-item") or
            soup.select("div.anime-list div.item") or
            soup.select("article.post") or
            soup.select("div.item") or
            soup.select("div.card")
        )

        for card in cards[:30]:
            link_tag = card.find("a", href=True)
            if not link_tag:
                continue

            href = link_tag["href"]
            # Extract slug from /series/{slug}/
            slug_match = re.search(r"/series/([^/]+)", href)
            if not slug_match:
                continue
            slug = slug_match.group(1)

            title_tag = card.find(["h3", "h2", "h4", ".film-name", ".name", ".title"])
            title = title_tag.get_text(strip=True) if title_tag else slug.replace("-", " ").title()

            img_tag = card.find("img")
            poster = extract_image(img_tag)

            rating_tag = card.find(class_=re.compile(r"rating|score|imdb", re.I))
            rating = rating_tag.get_text(strip=True) if rating_tag else ""

            ep_tag = card.find(class_=re.compile(r"ep|episode|tick", re.I))
            episodes = ep_tag.get_text(strip=True) if ep_tag else ""

            anime_list.append({
                "slug": slug,
                "title": title,
                "poster": poster,
                "rating": rating,
                "episodes": episodes,
            })

        return {"status": "ok", "data": anime_list}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── SERIES ──────────────────────────────────────────────────────────────────

@app.get("/api/series/{slug}")
async def get_series(slug: str):
    try:
        html = await fetch_page(f"{BASE_URL}/series/{slug}/")
        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find(["h1", "h2"], class_=re.compile(r"title|name|film", re.I)) or soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else slug.replace("-", " ").title()

        # Poster
        img_tag = soup.find("img", class_=re.compile(r"poster|cover|film-poster", re.I)) or soup.find("img")
        poster = extract_image(img_tag)

        # Description
        desc_tag = soup.find(class_=re.compile(r"description|synopsis|overview|plot", re.I))
        description = desc_tag.get_text(strip=True) if desc_tag else ""

        # Genres
        genre_tags = soup.select("a[href*='genre']") or soup.select(".genre a") or soup.select(".genres a")
        genres = [g.get_text(strip=True) for g in genre_tags]

        # Episodes — find all episode links
        ep_links = soup.find_all("a", href=re.compile(r"/episode/"))
        episodes = []
        seen = set()
        for ep in ep_links:
            href = ep["href"]
            if href in seen:
                continue
            seen.add(href)
            ep_slug_match = re.search(r"/episode/([^/]+)", href)
            if not ep_slug_match:
                continue
            ep_slug = ep_slug_match.group(1)
            ep_title = ep.get_text(strip=True) or ep_slug
            episodes.append({"slug": ep_slug, "title": ep_title, "url": href})

        return {
            "status": "ok",
            "data": {
                "title": title,
                "poster": poster,
                "description": description,
                "genres": genres,
                "episodes": episodes,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── EPISODE / EMBED ─────────────────────────────────────────────────────────

@app.get("/api/episode/{slug}")
async def get_episode(slug: str):
    try:
        html = await fetch_page(f"{BASE_URL}/episode/{slug}/")
        soup = BeautifulSoup(html, "html.parser")

        # Method 1: Find iframe with trembed or trid
        iframe = soup.find("iframe", src=re.compile(r"trembed|trid"))
        if iframe:
            return {"status": "ok", "embed_url": iframe["src"]}

        # Method 2: Search all iframes
        for ifr in soup.find_all("iframe"):
            src = ifr.get("src", "")
            if src:
                return {"status": "ok", "embed_url": src}

        # Method 3: Regex search in raw HTML for trid
        trid_match = re.search(r"trid[=:\"'\s]+(\d+)", html)
        trtype_match = re.search(r"trtype[=:\"'\s]+(\d+)", html)
        if trid_match:
            trid = trid_match.group(1)
            trtype = trtype_match.group(1) if trtype_match else "2"
            embed_url = f"{BASE_URL}/?trembed=1&trid={trid}&trtype={trtype}"
            return {"status": "ok", "embed_url": embed_url}

        # Method 4: Look in script tags
        for script in soup.find_all("script"):
            text = script.string or ""
            m = re.search(r"trid[=:\"'\s]+(\d+)", text)
            if m:
                trid = m.group(1)
                trtype_m = re.search(r"trtype[=:\"'\s]+(\d+)", text)
                trtype = trtype_m.group(1) if trtype_m else "2"
                embed_url = f"{BASE_URL}/?trembed=1&trid={trid}&trtype={trtype}"
                return {"status": "ok", "embed_url": embed_url}

        raise HTTPException(status_code=404, detail="Embed URL not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── SEARCH ──────────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search(q: str):
    try:
        html = await fetch_page(f"{BASE_URL}/?s={q}")
        soup = BeautifulSoup(html, "html.parser")
        results = []

        cards = (
            soup.select("div.film-list div.flw-item") or
            soup.select("div.search-results div.item") or
            soup.select("article.post") or
            soup.select("div.item")
        )

        for card in cards[:20]:
            link_tag = card.find("a", href=re.compile(r"/series/"))
            if not link_tag:
                continue
            slug_match = re.search(r"/series/([^/]+)", link_tag["href"])
            if not slug_match:
                continue
            slug = slug_match.group(1)
            title_tag = card.find(["h3", "h2", "h4"])
            title = title_tag.get_text(strip=True) if title_tag else slug.replace("-", " ").title()
            img_tag = card.find("img")
            poster = extract_image(img_tag)
            results.append({"slug": slug, "title": title, "poster": poster})

        return {"status": "ok", "data": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "AnimeZone API running"}
