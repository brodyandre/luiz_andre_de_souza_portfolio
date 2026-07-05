document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const projectFilterButtons = document.querySelectorAll('.filtro button');
  const projectCards = document.querySelectorAll('#lista-projetos .projeto-card');
  const certificationFilterButtons = document.querySelectorAll('.filtro-certificacoes button');
  const certificatesContainer = document.getElementById('certificados-lista');
  const backToTopButton = document.getElementById('back-to-top');
  const themeOptionButtons = Array.from(document.querySelectorAll('[data-theme-value]'));
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const currentYear = document.getElementById('current-year');
  const autoProjectsList = document.getElementById('github-auto-projects-list');
  const autoProjectsPanel = document.getElementById('github-auto-projects-panel');
  const autoProjectsStatus = document.getElementById('github-auto-projects-status');
  const autoProjectsTotal = document.getElementById('github-auto-projects-total');
  const toggleAutoProjectsButton = document.getElementById('toggle-auto-projects');
  const loadMoreAutoProjectsButton = document.getElementById('load-more-auto-projects');
  const curatedProjectNames = new Set(
    Array.from(projectCards)
      .map((card) => card.querySelector('h3')?.textContent?.trim())
      .filter(Boolean)
  );

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  function toLocalAssetPath(path) {
    if (!path) {
      return path;
    }

    const assetIndex = path.indexOf('/assets/');
    if (assetIndex === -1) {
      return path;
    }

    return decodeURIComponent(path.slice(assetIndex + 1));
  }

  document.querySelectorAll('[data-imagem]').forEach((button) => {
    button.dataset.imagem = toLocalAssetPath(button.dataset.imagem);
  });

  function updateRadioGroupState(buttons, activeButton) {
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-checked', String(isActive));
    });
  }

  function filterProjects(filter) {
    let visibleProjects = 0;

    projectCards.forEach((card) => {
      const filters = (card.dataset.filters || '').split(' ').filter(Boolean);
      const shouldShow = filter === 'all' || filters.includes(filter);

      card.hidden = !shouldShow;
      if (shouldShow) {
        visibleProjects += 1;
      }
    });

    const emptyStateId = 'projetos-empty-state';
    const existingEmptyState = document.getElementById(emptyStateId);

    if (visibleProjects === 0 && !existingEmptyState) {
      const emptyState = document.createElement('p');
      emptyState.id = emptyStateId;
      emptyState.className = 'section-intro';
      emptyState.textContent = 'Nenhum projeto em destaque corresponde a este filtro no momento.';
      const projectsList = document.getElementById('lista-projetos');
      projectsList?.after(emptyState);
    } else if (visibleProjects > 0 && existingEmptyState) {
      existingEmptyState.remove();
    }
  }

  const AUTO_PROJECTS_BATCH_SIZE = 12;
  let autoProjectsVisibleCount = 0;
  let autoProjectsLoaded = false;
  let autoProjectsLoading = false;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getAutoProjectCards() {
    return autoProjectsList
      ? Array.from(autoProjectsList.querySelectorAll('[data-auto-project-card]'))
      : [];
  }

  function inferAutoProjectTags(repo) {
    const inferredTags = [];
    const sourceText = `${repo.name || ''} ${repo.description || ''}`.toLowerCase();

    if (repo.language) {
      inferredTags.push(repo.language);
    }
    if (sourceText.includes('aws')) {
      inferredTags.push('AWS');
    }
    if (sourceText.includes('kubernetes') || sourceText.includes('k8s')) {
      inferredTags.push('Kubernetes');
    }
    if (sourceText.includes('github actions') || sourceText.includes('github-actions')) {
      inferredTags.push('GitHub Actions');
    }
    if (sourceText.includes('docker')) {
      inferredTags.push('Docker');
    }

    const deduplicatedTags = inferredTags.filter((tag, index) => inferredTags.indexOf(tag) === index);
    return deduplicatedTags.length > 0 ? deduplicatedTags.slice(0, 5) : ['GitHub'];
  }

  function renderAutoProjectCards(repositories) {
    if (!autoProjectsList) {
      return;
    }

    if (repositories.length === 0) {
      autoProjectsList.innerHTML = '<p class="github-auto-projects-placeholder">Nenhum repositório complementar elegível foi encontrado no momento.</p>';
      return;
    }

    const cardsHtml = repositories.map((repo) => {
      const description = normalizeRepositoryDescription(repo.description);
      const tagsHtml = inferAutoProjectTags(repo)
        .map((tag) => `<span class="linguagem-tag">${escapeHtml(tag)}</span>`)
        .join('');

      return `
        <article class="projeto-card" data-auto-project-card>
          <div class="projeto-card-header">
            <p class="projeto-tipo">Repositório complementar</p>
            <h3>${escapeHtml(repo.name)}</h3>
          </div>
          <p class="projeto-resumo">${escapeHtml(description)}</p>
          <div class="projeto-linguagens">${tagsHtml}</div>
          <div class="projeto-acoes">
            <a href="${escapeHtml(repo.html_url || `https://github.com/brodyandre/${repo.name}`)}" class="projeto-link" target="_blank" rel="noopener noreferrer">Ver repositório</a>
          </div>
        </article>
      `;
    }).join('');

    autoProjectsList.innerHTML = cardsHtml;
  }

  function normalizeRepositoryDescription(description) {
    const fallback = 'Repositório público com estudos, testes e implementações práticas.';
    const cleanedDescription = String(description || '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[^\p{L}\p{N}]+/u, '')
      .replace(/\s*\(Confira.*?\)\s*$/iu, '')
      .trim();

    if (!cleanedDescription) {
      return fallback;
    }

    let normalizedDescription = cleanedDescription
      .replace(/\bvc\b/gi, 'você')
      .replace(/\bdesfio\b/gi, 'desafio')
      .replace(/\bdatascience\b/gi, 'Data Science')
      .replace(/\bjava script\b/gi, 'JavaScript')
      .replace(/\bapp\b/gi, 'aplicação')
      .replace(/\bpython\b/gi, 'Python')
      .replace(/\bseguimento\b/gi, 'segmento')
      .replace(/^aqui você encontrará um projeto completo para\b/i, 'Projeto com')
      .replace(/^esse aplicativo\b/i, 'Este aplicativo')
      .replace(/^esse projeto\b/i, 'Este projeto')
      .replace(/^esse desafio\b/i, 'Este desafio');

    normalizedDescription = normalizedDescription.charAt(0).toUpperCase() + normalizedDescription.slice(1);

    if (!/[.!?]$/.test(normalizedDescription)) {
      normalizedDescription += '.';
    }

    return normalizedDescription;
  }

  function updateAutoProjectsSummary() {
    const totalCards = getAutoProjectCards().length;

    if (autoProjectsTotal) {
      autoProjectsTotal.textContent = totalCards > 0
        ? `${totalCards} repositórios complementares`
        : 'Lista complementar opcional';
    }

    if (toggleAutoProjectsButton) {
      const isExpanded = toggleAutoProjectsButton.getAttribute('aria-expanded') === 'true';
      toggleAutoProjectsButton.textContent = isExpanded
        ? 'Ocultar lista complementar'
        : totalCards > 0
          ? `Ver outros ${totalCards} repositórios`
          : 'Ver outros repositórios';
    }
  }

  function updateAutoProjectsVisibility() {
    const autoProjectCards = getAutoProjectCards();
    const totalCards = autoProjectCards.length;
    const visibleCards = Math.min(autoProjectsVisibleCount, totalCards);

    autoProjectCards.forEach((card, index) => {
      card.hidden = index >= visibleCards;
    });

    if (autoProjectsStatus) {
      if (totalCards === 0) {
        autoProjectsStatus.textContent = 'Nenhum repositório complementar está disponível nesta lista no momento.';
      } else if (visibleCards >= totalCards) {
        autoProjectsStatus.textContent = `Exibindo todos os ${totalCards} repositórios complementares disponíveis.`;
      } else {
        autoProjectsStatus.textContent = `Exibindo ${visibleCards} de ${totalCards} repositórios complementares.`;
      }
    }

    if (loadMoreAutoProjectsButton) {
      const remainingCards = totalCards - visibleCards;
      loadMoreAutoProjectsButton.hidden = remainingCards <= 0;
      if (remainingCards > 0) {
        const nextBatch = Math.min(AUTO_PROJECTS_BATCH_SIZE, remainingCards);
        loadMoreAutoProjectsButton.textContent = `Carregar mais ${nextBatch} repositórios`;
      }
    }

    updateAutoProjectsSummary();
  }

  async function fetchComplementaryRepositories() {
    const repositories = [];

    for (let page = 1; page <= 5; page += 1) {
      const response = await fetch(
        `https://api.github.com/users/brodyandre/repos?per_page=100&page=${page}&sort=updated`,
        {
          headers: {
            Accept: 'application/vnd.github+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API retornou status ${response.status}.`);
      }

      const pageRepositories = await response.json();
      if (!Array.isArray(pageRepositories) || pageRepositories.length === 0) {
        break;
      }

      repositories.push(...pageRepositories);

      if (pageRepositories.length < 100) {
        break;
      }
    }

    return repositories.filter((repo) => repo?.name && !curatedProjectNames.has(repo.name) && !repo.private);
  }

  async function ensureAutoProjectsLoaded() {
    if (autoProjectsLoading) {
      return;
    }

    const existingCards = getAutoProjectCards();
    if (existingCards.length > 0) {
      autoProjectsLoaded = true;
      if (autoProjectsVisibleCount === 0) {
        autoProjectsVisibleCount = Math.min(AUTO_PROJECTS_BATCH_SIZE, existingCards.length);
      }
      updateAutoProjectsVisibility();
      return;
    }

    if (autoProjectsLoaded || !autoProjectsList) {
      return;
    }

    autoProjectsLoading = true;
    if (autoProjectsStatus) {
      autoProjectsStatus.textContent = 'Carregando repositórios complementares do GitHub...';
    }

    try {
      const repositories = await fetchComplementaryRepositories();
      renderAutoProjectCards(repositories);
      autoProjectsLoaded = true;
      autoProjectsVisibleCount = Math.min(AUTO_PROJECTS_BATCH_SIZE, repositories.length);
      updateAutoProjectsVisibility();
    } catch (error) {
      if (autoProjectsStatus) {
        autoProjectsStatus.textContent = 'Não foi possível carregar a lista complementar agora. Se preferir, use o link ao lado para abrir todos os repositórios no GitHub.';
      }
      if (loadMoreAutoProjectsButton) {
        loadMoreAutoProjectsButton.hidden = true;
      }
    } finally {
      autoProjectsLoading = false;
      updateAutoProjectsSummary();
    }
  }

  projectFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      updateRadioGroupState(projectFilterButtons, button);
      filterProjects(button.dataset.language || 'all');
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        button.click();
      }
    });
  });

  filterProjects('all');

  if (toggleAutoProjectsButton && autoProjectsPanel) {
    updateAutoProjectsSummary();

    toggleAutoProjectsButton.addEventListener('click', async () => {
      const isExpanded = toggleAutoProjectsButton.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        autoProjectsPanel.hidden = true;
        toggleAutoProjectsButton.setAttribute('aria-expanded', 'false');
        updateAutoProjectsSummary();
        return;
      }

      autoProjectsPanel.hidden = false;
      toggleAutoProjectsButton.setAttribute('aria-expanded', 'true');
      updateAutoProjectsSummary();
      await ensureAutoProjectsLoaded();
    });
  }

  if (loadMoreAutoProjectsButton) {
    loadMoreAutoProjectsButton.addEventListener('click', () => {
      autoProjectsVisibleCount += AUTO_PROJECTS_BATCH_SIZE;
      updateAutoProjectsVisibility();
    });
  }

  const allCertificates = certificatesContainer
    ? Array.from(certificatesContainer.children)
    : [];

  function filterCertifications(year) {
    allCertificates.forEach((certificate) => {
      const shouldShow = year === 'all' || certificate.dataset.year === year;
      certificate.hidden = !shouldShow;
    });
  }

  certificationFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      updateRadioGroupState(certificationFilterButtons, button);
      filterCertifications(button.dataset.year || 'all');
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        button.click();
      }
    });
  });

  filterCertifications('all');

  function openModal(modal, onOpen) {
    if (!modal) {
      return;
    }

    modal.style.display = 'block';
    onOpen?.();
    modal.focus();
  }

  function closeModal(modal, onClose) {
    if (!modal) {
      return;
    }

    modal.style.display = 'none';
    onClose?.();
  }

  document.querySelectorAll('.fechar-modal').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      const iframe = modal?.querySelector('iframe');

      closeModal(modal, () => {
        if (iframe) {
          iframe.src = '';
        }
      });
    });
  });

  const certificateModal = document.getElementById('certificado-modal');
  const certificateImage = document.getElementById('imagem-certificado');

  document.querySelectorAll('.ver-credencial').forEach((button) => {
    button.addEventListener('click', () => {
      if (!certificateImage) {
        return;
      }

      certificateImage.src = button.dataset.imagem || '';
      certificateImage.alt = button.getAttribute('aria-label') || 'Certificado';
      openModal(certificateModal);
    });
  });

  const mapModal = document.getElementById('mapa-modal');
  const openMapButton = document.getElementById('abrir-mapa');
  const mapIframe = document.getElementById('iframe-mapa');

  if (openMapButton && mapIframe) {
    openMapButton.addEventListener('click', () => {
      openModal(mapModal, () => {
        mapIframe.src = 'https://maps.google.com/maps?width=600&height=450&hl=pt-BR&q=Zona%20Leste%20S%C3%A3o%20Paulo%20SP&ie=UTF8&t=&z=11&iwloc=B&output=embed';
      });
    });
  }

  const resumeModal = document.getElementById('curriculo-modal');
  const openResumeButton = document.getElementById('ver-curriculo');

  if (openResumeButton) {
    openResumeButton.addEventListener('click', () => openModal(resumeModal));
  }

  window.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.classList.contains('modal')) {
      const iframe = event.target.querySelector('iframe');

      closeModal(event.target, () => {
        if (iframe) {
          iframe.src = '';
        }
      });
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    document.querySelectorAll('.modal').forEach((modal) => {
      if (!(modal instanceof HTMLElement) || modal.style.display !== 'block') {
        return;
      }

      const iframe = modal.querySelector('iframe');
      closeModal(modal, () => {
        if (iframe) {
          iframe.src = '';
        }
      });
    });
  });

  if (backToTopButton) {
    window.addEventListener('scroll', () => {
      backToTopButton.style.display = window.pageYOffset > 300 ? 'block' : 'none';
    });

    backToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }

  const AVAILABLE_THEMES = ['light', 'neutral', 'dark'];
  const THEME_COLORS = {
    light: '#2c3e50',
    neutral: '#744125',
    dark: '#121211'
  };

  function normalizeTheme(theme) {
    return AVAILABLE_THEMES.includes(theme) ? theme : 'light';
  }

  function getStoredTheme() {
    try {
      const storedTheme = localStorage.getItem('portfolioTheme');
      if (AVAILABLE_THEMES.includes(storedTheme)) {
        return storedTheme;
      }

      if (localStorage.getItem('darkTheme') === 'true') {
        return 'dark';
      }
    } catch (error) {
      return 'light';
    }

    return 'light';
  }

  function updateThemeOptions(activeTheme) {
    themeOptionButtons.forEach((button) => {
      const isActive = button.dataset.themeValue === activeTheme;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-checked', String(isActive));
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  function applyTheme(theme, { persist = true } = {}) {
    const normalizedTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = normalizedTheme;
    document.body.classList.remove('dark-theme');

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', THEME_COLORS[normalizedTheme]);
    }

    updateThemeOptions(normalizedTheme);

    if (persist) {
      try {
        localStorage.setItem('portfolioTheme', normalizedTheme);
        localStorage.removeItem('darkTheme');
      } catch (error) {
        // Ignora falhas de storage para manter a troca visual funcionando.
      }
    }
  }

  if (themeOptionButtons.length > 0) {
    themeOptionButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        applyTheme(button.dataset.themeValue || 'light');
      });

      button.addEventListener('keydown', (event) => {
        const navigationKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
        if (!navigationKeys.includes(event.key)) {
          return;
        }

        event.preventDefault();

        let nextIndex = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIndex = (index + 1) % themeOptionButtons.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIndex = (index - 1 + themeOptionButtons.length) % themeOptionButtons.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = themeOptionButtons.length - 1;
        }

        const nextButton = themeOptionButtons[nextIndex];
        nextButton?.focus();
        applyTheme(nextButton?.dataset.themeValue || 'light');
      });
    });
  }

  applyTheme(getStoredTheme(), { persist: false });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId) {
        return;
      }

      const target = document.querySelector(targetId);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      target.focus();
    });
  });

  const contactForm = document.getElementById('form-contato');

  if (contactForm instanceof HTMLFormElement) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(contactForm);
      const name = String(formData.get('nome') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const message = String(formData.get('mensagem') || '').trim();
      const subject = encodeURIComponent(`Contato pelo portfólio - ${name || 'Novo contato'}`);
      const body = encodeURIComponent(
        `Nome: ${name}\nE-mail: ${email}\n\nMensagem:\n${message}`
      );

      window.location.href = `mailto:landresouza36@gmail.com?subject=${subject}&body=${body}`;
    });
  }
});
