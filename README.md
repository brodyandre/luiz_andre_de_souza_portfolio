# Portfólio de Luiz André de Souza

Portfólio pessoal publicado em GitHub Pages para apresentar projetos aplicados, competências técnicas e materiais de apoio com foco em processos seletivos para Engenharia de Dados, DataOps, Cloud e áreas correlatas.

## Visão geral

Este repositório contém um site estático, sem framework e sem etapa de build, criado para funcionar como vitrine profissional em LinkedIn, GitHub e candidaturas. O conteúdo principal é curado manualmente para priorizar clareza, leitura técnica e aderência ao posicionamento profissional do portfólio.

## Objetivo do portfólio

- Comunicar rapidamente o posicionamento profissional na primeira dobra
- Destacar projetos com melhor sinal de empregabilidade
- Facilitar acesso a GitHub, LinkedIn, currículo, certificações e contato
- Organizar o histórico técnico de forma objetiva para recrutadores e lideranças técnicas

## Público-alvo

- Recrutadores
- Tech recruiters
- Lideranças técnicas
- Gestores de times de dados, plataforma, DevOps e Cloud
- Pessoas avaliando portfólio em processos seletivos

## Seções da página

- Hero section com posicionamento profissional, stack principal e CTAs
- `O que eu entrego`
- `Projetos em destaque`
- `Explorar outros repositórios`
- `Skills`
- `Certificações`
- `Aberto a oportunidades`
- `Contato`

## Stack real do projeto

O projeto usa apenas tecnologias realmente presentes no repositório:

- `HTML5`
- `CSS3`
- `JavaScript` puro
- `Python 3` para manutenção do bloco automatizado de repositórios
- `GitHub Pages` para publicação
- `GitHub API` apenas para carregar repositórios complementares sob demanda e para o script de manutenção

Observações importantes:

- Não há framework frontend
- Não há bundler
- Não há backend
- Não há etapa de build
- O site funciona como projeto estático

## Estrutura de pastas

```text
.
├── README.md
├── atualiza_portfolio.py
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── assets/
    ├── imagens do perfil
    ├── currículo
    └── imagens de certificados
```

## Como executar localmente

Como este projeto é um site estático, basta servir os arquivos localmente e abrir o endereço no navegador:

```bash
python3 -m http.server 8000
```

Depois, acesse:

```text
http://localhost:8000
```

## Como publicar no GitHub Pages

Na configuração atual, o portfólio depende apenas dos arquivos estáticos do repositório. Não existe pipeline de build para gerar artefatos.

Fluxo recomendado:

1. Revise as alterações localmente.
2. Faça commit e push para a branch usada pelo repositório.
3. Confirme em `Settings > Pages` qual branch e pasta estão configuradas para publicação.
4. Aguarde a atualização do GitHub Pages.

URL pública atual:

```text
https://brodyandre.github.io/luiz_andre_de_souza_portfolio/
```

## Projetos em destaque

Os seis projetos principais são curados manualmente no `index.html` e não dependem da API do GitHub para aparecer:

- `azure-snowflake-dbt-local-data-platform`
- `data-quality-api-continuous-delivery-lab`
- `nodejs-jenkins-k8s-cicd-lab`
- `agente-ia-manuais-rh-rag`
- `aws-lakehouse-engineering-lab`
- `kubernetes-deploy-strategies-lab`

Essa curadoria existe para manter o foco em projetos com melhor contexto técnico, documentação mais forte e leitura mais útil para recrutadores.

## Como funciona a lista complementar de repositórios

A seção `Explorar outros repositórios` complementa a curadoria principal sem competir com os seis projetos de destaque.

Funcionamento atual:

- A área começa recolhida por padrão
- O HTML inicial mantém apenas uma seleção complementar limitada e mais relevante para empregabilidade
- Os demais repositórios públicos podem ser carregados sob demanda via JavaScript
- O objetivo é evitar ruído excessivo no HTML principal e preservar foco no conteúdo mais estratégico

O bloco estático complementar fica delimitado em `index.html` por:

```html
<!-- github-auto-projects:start -->
<!-- github-auto-projects:end -->
```

## Como funciona o script `atualiza_portfolio.py`

O script existe para manter apenas a área complementar automatizada de repositórios, sem tocar na seção curada de `Projetos em destaque`.

Responsabilidades do script:

- Consultar os repositórios públicos do usuário no GitHub
- Aplicar priorização para alguns laboratórios mais relevantes
- Normalizar descrições complementares
- Atualizar exclusivamente o bloco delimitado por comentários HTML
- Opcionalmente fazer commit e push, mas nunca por padrão

Comportamento importante:

- Repositórios curados manualmente são protegidos
- O limite padrão da lista automatizada é controlado pelo script
- Existe a opção `--all-projects` para incluir explicitamente todos os repositórios elegíveis no bloco automatizado

## Modo seguro do script

O script roda em `dry-run` por padrão. Isso significa que ele mostra o que faria, mas não altera arquivos sem uma flag explícita.

Comandos principais:

```bash
python3 atualiza_portfolio.py
python3 atualiza_portfolio.py --apply
python3 atualiza_portfolio.py --apply --commit
python3 atualiza_portfolio.py --apply --commit --push
```

Resumo do comportamento:

- `python3 atualiza_portfolio.py`
  Mostra a prévia da atualização sem gravar nada
- `python3 atualiza_portfolio.py --apply`
  Aplica conscientemente alterações reais no HTML
- `python3 atualiza_portfolio.py --apply --commit`
  Aplica alterações e cria commit local
- `python3 atualiza_portfolio.py --apply --commit --push`
  Aplica alterações, cria commit local e envia ao remoto

`Commit` e `push` automáticos não fazem parte do fluxo padrão.

## Como validar alterações

Validações úteis para este repositório:

```bash
node --check js/script.js
python3 -m py_compile atualiza_portfolio.py
python3 atualiza_portfolio.py
python3 atualiza_portfolio.py --apply
python3 atualiza_portfolio.py --apply --commit
python3 atualiza_portfolio.py --apply --commit --push
```

Fluxo de revisão local recomendado:

- Abrir o site em servidor local
- Revisar responsividade
- Validar filtros, modais, tema e links
- Conferir `git diff` e `git status --short` antes de publicar

## Melhorias recentes

- Hero section mais clara para recrutadores
- Curadoria manual dos seis projetos principais
- Área complementar de repositórios com foco e carregamento sob demanda
- Seção `O que eu entrego`
- Seção `Aberto a oportunidades`
- Certificações reorganizadas entre destaque e acervo completo
- Revisão textual com padronização de termos técnicos
- Acessibilidade básica com skip link, foco visível, filtros por teclado e modais mais semânticos
- Suporte a temas `Claro`, `Neutro` e `Escuro`

## Próximos passos

- Continuar refinando a curadoria dos projetos conforme a evolução do GitHub
- Revisar periodicamente textos de empregabilidade e clareza técnica
- Evoluir a acessibilidade com testes manuais recorrentes
- Considerar evidências visuais adicionais dos projetos mais fortes
- Manter o bloco complementar enxuto para não diluir o foco do portfólio

## Autor

**Luiz André de Souza**

- GitHub: <https://github.com/brodyandre>
- LinkedIn: <https://www.linkedin.com/in/luiz-andre-souza-data-engineer/>
- Portfólio: <https://brodyandre.github.io/luiz_andre_de_souza_portfolio/>
