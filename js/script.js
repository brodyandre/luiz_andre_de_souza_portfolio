document.addEventListener('DOMContentLoaded', function() {
  const username = 'brodyandre';
  const githubToken = ''; // Insira seu token aqui, se disponível

  // Helper para construir headers com o token
  function getGitHubHeaders() {
    const headers = { Accept: 'application/vnd.github.v3+json' };
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
    const per_page = 100;
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
          languages: languages,
          link: repo.html_url
        };
      });
      const uniqueProjetos = [];
      const seenTitles = new Set();
      for (const projeto of projetos) {
        if (!seenTitles.has(projeto.title)) {
          seenTitles.add(projeto.title);
          uniqueProjetos.push(projeto);
        }
      }
      renderProjetos(uniqueProjetos);
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
      let errorMsg = 'Erro ao carregar projetos. Acesse meu <a href="https://github.com/brodyandre?tab=repositories" target="_blank" rel="noopener noreferrer">GitHub</a>.';
      if (!githubToken) {
        errorMsg += ' (Considere adicionar um token GitHub para aumentar o limite de requisições)';
      }
      listaProjetos.innerHTML = `<p style="color: red;">${errorMsg}: ${error.message}</p>`;
      console.error(error);
    }
  }

  // Filtro de anos para certificados
  const yearFilterButtons = document.querySelectorAll('.filtro-certificados button');
  const certificados = document.querySelectorAll('.certificado');

  yearFilterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      yearFilterButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-checked', 'true');
      const selectedYear = this.dataset.year;
      certificados.forEach(certificado => {
        if (selectedYear === 'all' || certificado.dataset.year === selectedYear) {
          certificado.style.display = 'block';
        } else {
          certificado.style.display = 'none';
        }
      });
    });
    btn.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // Inicia o carregamento
  loadProjects();

  // -------- MODAIS --------
  const certificadoModal = document.getElementById('certificadoModal');
  const modalImg = document.getElementById('certificadoImg');
  const credencialLink = document.getElementById('credencialLink');
  const certificadoItems = document.querySelectorAll('.certificado-item');

  certificadoItems.forEach(item => {
    item.addEventListener('click', () => {
      modalImg.src = item.dataset.img;
      credencialLink.href = item.dataset.credencial;
      certificadoModal.style.display = "block";
    });
  });

  document.querySelectorAll('.close, .close-btn').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.modal').style.display = "none";
    };
  });

  const mapModal = document.getElementById('mapModal');
  const verMapaBtn = document.getElementById('verMapaBtn');
  const googleMap = document.getElementById('googleMap');

  if (verMapaBtn) {
    verMapaBtn.onclick = () => {
      googleMap.src = "https://www.google.com/maps/embed?...";
      mapModal.style.display = "block";
    };
  }

  const curriculoModal = document.getElementById('curriculoModal');
  const verCurriculoBtn = document.getElementById('verCurriculoBtn');

  if (verCurriculoBtn) {
    verCurriculoBtn.onclick = () => {
      curriculoModal.style.display = "block";
      curriculoModal.setAttribute("aria-hidden", "false");
      verCurriculoBtn.setAttribute("aria-expanded", "true");
    };
  }

  // -------- BOTÃO VOLTAR AO TOPO --------
  const backToTop = document.getElementById("backToTop");
  window.onscroll = function() {
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
      backToTop.style.display = "block";
    } else {
      backToTop.style.display = "none";
    }
  };
  backToTop.onclick = function() {
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  // -------- TEMA --------
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = localStorage.getItem('theme') || 'light';
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
    });
  }

  // -------- SCROLL SUAVE --------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // -------- FORMULÁRIO --------
  const contatoForm = document.getElementById('contatoForm');
  if (contatoForm) {
    contatoForm.addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Mensagem enviada com sucesso!');
      contatoForm.reset();
    });
  }
});
