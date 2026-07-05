#!/usr/bin/env python3
"""Atualiza com segurança apenas a area opcional de projetos do GitHub.

O script roda em dry-run por padrao.
Use --apply para escrever em arquivo, --commit para criar commit e --push
para enviar ao remoto. A secao curada manualmente nunca e alterada.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass
from html import escape
from typing import Iterable
from urllib import error, parse, request

AUTO_PROJECTS_START = "<!-- github-auto-projects:start -->"
AUTO_PROJECTS_END = "<!-- github-auto-projects:end -->"
DEFAULT_COMMIT_MESSAGE = "chore: refresh auto-managed GitHub projects"
DEFAULT_AUTO_PROJECT_LIMIT = 10
USER_AGENT = "portfolio-maintenance-script/2.0"
MANAGED_BLOCK_PATTERN = re.compile(
    r"(?P<indent>^[ \t]*)<!-- github-auto-projects:start -->\n?"
    r"(?P<content>.*?)"
    r"(?P=indent)<!-- github-auto-projects:end -->",
    re.MULTILINE | re.DOTALL,
)

# Repositorios curados manualmente no portfolio para recrutadores.
CURATED_REPOSITORIES = {
    "agente-ia-manuais-rh-rag",
    "aws-lakehouse-engineering-lab",
    "azure-snowflake-dbt-local-data-platform",
    "data-quality-api-continuous-delivery-lab",
    "kubernetes-deploy-strategies-lab",
    "nodejs-jenkins-k8s-cicd-lab",
}

PRIORITY_COMPLEMENTARY_REPOSITORIES = [
    "dataops-github-actions-lab",
    "github-actions-self-hosted-runner-lab",
    "kubernetes-security-hardening-lab",
    "kubernetes-update-strategies-lab",
    "kubernetes-resilience-ha-lab",
    "marketing-data-engineering-pipeline-lab",
    "product-reviews-cicd-pipeline-lab",
    "churninsight-nocountry",
    "growth_equestre_hackathon_2026",
    "kubernetes-storage-volumes-lab",
]

DESCRIPTION_OVERRIDES = {
    "dataops-github-actions-lab": (
        "Laboratório de DataOps com GitHub Actions, automação de pipelines, validações e práticas de CI/CD."
    ),
    "github-actions-self-hosted-runner-lab": (
        "Repositório público com estudos e testes práticos sobre self-hosted runners no GitHub Actions."
    ),
    "kubernetes-security-hardening-lab": (
        "Repositório público com estudos e testes práticos sobre hardening e segurança em workloads Kubernetes."
    ),
    "kubernetes-update-strategies-lab": (
        "Repositório público com estudos e testes práticos sobre estratégias de atualização e rollout no Kubernetes."
    ),
    "kubernetes-resilience-ha-lab": (
        "Repositório público com estudos e testes práticos de resiliência e alta disponibilidade em Kubernetes."
    ),
    "marketing-data-engineering-pipeline-lab": (
        "Repositório público com estudos e testes práticos de pipeline de Engenharia de Dados aplicado a dados de marketing."
    ),
    "product-reviews-cicd-pipeline-lab": (
        "Repositório público com estudos e testes práticos de CI/CD aplicados a um fluxo de avaliações de produtos."
    ),
    "churninsight-nocountry": (
        "MVP de previsão de churn para hackathon, combinando análise de dados e uma API para disponibilização do modelo."
    ),
    "growth_equestre_hackathon_2026": (
        "MVP de hackathon para captação e qualificação de leads, com backend, scoring e orquestração local via Docker Compose."
    ),
    "kubernetes-storage-volumes-lab": (
        "Laboratório de Kubernetes focado em volumes, persistência, StorageClass, ConfigMap, Secret e gestão de recursos."
    ),
}


@dataclass
class ProjectCard:
    name: str
    description: str
    link: str
    tags: list[str]
    project_type: str = "Repositório complementar"


class SafePortfolioUpdater:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.username = args.username
        self.pages_dir = pathlib.Path(args.pages_dir).resolve()
        self.html_path = self.pages_dir / args.html_file
        self.token = os.getenv("GITHUB_TOKEN", "").strip()
        self.base_url = "https://api.github.com"

    def log(self, message: str) -> None:
        print(message)

    def get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT,
        }
        if self.token:
            headers["Authorization"] = f"token {self.token}"
        return headers

    def fetch_json(self, url: str) -> object:
        req = request.Request(url, headers=self.get_headers())
        try:
            with request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except error.HTTPError as exc:
            if exc.code == 403 and exc.headers.get("X-RateLimit-Remaining") == "0":
                raise RuntimeError(
                    "GitHub API rate limit atingido. Rode novamente mais tarde ou defina GITHUB_TOKEN."
                ) from exc
            raise RuntimeError(f"Falha ao acessar GitHub API ({exc.code}) em {url}.") from exc
        except error.URLError as exc:
            raise RuntimeError(
                "Falha de rede ao acessar a GitHub API. Verifique sua conexao ou tente novamente mais tarde."
            ) from exc

    def fetch_all_repositories(self) -> list[dict]:
        repositories: list[dict] = []
        for page in range(1, self.args.max_pages + 1):
            query = parse.urlencode(
                {
                    "per_page": self.args.per_page,
                    "page": page,
                    "sort": "updated",
                }
            )
            url = f"{self.base_url}/users/{self.username}/repos?{query}"
            payload = self.fetch_json(url)
            if not isinstance(payload, list):
                raise RuntimeError("Resposta inesperada da GitHub API ao listar repositórios.")

            repositories.extend(payload)
            if len(payload) < self.args.per_page:
                break

        return repositories

    def repo_tags(self, repo: dict) -> list[str]:
        tags: list[str] = []
        language = (repo.get("language") or "").strip()
        if language:
            tags.append(language)

        name = (repo.get("name") or "").lower()
        description = (repo.get("description") or "").lower()

        if "aws" in name or "aws" in description:
            tags.append("AWS")
        if "kubernetes" in name or "k8s" in name or "kubernetes" in description:
            tags.append("Kubernetes")
        if "github actions" in description or "github-actions" in name:
            tags.append("GitHub Actions")
        if "docker" in description or "docker" in name:
            tags.append("Docker")

        deduplicated: list[str] = []
        for tag in tags:
            if tag not in deduplicated:
                deduplicated.append(tag)
        return deduplicated[:5]

    def normalize_description(self, description: str, repo_name: str = "") -> str:
        fallback = "Repositório público com estudos, testes e implementações práticas."
        if repo_name in DESCRIPTION_OVERRIDES:
            return DESCRIPTION_OVERRIDES[repo_name]
        normalized = re.sub(r"\s+", " ", description or "").strip()
        normalized = re.sub(r"^\s*[^\wÀ-ÿ]+", "", normalized)
        normalized = re.sub(r"\s*\(Confira.*?\)\s*$", "", normalized, flags=re.IGNORECASE)

        if not normalized:
            return fallback

        replacements = [
            (r"\bvc\b", "você"),
            (r"\bdesfio\b", "desafio"),
            (r"\bdatascience\b", "Data Science"),
            (r"\bdata lake\b", "Data Lake"),
            (r"\bmachine learning\b", "Machine Learning"),
            (r"\bjava script\b", "JavaScript"),
            (r"\bci\s+cd\b", "CI/CD"),
            (r"\bdockerhub\b", "Docker Hub"),
            (r"\bgit hub\b", "GitHub"),
            (r"\blinkedin\b", "LinkedIn"),
            (r"\bapp\b", "aplicação"),
            (r"\bpyhton\b", "Python"),
            (r"\bpython\b", "Python"),
            (r"\bmercedes bens\b", "Mercedes-Benz"),
            (r"\bseguimento\b", "segmento"),
            (r"^aqui você encontrará um projeto completo para\b", "Projeto com"),
            (r"^esse aplicativo\b", "Este aplicativo"),
            (r"^esse projeto\b", "Este projeto"),
            (r"^esse desafio\b", "Este desafio"),
        ]
        for pattern, replacement in replacements:
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)

        normalized = normalized[0].upper() + normalized[1:]
        if normalized[-1] not in ".!?":
            normalized += "."
        return normalized

    def ordered_repositories(self, repositories: Iterable[dict]) -> list[dict]:
        filtered_repositories = []
        for repo in repositories:
            name = repo.get("name") or ""
            if not name or name in CURATED_REPOSITORIES:
                continue
            if repo.get("private"):
                continue
            filtered_repositories.append(repo)

        repositories_by_name = {
            (repo.get("name") or ""): repo for repo in filtered_repositories
        }

        prioritized_repositories = []
        for repository_name in PRIORITY_COMPLEMENTARY_REPOSITORIES:
            repo = repositories_by_name.pop(repository_name, None)
            if repo:
                prioritized_repositories.append(repo)

        remaining_repositories = [
            repo
            for repo in filtered_repositories
            if (repo.get("name") or "") in repositories_by_name
        ]
        return prioritized_repositories + remaining_repositories

    def repo_cards(self, repositories: Iterable[dict]) -> list[ProjectCard]:
        cards: list[ProjectCard] = []
        for repo in self.ordered_repositories(repositories):
            name = repo.get("name") or ""
            description = self.normalize_description((repo.get("description") or "").strip(), name)

            cards.append(
                ProjectCard(
                    name=name,
                    description=description,
                    link=repo.get("html_url") or f"https://github.com/{self.username}/{name}",
                    tags=self.repo_tags(repo),
                )
            )

            if self.args.limit and len(cards) >= self.args.limit:
                break

        return cards

    def render_cards_html(self, cards: list[ProjectCard]) -> str:
        if not cards:
            return (
                '<p class="github-auto-projects-placeholder">'
                "Nenhum repositório adicional elegível foi encontrado para a área automatizada."
                "</p>"
            )

        html_blocks = []
        for card in cards:
            tags = card.tags or ["GitHub"]
            tags_html = "".join(
                f'<span class="linguagem-tag">{escape(tag)}</span>' for tag in tags
            )
            html_blocks.append(
                "\n".join(
                    [
                        '<article class="projeto-card" data-auto-project-card>',
                        '  <div class="projeto-card-header">',
                        f'    <p class="projeto-tipo">{escape(card.project_type)}</p>',
                        f"    <h3>{escape(card.name)}</h3>",
                        "  </div>",
                        f'  <p class="projeto-resumo">{escape(card.description)}</p>',
                        f'  <div class="projeto-linguagens">{tags_html}</div>',
                        '  <div class="projeto-acoes">',
                        (
                            f'    <a href="{escape(card.link)}" class="projeto-link" '
                            'target="_blank" rel="noopener noreferrer">Ver repositório</a>'
                        ),
                        "  </div>",
                        "</article>",
                    ]
                )
            )
        return "\n\n".join(html_blocks)

    def read_html(self) -> str:
        if not self.html_path.exists():
            raise FileNotFoundError(f"Arquivo HTML não encontrado: {self.html_path}")
        return self.html_path.read_text(encoding="utf-8")

    def replace_managed_block(self, html: str, rendered_cards: str) -> tuple[str, str]:
        match = MANAGED_BLOCK_PATTERN.search(html)
        if not match:
            raise RuntimeError(
                "Bloco gerenciado não encontrado. Adicione os comentários "
                f"{AUTO_PROJECTS_START} e {AUTO_PROJECTS_END} ao HTML."
            )

        indent = match.group("indent")
        current_block = match.group("content").strip()
        indented_render = "\n".join(
            f"{indent}{line}" if line else "" for line in rendered_cards.splitlines()
        )
        replacement = "\n".join(
            [
                f"{indent}{AUTO_PROJECTS_START}",
                indented_render,
                f"{indent}{AUTO_PROJECTS_END}",
            ]
        )
        updated_html = MANAGED_BLOCK_PATTERN.sub(replacement, html, count=1)
        return updated_html, current_block

    def write_html(self, html: str) -> None:
        self.html_path.write_text(html, encoding="utf-8")

    def commit_changes(self) -> None:
        self.log("Criando commit apenas com a atualização consciente do bloco automatizado.")
        subprocess.run(
            ["git", "-C", str(self.pages_dir), "add", self.html_path.name],
            check=True,
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(self.pages_dir),
                "commit",
                "-m",
                self.args.commit_message,
            ],
            check=True,
        )

    def push_changes(self) -> None:
        self.log("Enviando alterações para o repositório remoto.")
        subprocess.run(["git", "-C", str(self.pages_dir), "push"], check=True)

    def print_plan(self, cards: list[ProjectCard], changed: bool) -> None:
        mode = "APPLY" if self.args.apply else "DRY-RUN"
        self.log(f"[{mode}] Seção curada manualmente não será alterada.")
        self.log(
            f"[{mode}] Apenas o bloco entre {AUTO_PROJECTS_START} e {AUTO_PROJECTS_END} pode ser atualizado."
        )
        self.log(f"[{mode}] Repositórios automáticos elegíveis: {len(cards)}")
        preview = min(len(cards), self.args.preview)
        if preview:
            self.log(f"[{mode}] Prévia dos primeiros {preview} repositórios:")
            for card in cards[:preview]:
                self.log(f"  - {card.name}")
        else:
            self.log(f"[{mode}] Nenhum repositório automático elegível encontrado.")

        if changed:
            self.log(f"[{mode}] Alterações foram detectadas em {self.html_path.name}.")
        else:
            self.log(f"[{mode}] Nenhuma alteração necessária em {self.html_path.name}.")

        if not self.args.apply:
            self.log("[DRY-RUN] Nenhum arquivo foi modificado. Use --apply para gravar.")
        elif self.args.apply and not self.args.commit:
            self.log("[APPLY] Arquivo atualizado localmente sem commit automático.")
        elif self.args.commit and not self.args.push:
            self.log("[COMMIT] Commit será criado localmente sem push automático.")

    def run(self) -> int:
        html = self.read_html()
        try:
            repositories = self.fetch_all_repositories()
        except RuntimeError as exc:
            if self.args.apply:
                raise
            self.log(f"[DRY-RUN] {exc}")
            self.log("[DRY-RUN] Nenhum arquivo foi modificado. Tente novamente com rede disponível para simular a atualização.")
            return 0
        cards = self.repo_cards(repositories)
        rendered_cards = self.render_cards_html(cards)
        updated_html, current_block = self.replace_managed_block(html, rendered_cards)
        next_block = rendered_cards.strip()
        changed = current_block != next_block

        self.print_plan(cards, changed)

        if not changed:
            return 0

        if not self.args.apply:
            return 0

        self.write_html(updated_html)
        self.log(f"[APPLY] {self.html_path.name} foi atualizado apenas no bloco gerenciado.")

        if self.args.commit:
            self.commit_changes()

        if self.args.push:
            self.push_changes()

        return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Atualiza com segurança apenas a área opcional de projetos do GitHub. "
            "Dry-run é o comportamento padrão."
        )
    )
    parser.add_argument("--username", default="brodyandre", help="Usuário GitHub a consultar.")
    parser.add_argument("--pages-dir", default=".", help="Raiz local do portfólio.")
    parser.add_argument("--html-file", default="index.html", help="Arquivo HTML principal.")
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_AUTO_PROJECT_LIMIT,
        help="Quantidade máxima de repositórios automáticos a renderizar. Use 0 para incluir todos os elegíveis.",
    )
    parser.add_argument(
        "--all-projects",
        action="store_true",
        help="Inclui explicitamente todos os repositórios elegíveis no bloco automatizado.",
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=100,
        help="Quantidade de repositórios por página na GitHub API.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=5,
        help="Quantidade máxima de páginas a consultar na GitHub API.",
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=5,
        help="Quantidade de itens exibidos no resumo do dry-run/apply.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Grava conscientemente alterações reais no arquivo HTML.",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Cria commit local explicitamente após --apply.",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Envia explicitamente para o remoto após --apply --commit.",
    )
    parser.add_argument(
        "--commit-message",
        default=DEFAULT_COMMIT_MESSAGE,
        help="Mensagem de commit usada com --commit.",
    )
    return parser


def validate_args(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None:
    if args.all_projects:
        args.limit = 0
    if args.commit and not args.apply:
        parser.error("--commit exige --apply.")
    if args.push and not args.commit:
        parser.error("--push exige --commit.")
    if args.limit < 0:
        parser.error("--limit deve ser maior ou igual a zero.")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    validate_args(args, parser)

    updater = SafePortfolioUpdater(args)
    try:
        return updater.run()
    except Exception as exc:  # pragma: no cover - saída operacional
        print(f"[ERRO] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
