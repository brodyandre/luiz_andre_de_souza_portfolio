# Portfólio de Luiz André de Souza

Portfólio pessoal focado em `Engenharia de Dados`, `DataOps`, `Cloud` e `IA aplicada`, publicado como site estático para uso em LinkedIn, GitHub e candidaturas.

## Objetivo

Apresentar rapidamente o cargo-alvo, destacar projetos com valor profissional claro e facilitar o acesso a currículo, certificações, GitHub e LinkedIn.

## Stack

- `HTML5`
- `CSS3`
- `JavaScript` puro

## Estrutura

```text
.
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── assets/
```

## Seções do site

- Primeira dobra com posicionamento profissional e links principais
- Projetos em destaque com curadoria manual
- Skills organizadas por categoria
- Certificações com filtro por ano
- Contato com abertura de e-mail via `mailto:`

## Manutenção dos projetos

Os `Projetos em destaque` do portfólio são curados manualmente para recrutadores e não devem ser sobrescritos por automação.

O script [atualiza_portfolio.py](./atualiza_portfolio.py) atua apenas na área delimitada por:

```html
<!-- github-auto-projects:start -->
<!-- github-auto-projects:end -->
```

Essa área serve para repositórios adicionais do GitHub e não substitui a curadoria manual da seção principal.

### Uso seguro do script

Dry-run padrão:

```bash
python3 atualiza_portfolio.py
```

Aplicar alterações conscientemente:

```bash
python3 atualiza_portfolio.py --apply
```

Aplicar e criar commit local:

```bash
python3 atualiza_portfolio.py --apply --commit
```

Aplicar, criar commit e enviar ao remoto:

```bash
python3 atualiza_portfolio.py --apply --commit --push
```

`Commit` e `push` automático não são padrão e sempre exigem flags explícitas.

## Como executar localmente

Como este projeto é um site estático, basta servir os arquivos localmente:

```bash
python -m http.server 8000
```

Depois, abra:

```text
http://localhost:8000
```

## Checklist básico de qualidade

- SEO básico com `description`, `canonical`, Open Graph, Twitter Card e JSON-LD
- Cards de projetos independentes da API do GitHub
- Responsividade básica para mobile
- Acessibilidade básica com `skip link`, foco visível, modais fecháveis por `Esc` e filtros navegáveis por teclado

## Publicação

URL esperada do GitHub Pages:

```text
https://brodyandre.github.io/luiz_andre_de_souza_portfolio/
```
