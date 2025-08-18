document.addEventListener('DOMContentLoaded', function() {
  const username = 'brodyandre';
  const githubToken = ''; // Insira seu token aqui, se disponível (ex.: 'ghp_SeuTokenAqui')

  // Helper para construir headers com o token
  function getGitHubHeaders() {
    const headers = { 
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      headers.Authorization = `token ${githubToken}`;
    }
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

      if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
        const waitTime = Math.max(0, resetTime - Date.now() + 1000);
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

  // Função para buscar repositórios
  async function fetchAllRepos() {
    let repos = [];
    let page = 1;
    const per_page = 100; // Aumentado para buscar todos os repositórios de uma vez

    while (true) {
      const url = `https://api.github.com/users/${username}/repos?per_page=${per_page}&page=${page}&sort=updated`;
      try {
        const res = await fetchWithRetry(url);
        const pageRepos = await res.json();
        repos.push(...pageRepos);
        if (pageRepos.length < per_page) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    const repoNameLower = (repo.name || '').toLowerCase();
    const descLower = (repo.description || '').toLowerCase();

    if (filterLanguage === 'python') return langLower === 'python';
    if (filterLanguage === 'spark') return langLower === 'scala' || repoNameLower.includes('spark') || descLower.includes('spark');
    if (filterLanguage === 'aws') return repoNameLower.includes('aws') || descLower.includes('aws');
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
      // Garante que languages seja um array
      const languages = Array.isArray(projeto.languages) ? projeto.languages : [];
      div.innerHTML = `
        <h3>${projeto.title}</h3>
        <p>${projeto.description}</p>
        <div class="projeto-linguagens">
          ${languages.map(lang => `<span class="linguagem-tag ${lang.toLowerCase()}">${lang}</span>`).join('')}
        </div>
        <a href="${projeto.link}" class="projeto-link" target="_blank" rel="noopener noreferrer">Ver detalhes</a>
      `;
      listaProjetos.appendChild(div);
    });
  }

  async function loadProjects() {
    listaProjetos.innerHTML = '<p>Carregando projetos do GitHub...</p>';
    try {
      await debugRateLimit();
      const allRepos = await fetchAllRepos();
      const projetos = allRepos.map(repo => {
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
          description: repo.description || 'Descrição não disponível.',
          languages: languages, // Garante que languages seja um array
          link: repo.html_url
        };
      });

      // Remove duplicatas com base no título
      const uniqueProjetos = [];
      const seenTitles = new Set();
      for (const projeto of projetos) {
        if (!seenTitles.has(projeto.title)) {
          seenTitles.add(projeto.title);
          uniqueProjetos.push(projeto);
        }
      }

      // Renderiza projetos
      renderProjetos(uniqueProjetos);

      // Configura filtros
      filtroBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          filtroBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          this.classList.add('active');
          this.setAttribute('aria-checked', 'true');
          renderProjetos(uniqueProjetos, this.dataset.language);
        });

        btn.addEventListener('keydown', e => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            btn.click();
          }
        });
      });

    } catch (error) {
      let errorMsg = 'Erro ao carregar projetos. Acesse meu <a href="https://github.com/brodyandre?tab=repositories" target="_blank" rel="noopener noreferrer">GitHub</a> para ver todos os projetos.';
      if (!githubToken) {
        errorMsg += ' (Considere adicionar um token GitHub para aumentar o limite de requisições)';
      }
      listaProjetos.innerHTML = `<p style="color: red;">${errorMsg}: ${error.message}</p>`;
      console.error(error);
    }
  }

  // Inicia o carregamento
  loadProjects();

  // [Mantém o código de modais, tema, etc.]
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

  // Configuração do modal de currículo
  const curriculoModal = document.getElementById('curriculo-modal');
  const verCurriculoBtn = document.getElementById('ver-curriculo');
  const fecharCurriculoModal = curriculoModal?.querySelector('.fechar-modal');

  if (verCurriculoBtn && curriculoModal) {
    verCurriculoBtn.addEventListener('click', () => {
      curriculoModal.style.display = "block";
      curriculoModal.focus();
    });
  }

  if (fecharCurriculoModal) {
    fecharCurriculoModal.addEventListener('click', () => {
      curriculoModal.style.display = "none";
    });
    fecharCurriculoModal.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        curriculoModal.style.display = "none";
      }
    });
  }

  // Adiciona fechamento do modal de currículo ao clicar fora ou pressionar Esc
  window.addEventListener('click', e => {
    if (e.target === curriculoModal) {
      curriculoModal.style.display = "none";
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && curriculoModal.style.display === "block") {
      curriculoModal.style.display = "none";
    }
  });

  // Abre o modal de currículo automaticamente ao carregar a página
  if (verCurriculoBtn) {
    verCurriculoBtn.click();
  }
});
