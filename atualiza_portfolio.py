import os
import re
import time
import base64
import pathlib
import mimetypes
import hashlib
import requests
from urllib.parse import urlparse
from dotenv import load_dotenv
from html import escape

class GitHubPortfolio:
    """
    Atualiza diretamente o repositório do GitHub Pages:
    - Substitui <div id="lista-projetos">…</div> com projetos do GitHub.
    - Baixa assets externos (imagens, favicon, etc.) para assets/.
    - Baixa CSS externo e incorpora inline.
    - Salva o resultado final como index.html pronto para publicar.
    """

    def __init__(self, username: str, repo_path: str):
        load_dotenv()
        self.username = username
        self.repo_path = pathlib.Path(repo_path).resolve()
        self.html_path = self.repo_path / "index.html"
        self.assets_dir = self.repo_path / "assets"
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.base_url = "https://api.github.com"
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    def get_headers(self):
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            headers["Authorization"] = f"token {self.token}"
        return headers

    def fetch_with_retry(self, url, retries=3):
        last_err = None
        for attempt in range(1, retries + 1):
            try:
                resp = requests.get(url, headers=self.get_headers(), timeout=60, stream=True)
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
                print(f"Tentativa {attempt} falhou: {e}")
                time.sleep(1.0)
        raise last_err

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
        resp = self.fetch_with_retry(url)
        if resp.status_code == 404:
            return None
        data = resp.json()
        if data.get("encoding") == "base64" and "content" in data:
            return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
        return None

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
            tags_html = "".join(
                f'<span class="linguagem-tag {escape(lang)}">{escape(lang)}</span>'
                for lang in p["languages"]
            )
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

    def _hash_name(self, url: str, default_ext: str = "") -> str:
        parsed = urlparse(url)
        base = os.path.basename(parsed.path)
        name, ext = os.path.splitext(base)
        if not ext:
            ext = default_ext or ""
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
        if name:
            safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", name)[:40]
            return f"{safe}-{digest}{ext}"
        return f"asset-{digest}{ext}"

    def _download_url(self, url: str) -> str:
        try:
            resp = requests.get(url, headers=self.get_headers(), timeout=120, stream=True)
            resp.raise_for_status()
            content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
            ext = mimetypes.guess_extension(content_type) or ""
            filename = self._hash_name(url, default_ext=ext)
            dst = self.assets_dir / filename
            with open(dst, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return str(dst.as_posix())
        except Exception as e:
            print(f"[WARN] Falha ao baixar {url}: {e}")
            return url

    def _collect_asset_urls(self, html: str):
        urls = set()
        urls.update(re.findall(r'data-imagem="(https?://[^"]+)"', html, flags=re.I))
        urls.update(re.findall(r'<img[^>]+src="(https?://[^"]+)"', html, flags=re.I))
        urls.update(re.findall(r'<link[^>]+rel="icon"[^>]+href="(https?://[^"]+)"', html, flags=re.I))
        urls.update(re.findall(r'<meta[^>]+property=["\']og:image["\'][^>]+content="(https?://[^"]+)"', html, flags=re.I))
        return sorted(u for u in urls if u.lower().startswith(("http://", "https://")))

    def _rewrite_html_urls(self, html: str, url_map: dict):
        patterns = [
            r'(data-imagem=")(https?://[^"]+)(")',
            r'(<img[^>]+src=")(https?://[^"]+)(")',
            r'(<link[^>]+rel="icon"[^>]+href=")(https?://[^"]+)(")',
            r'(<meta[^>]+property=["\']og:image["\'][^>]+content=")(https?://[^"]+)(")',
        ]
        for pat in patterns:
            html = re.sub(pat, lambda m: f"{m.group(1)}{url_map.get(m.group(2), m.group(2))}{m.group(3)}", html, flags=re.I)
        return html

    def download_and_embed_assets(self, html: str) -> str:
        urls = self._collect_asset_urls(html)
        url_map = {}
        for u in urls:
            local_path = self._download_url(u)
            rel_path = os.path.relpath(local_path, start=self.repo_path)
            url_map[u] = rel_path.replace("\\", "/")
        return self._rewrite_html_urls(html, url_map)

    def inline_external_css(self, html: str) -> str:
        matches = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href="(https?://[^"]+)"', html, flags=re.I)
        for css_url in matches:
            try:
                resp = requests.get(css_url, timeout=30)
                resp.raise_for_status()
                css_content = resp.text
                style_tag = f"<style>\n{css_content}\n</style>"
                html = html.replace(f'<link rel="stylesheet" href="{css_url}">', style_tag)
            except Exception as e:
                print(f"[WARN] Não foi possível baixar CSS {css_url}: {e}")
        return html

    def update_html_file(self):
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
        new_html = self.inline_external_css(new_html)

        with open(self.html_path, "w", encoding="utf-8") as f:
            f.write(new_html)

        print(f"[OK] index.html atualizado em {self.repo_path}")
        print(f"[OK] Assets salvos em {self.assets_dir}")

if __name__ == "__main__":
    gh = GitHubPortfolio(
        username="brodyandre",
        repo_path="C:\Users\USER\Documents\portfolio_github>"  # <<< ALTERE AQUI
    )
    gh.update_html_file()
