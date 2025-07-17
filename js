// Carregar variáveis de ambiente
require('dotenv').config();

document.addEventListener('DOMContentLoaded', function() {
  const username = 'brodyandre';
  const githubToken = process.env.GITHUB_TOKEN || ''; // Lê do arquivo .env ou usa string vazia

  // Helper para construir headers com o token
  function getGitHubHeaders() {
    const headers = { 
      Accept: 'application/vnd.github.v3+json',
      ...(githubToken && { Authorization: `token ${githubToken}` })
    };
    return headers;
  }

  // Função para debug do rate limit
  async function debugRateLimit() {
    try {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: getGitHubHeaders()
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log('Rate Limit Status:', {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000).toLocaleTimeString()
      });
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error);
    }
  }

  // Fetch com tratamento de rate limit
  async function fetchWithRetry(url, options = {}, retries = 3) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: getGitHubHeaders()
      });

      // Se atingiu o limite de requisições
      if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
        const waitTime = Math.max(0, resetTime - Date.now() + 1000); // +1s de margem
        
        console.log(`Rate limit atingido. Aguardando ${Math.ceil(waitTime/1000)} segundos...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchWithRetry(url, options, retries - 1);
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (retries <= 0) throw error;
      console.log(`Tentativa ${4-retries}: Nova tentativa em 1s...`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
  }

  const filtroBtns = document.querySelectorAll('.filtro button');
  const listaProjetos = document.getElementById('lista-projetos');

  // Verifica rate limit no carregamento
  debugRateLimit();

  // Extract first meaningful paragraph or fallback text
  function extractDescription(readmeContent) {
    if (!readmeContent) return 'Descrição não disponível.';
    const paragraphs = readmeContent.split(/\r?\n\r?\n/);
    for (let p of paragraphs) {
      let text = p.trim();
      if (text.length > 0) {
        text = text.replace(/!\[.*?\]\(.*?\)/g, '')
                 .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                 .replace(/[>#*_`~\-]/g, '')
                 .trim();
        if (text.length > 20) return text;
      }
    }
    return 'Descrição não disponível.';
  }

  // Fetch README com tratamento de erros
  async function fetchREADME(repoName) {
    const url = `https://api.github.com/repos/${username}/${repoName}/readme`;
    try {
      const res = await fetchWithRetry(url);
      
      if (!res.ok) {
        if (res.status === 404) {
          console.warn(`README não encontrado para ${repoName}`);
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data?.content && data.encoding === 'base64') {
        const binaryString = atob(data.content.replace(/\n/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      }
      return null;
    } catch (error) {
      console.error(`Erro ao buscar README para ${repoName}:`, error);
      return null;
    }
  }

  // Fetch repositories com paginação e rate limit handling
  async function fetchAllRepos() {
    let repos = [];
    let page = 1;
    const per_page = 30; // Reduzido para minimizar requests

    while (true) {
      const url = `https://api.github.com/users/${username}/repos?per_page=${per_page}&page=${page}&sort=updated`;
      
      try {
        const res = await fetchWithRetry(url);
        const pageRepos = await res.json();
        repos.push(...pageRepos);

        if (pageRepos.length < per_page || page >= 2) break; // Limita a 2 páginas (60 repos)
        page++;
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay entre páginas
      } catch (error) {
        console.error('Erro ao buscar repositórios:', error);
        throw error;
      }
    }
    return repos;
  }

  function repoMatchesFilter(repo, filterLanguage) {
    if (filterLanguage === 'all') return true;
    const langLower = (repo.language || '').toLowerCase();

    if (filterLanguage === 'python') return langLower === 'python';
    if (filterLanguage === 'spark') return langLower === 'scala' || (repo.name?.toLowerCase().includes('spark'));
    if (filterLanguage === 'aws') return (repo.name?.toLowerCase().includes('aws')) || 
                                      (repo.description?.toLowerCase().includes('aws'));
    return false;
  }

  function renderProjetos(projetos, filter = 'all') {
    listaProjetos.innerHTML = '';
    const filtered = filter === 'all' ? projetos : projetos.filter(p => repoMatchesFilter(p, filter));

    if (filtered.length === 0) {
      listaProjetos.innerHTML = '<p>Nenhum projeto encontrado para o filtro selecionado.</p>';
      return;
    }

    filtered.forEach(projeto => {
      const div = document.createElement('div');
      div.className = 'projeto-card';
      div.innerHTML = `
        <h3>${projeto.title}</h3>
        <p>${projeto.description}</p>
        <div class="projeto-linguagens">
          ${projeto.languages.map(lang => `<span class="linguagem-tag ${lang}">${lang}</span>`).join('')}
        </div>
        <a href="${projeto.link}" class="projeto-link" target="_blank" rel="noopener noreferrer">Ver detalhes</a>
      `;
      listaProjetos.appendChild(div);
    });
  }

  async function loadProjects() {
    listaProjetos.innerHTML = '<p>Carregando projetos do GitHub...</p>';
    try {
      // Debug antes de começar
      await debugRateLimit();

      const allRepos = await fetchAllRepos();
      const projetos = [];
      const batchSize = 3; // Processa 3 repositórios por vez

      for (let i = 0; i < allRepos.length; i += batchSize) {
        const batch = allRepos.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async repo => {
            const readmeRaw = await fetchREADME(repo.name);
            const desc = extractDescription(readmeRaw) || 'Descrição não disponível';
            
            const languages = [];
            if (repo.language) languages.push(repo.language.toLowerCase());
            if ((repo.name?.toLowerCase().includes('aws')) || (repo.description?.toLowerCase().includes('aws'))) {
              if (!languages.includes('aws')) languages.push('aws');
            }
            if ((repo.name?.toLowerCase().includes('spark')) || (repo.language?.toLowerCase() === 'scala')) {
              if (!languages.includes('spark')) languages.push('spark');
            }
            if (repo.language?.toLowerCase() === 'python') {
              if (!languages.includes('python')) languages.push('python');
            }

            return {
              title: repo.name,
              description: desc,
              languages,
              link: repo.html_url
            };
          })
        );

        projetos.push(...results);
        renderProjetos(projetos); // Atualiza UI progressivamente
        
        if (i + batchSize < allRepos.length) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Delay entre batches
        }
      }

      // Configura filtros após carregar tudo
      filtroBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          filtroBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          this.classList.add('active');
          this.setAttribute('aria-checked', 'true');
          renderProjetos(projetos, this.dataset.language);
        });

        btn.addEventListener('keydown', e => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            btn.click();
          }
        });
      });

    } catch (error) {
      let errorMsg = 'Erro ao carregar projetos';
      if (!githubToken) {
        errorMsg += ' (Adicione um token GitHub no arquivo .env para aumentar o limite de requisições)';
      }
      listaProjetos.innerHTML = `<p style="color: red;">${errorMsg}: ${error.message}</p>`;
      console.error(error);
    }
  }

  // Inicia o carregamento
  loadProjects();

  // [O resto do seu código de modais permanece EXATAMENTE igual]
  const modal = document.getElementById('certificado-modal');
  const modalImg = document.getElementById('imagem-certificado');
  const closeModal = modal?.querySelector('.fechar-modal');

  if (closeModal) {
    closeModal.addEventListener('click', () => modal.style.display = "none");
    closeModal.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        modal.style.display = "none";
      }
    });
  }

  document.querySelectorAll('.ver-credencial').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.style.display = "block";
      modalImg.src = btn.dataset.imagem;
      modal.focus();
    });
  });

  const mapaModal = document.getElementById('mapa-modal');
  const abrirMapa = document.getElementById('abrir-mapa');
  const fecharMapa = mapaModal?.querySelector('.fechar-modal');
  const iframeMapa = document.getElementById('iframe-mapa');

  if (abrirMapa && mapaModal && iframeMapa) {
    abrirMapa.addEventListener('click', () => {
      iframeMapa.src = 'https://maps.google.com/maps?width=600&height=450&hl=pt-BR&q=Rua+Tom%C3%A9+Ribeiro,+49,+Jardim+Sapopemba,+São+Paulo+SP&ie=UTF8&t=&z=16&iwloc=B&output=embed';
      mapaModal.style.display = "block";
      mapaModal.focus();
    });
  }

  if (fecharMapa) {
    fecharMapa.addEventListener('click', () => {
      mapaModal.style.display = "none";
      iframeMapa.src = "";
    });
    fecharMapa.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        mapaModal.style.display = "none";
        iframeMapa.src = "";
      }
    });
  }

  window.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = "none";
    if (e.target === mapaModal) {
      mapaModal.style.display = "none";
      iframeMapa.src = "";
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modal.style.display === "block") modal.style.display = "none";
      if (mapaModal.style.display === "block") {
        mapaModal.style.display = "none";
        iframeMapa.src = "";
      }
    }
  });

  const backToTopBtn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    backToTopBtn.style.display = window.pageYOffset > 300 ? "block" : "none";
  });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', isDark);
    themeToggle.textContent = isDark ? '🌞' : '🌓';
    themeToggle.setAttribute('aria-pressed', isDark.toString());
  });

  if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '🌞';
    themeToggle.setAttribute('aria-pressed', 'true');
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        target.focus();
      }
    });
  });

  const formContato = document.getElementById('form-contato');
  if (formContato) {
    formContato.addEventListener('submit', e => {
      e.preventDefault();
      alert('Mensagem enviada com sucesso! Entrarei em contato em breve.');
      formContato.reset();
    });
  }

  const curriculoModal = document.createElement('div');
  curriculoModal.className = 'modal';
  curriculoModal.setAttribute('role', 'dialog');
  curriculoModal.setAttribute('aria-modal', 'true');
  curriculoModal.innerHTML = `
    <span class="fechar-modal" role="button" aria-label="Fechar modal" tabindex="0">&times;</span>
    <img class="modal-conteudo" id="imagem-curriculo" alt="Currículo" src="https://raw.githubusercontent.com/brodyandre/brodyandre.github.io/2dd5745396c2935c5db7e8365ceb8e2b0463b100/Curriculo%20moderno%20para%20profissional%20de%20TI%20azul.jpg" />
  `;
  document.body.appendChild(curriculoModal);
  window.curriculoModal = curriculoModal;

  const verCurriculoBtn = document.getElementById('ver-curriculo');
  verCurriculoBtn.addEventListener('click', () => {
    curriculoModal.style.display = "block";
    curriculoModal.focus();
  });

  const fecharCurriculoModal = curriculoModal.querySelector('.fechar-modal');
  fecharCurriculoModal.addEventListener('click', () => {
    curriculoModal.style.display = "none";
  });
  fecharCurriculoModal.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      curriculoModal.style.display = "none";
    }
  });
});

https://github.com/brodyandre/brodyandre.github.io/blob/c15ebb65a051faacc6899dafee220e6672d70fca/certificados/07_Certificado_Formacao_Engenheiro_de_Dados.png
