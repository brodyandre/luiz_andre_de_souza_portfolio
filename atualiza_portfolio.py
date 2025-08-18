import os
import re
import time
import base64
import pathlib
import mimetypes
import hashlib
import requests
import subprocess
from urllib.parse import urlparse
from dotenv import load_dotenv
from html import escape

class GitHubPortfolio:
    def __init__(self, username: str, pages_dir: str):
        load_dotenv()
        self.username = username
        self.pages_dir = pathlib.Path(pages_dir).resolve()
        self.html_path = self.pages_dir / "index.html"
        self.assets_dir = self.pages_dir / "assets"
        self.output_path = self.html_path
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.base_url = "https://api.github.com"
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    # --- HTTP helpers ---
    def get_headers(self):
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            headers["Authorization"] = f"token {self.token}"
        return headers

    def fetch_with_retry(self, url, retries=3):
        last_err = None
        for attempt in range(1, retries + 1):
            try:
                resp = requests.get(url, headers=self.get_headers(), timeout=60)
                if resp.status_code == 403 and resp.headers.get("X-RateLimit-Remaining") == "0":
                    reset_time = int(resp.headers.get("X-RateLimit-Reset", "0"))
                    wait_time = max(0, reset_time - int(time.time()) + 1)
                    print(f"Rate limit atingido. Aguardando {wait_time}s…")
                    time.sleep(wait_time)
                    continue
                resp.raise_for_status()
                return resp
            except Exception as e:
                last_err = e
                time.sleep(1)
        raise last_err

    # --- GitHub data ---
    def fetch_all_repos(self, per_page=30, max_pages=2):
        repos = []
        for page in range(1, max_pages + 1):
            url = f"{self.base_url}/users/{self.username}/repos?per_page={per_page}&page={page}&sort=updated"
            resp = self.fetch_with_retry(url)
            data = resp.json()
            repos.extend(data)
            if len(data) < per_page:
                break
            time.sleep(1)
        return repos

    def fetch_readme(self, repo_name):
        url = f"{self.base_url}/repos/{self.username}/{repo_name}/readme"
        resp = requests.get(url, headers=self.get_headers())
        if resp.status_code == 404:
            print(f"[INFO] Repositório '{repo_name}' não possui README.md")
            return None  # <-- ignora se não houver README
        resp.raise_for_status()
        data = resp.json()
        if data.get("encoding") == "base64" and "content" in data:
            return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
        return None


    # --- Conteúdo ---
    def extract_description(self, readme_content):
        if not readme_content:
            return "Descrição não disponível."
        paragraphs = re.split(r"\r?\n\r?\n", readme_content)
        for p in paragraphs:
            text = p.strip()
            if not text:
                continue
            text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
            text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
            text = re.sub(r"[>#*_`~\-]{1,}", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            if len(text) > 20:
                return text
        return "Descrição não disponível."

    def repo_languages(self, repo):
        langs = []
        if repo.get("language"):
            langs.append(repo["language"].lower())
        name = (repo.get("name") or "").lower()
        desc = (repo.get("description") or "").lower()
        if "aws" in name or "aws" in desc:
            langs.append("aws")
        if "spark" in name or (repo.get("language") or "").lower() == "scala":
            langs.append("spark")
        if (repo.get("language") or "").lower() == "python":
            langs.append("python")
        return sorted(set(langs))

    def render_cards_html(self, projetos):
        cards = []
        for p in projetos:
            tags_html = "".join(f'<span class="linguagem-tag {escape(lang)}">{escape(lang)}</span>' for lang in p["languages"])
            card = f"""
            <div class="projeto-card">
                <h3>{escape(p["title"])}</h3>
                <p>{escape(p["description"])}</p>
                <div class="projeto-linguagens">{tags_html}</div>
                <a href="{p["link"]}" class="projeto-link" target="_blank" rel="noopener noreferrer">Ver detalhes</a>
            </div>
            """
            cards.append(card)
        return "\n".join(cards)

    # --- Assets ---
    def _hash_name(self, url: str) -> str:
        parsed = urlparse(url)
        base = os.path.basename(parsed.path)
        name, ext = os.path.splitext(base)
        if not ext:
            ext = mimetypes.guess_extension(requests.head(url, allow_redirects=True).headers.get("Content-Type", "")) or ""
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
        return f"{name}-{digest}{ext}" if name else f"asset-{digest}{ext}"

    def _download_url(self, url: str) -> str:
        try:
            resp = requests.get(url, headers=self.get_headers(), timeout=60, stream=True)
            resp.raise_for_status()
            filename = self._hash_name(url)
            dst = self.assets_dir / filename
            with open(dst, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            return f"assets/{filename}"
        except Exception as e:
            print(f"[WARN] Falha ao baixar {url}: {e}")
            return url

    def _collect_asset_urls(self, html: str):
        urls = set()
        urls.update(re.findall(r'data-imagem="(https?://[^"]+)"', html))
        urls.update(re.findall(r'<img[^>]+src="(https?://[^"]+)"', html))
        urls.update(re.findall(r'<link[^>]+rel="icon"[^>]+href="(https?://[^"]+)"', html))
        urls.update(re.findall(r'<meta[^>]+property=["\']og:image["\'][^>]+content="(https?://[^"]+)"', html))
        return sorted(urls)

    def _rewrite_html_urls(self, html: str, url_map: dict):
        for old, new in url_map.items():
            html = html.replace(old, new)
        return html

    def download_and_embed_assets(self, html: str) -> str:
        urls = self._collect_asset_urls(html)
        url_map = {u: self._download_url(u) for u in urls}
        return self._rewrite_html_urls(html, url_map)

    # --- Atualização ---
    def update_pages_site(self):
        print(f"📂 Atualizando site na pasta: {self.pages_dir}")
        repos = self.fetch_all_repos()
        projetos = []
        for repo in repos:
            readme = self.fetch_readme(repo["name"])
            projetos.append({
                "title": repo["name"],
                "description": self.extract_description(readme),
                "languages": self.repo_languages(repo),
                "link": repo["html_url"]
            })

        cards_html = self.render_cards_html(projetos)

        with open(self.html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        new_html = re.sub(
            r'(<div id="lista-projetos"[^>]*>)(.*?)(</div>)',
            rf'\1\n{cards_html}\n\3',
            html_content,
            flags=re.DOTALL | re.IGNORECASE
        )

        new_html = self.download_and_embed_assets(new_html)

        with open(self.output_path, "w", encoding="utf-8") as f:
            f.write(new_html)

        print("✅ Site atualizado com sucesso!")

    # --- Git automation ---
    def commit_and_push(self, commit_msg="Atualização automática do portfólio"):
        try:
            subprocess.run(["git", "-C", str(self.pages_dir), "add", "."], check=True)
            subprocess.run(["git", "-C", str(self.pages_dir), "commit", "-m", commit_msg], check=True)
            subprocess.run(["git", "-C", str(self.pages_dir), "push"], check=True)
            print("🚀 Alterações enviadas para o GitHub Pages!")
        except subprocess.CalledProcessError as e:
            print(f"[ERRO] Falha no comando Git: {e}")

if __name__ == "__main__":
    github = GitHubPortfolio(
        username="brodyandre",   # ✅ seu usuário GitHub
        pages_dir="."            # ✅ raiz do repositório local
    )
    github.update_pages_site()
    github.commit_and_push()
