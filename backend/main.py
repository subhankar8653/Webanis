from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from bs4 import BeautifulSoup
import re

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

EMBED_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://toono.app/",
    "Origin": "https://toono.app",
}


async def fetch_page(url: str, headers: dict = None) -> str:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers or HEADERS)
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
            slug_match = re.search(r"/series/([^/]+)", href)
            if not slug_match:
                continue
            slug = slug_match.group(1)

            title_tag = card.find(["h3", "h2", "h4"])
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

        title_tag = soup.find(["h1", "h2"], class_=re.compile(r"title|name|film", re.I)) or soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else slug.replace("-", " ").title()

        img_tag = soup.find("img", class_=re.compile(r"poster|cover|film-poster", re.I)) or soup.find("img")
        poster = extract_image(img_tag)

        desc_tag = soup.find(class_=re.compile(r"description|synopsis|overview|plot", re.I))
        description = desc_tag.get_text(strip=True) if desc_tag else ""

        genre_tags = soup.select("a[href*='genre']") or soup.select(".genre a") or soup.select(".genres a")
        genres = [g.get_text(strip=True) for g in genre_tags]

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
            episodes.append({"slug": ep_slug, "title": ep_title})

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


# ─── EPISODE — trid extract karo ─────────────────────────────────────────────

async def extract_trid(slug: str):
    """Episode page se trid + trtype nikalo"""
    html = await fetch_page(f"{BASE_URL}/episode/{slug}/")
    soup = BeautifulSoup(html, "html.parser")

    # Method 1: iframe src mein directly
    iframe = soup.find("iframe", src=re.compile(r"trembed|trid"))
    if iframe:
        src = iframe.get("src", "")
        trid_m = re.search(r"trid=(\d+)", src)
        trtype_m = re.search(r"trtype=(\d+)", src)
        if trid_m:
            return trid_m.group(1), (trtype_m.group(1) if trtype_m else "2")

    # Method 2: HTML mein trid variable
    trid_m = re.search(r"[\"']?trid[\"']?\s*[:=]\s*[\"']?(\d+)", html)
    trtype_m = re.search(r"[\"']?trtype[\"']?\s*[:=]\s*[\"']?(\d+)", html)
    if trid_m:
        return trid_m.group(1), (trtype_m.group(1) if trtype_m else "2")

    # Method 3: Script tags
    for script in soup.find_all("script"):
        text = script.string or ""
        m = re.search(r"trid[=:\s\"']+(\d+)", text)
        if m:
            trtype_m2 = re.search(r"trtype[=:\s\"']+(\d+)", text)
            return m.group(1), (trtype_m2.group(1) if trtype_m2 else "2")

    return None, None


@app.get("/api/episode/{slug}")
async def get_episode(slug: str):
    try:
        trid, trtype = await extract_trid(slug)
        if not trid:
            raise HTTPException(status_code=404, detail="trid not found in page")

        embed_url = f"{BASE_URL}/?trembed=1&trid={trid}&trtype={trtype}"
        return {
            "status": "ok",
            "trid": trid,
            "trtype": trtype,
            "embed_url": embed_url,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── PROXY — embed page ka HTML hamare server se serve karo ──────────────────
# Toono X-Frame-Options block karta hai — hum server se fetch karke
# HTML modify karke denge (X-Frame-Options header remove)

@app.get("/api/proxy/embed")
async def proxy_embed(trid: str, trtype: str = "2"):
    """
    Toono embed page fetch karo server-side,
    X-Frame-Options hata ke clean HTML return karo
    """
    try:
        embed_url = f"{BASE_URL}/?trembed=1&trid={trid}&trtype={trtype}"
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(embed_url, headers=EMBED_HEADERS)
            html = resp.text

        # X-Frame-Options aur CSP headers hata ke return karo
        return Response(
            content=html,
            media_type="text/html",
            headers={
                "Access-Control-Allow-Origin": "*",
                "X-Frame-Options": "ALLOWALL",
            }
        )

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
