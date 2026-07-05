document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mainContent = document.getElementById('main-content');
  const projectFilterButtons = Array.from(document.querySelectorAll('.filtro button'));
  const projectCards = document.querySelectorAll('#lista-projetos .projeto-card');
  const certificationFilterButtons = Array.from(document.querySelectorAll('.filtro-certificacoes button'));
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
  const certificateButtons = Array.from(document.querySelectorAll('.ver-credencial'));
  const modalOpeners = new WeakMap();
  const curatedProjectNames = new Set(
    Array.from(projectCards)
      .map((card) => card.querySelector('h3')?.textContent?.trim())
      .filter(Boolean)
  );
  let activeModal = null;

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
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  function setupRadioGroup(buttons, options) {
    const { getValue, onChange, controlsId } = options;

    if (buttons.length === 0) {
      return;
    }

    if (controlsId) {
      buttons.forEach((button) => {
        button.setAttribute('aria-controls', controlsId);
      });
    }

    const activateButton = (button, { moveFocus = false } = {}) => {
      updateRadioGroupState(buttons, button);
      if (moveFocus) {
        button.focus();
      }
      onChange(getValue(button));
    };

    const initialButton = buttons.find((button) => (
      button.classList.contains('active') || button.getAttribute('aria-checked') === 'true'
    )) || buttons[0];

    updateRadioGroupState(buttons, initialButton);

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        activateButton(button);
      });

      button.addEventListener('keydown', (event) => {
        const navigationKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          activateButton(button, { moveFocus: true });
          return;
        }

        if (!navigationKeys.includes(event.key)) {
          return;
        }

        event.preventDefault();

        let nextIndex = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIndex = (index + 1) % buttons.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIndex = (index - 1 + buttons.length) % buttons.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = buttons.length - 1;
        }

        activateButton(buttons[nextIndex], { moveFocus: true });
      });
    });

    onChange(getValue(initialButton));
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
  const AUTO_PROJECT_DESCRIPTION_OVERRIDES = {
    'dataops-github-actions-lab': 'Laboratório de DataOps com GitHub Actions, automação de pipelines, validações e práticas de CI/CD.',
    'github-actions-self-hosted-runner-lab': 'Repositório público com estudos e testes práticos sobre self-hosted runners no GitHub Actions.',
    'kubernetes-security-hardening-lab': 'Repositório público com estudos e testes práticos sobre hardening e segurança em workloads Kubernetes.',
    'kubernetes-update-strategies-lab': 'Repositório público com estudos e testes práticos sobre estratégias de atualização e rollout no Kubernetes.',
    'kubernetes-resilience-ha-lab': 'Repositório público com estudos e testes práticos de resiliência e alta disponibilidade em Kubernetes.',
    'marketing-data-engineering-pipeline-lab': 'Repositório público com estudos e testes práticos de pipeline de Engenharia de Dados aplicado a dados de marketing.',
    'product-reviews-cicd-pipeline-lab': 'Repositório público com estudos e testes práticos de CI/CD aplicados a um fluxo de avaliações de produtos.',
    'churninsight-nocountry': 'MVP de previsão de churn para hackathon, combinando análise de dados e uma API para disponibilização do modelo.',
    'growth_equestre_hackathon_2026': 'MVP de hackathon para captação e qualificação de leads, com backend, scoring e orquestração local via Docker Compose.',
    'kubernetes-storage-volumes-lab': 'Laboratório de Kubernetes focado em volumes, persistência, StorageClass, ConfigMap, Secret e gestão de recursos.',
  };
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

  function getAutoProjectNames() {
    return new Set(
      getAutoProjectCards()
        .map((card) => card.querySelector('h3')?.textContent?.trim())
        .filter(Boolean)
    );
  }

  const INITIAL_AUTO_PROJECTS_COUNT = getAutoProjectCards().length;

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

  function renderAutoProjectCards(repositories, options = {}) {
    const { append = false } = options;

    if (!autoProjectsList) {
      return;
    }

    if (repositories.length === 0) {
      if (!append && getAutoProjectCards().length === 0) {
        autoProjectsList.innerHTML = '<p class="github-auto-projects-placeholder">Nenhum repositório complementar elegível foi encontrado no momento.</p>';
      }
      return;
    }

    const cardsHtml = repositories.map((repo) => {
      const description = normalizeRepositoryDescription(repo.description, repo.name);
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

    if (append && getAutoProjectCards().length > 0) {
      autoProjectsList.insertAdjacentHTML('beforeend', cardsHtml);
      return;
    }

    autoProjectsList.innerHTML = cardsHtml;
  }

  function normalizeRepositoryDescription(description, repoName = '') {
    const fallback = 'Repositório público com estudos, testes e implementações práticas.';
    if (AUTO_PROJECT_DESCRIPTION_OVERRIDES[repoName]) {
      return AUTO_PROJECT_DESCRIPTION_OVERRIDES[repoName];
    }

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
      .replace(/\bdata lake\b/gi, 'Data Lake')
      .replace(/\bmachine learning\b/gi, 'Machine Learning')
      .replace(/\bjava script\b/gi, 'JavaScript')
      .replace(/\bci\s+cd\b/gi, 'CI/CD')
      .replace(/\bdockerhub\b/gi, 'Docker Hub')
      .replace(/\bgit hub\b/gi, 'GitHub')
      .replace(/\blinkedin\b/gi, 'LinkedIn')
      .replace(/\bapp\b/gi, 'aplicação')
      .replace(/\bpyhton\b/gi, 'Python')
      .replace(/\bpython\b/gi, 'Python')
      .replace(/\bmercedes bens\b/gi, 'Mercedes-Benz')
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
    const usingInitialSelectionOnly = !autoProjectsLoaded
      && totalCards > 0
      && totalCards === INITIAL_AUTO_PROJECTS_COUNT;

    if (autoProjectsTotal) {
      if (totalCards === 0) {
        autoProjectsTotal.textContent = 'Seleção complementar';
      } else if (usingInitialSelectionOnly) {
        autoProjectsTotal.textContent = `${totalCards} repositórios na seleção inicial`;
      } else {
        autoProjectsTotal.textContent = `${totalCards} repositórios complementares`;
      }
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
    const usingInitialSelectionOnly = !autoProjectsLoaded
      && totalCards > 0
      && totalCards === INITIAL_AUTO_PROJECTS_COUNT;

    autoProjectCards.forEach((card, index) => {
      card.hidden = index >= visibleCards;
    });

    if (autoProjectsStatus) {
      if (totalCards === 0) {
        autoProjectsStatus.textContent = 'Nenhum repositório complementar está disponível nesta lista no momento.';
      } else if (usingInitialSelectionOnly) {
        autoProjectsStatus.textContent = `Exibindo ${visibleCards} repositórios da seleção complementar inicial.`;
      } else if (visibleCards >= totalCards) {
        autoProjectsStatus.textContent = `Exibindo todos os ${totalCards} repositórios complementares disponíveis.`;
      } else {
        autoProjectsStatus.textContent = `Exibindo ${visibleCards} de ${totalCards} repositórios complementares.`;
      }
    }

    if (loadMoreAutoProjectsButton) {
      const remainingCards = totalCards - visibleCards;
      const canLoadMoreOnDemand = !autoProjectsLoaded && totalCards > 0;

      loadMoreAutoProjectsButton.hidden = remainingCards <= 0 && !canLoadMoreOnDemand;

      if (remainingCards > 0) {
        const nextBatch = Math.min(AUTO_PROJECTS_BATCH_SIZE, remainingCards);
        loadMoreAutoProjectsButton.textContent = `Carregar mais ${nextBatch} repositórios`;
      } else if (canLoadMoreOnDemand) {
        loadMoreAutoProjectsButton.textContent = 'Carregar mais repositórios';
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

  async function loadAdditionalAutoProjects() {
    if (autoProjectsLoading) {
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
      const existingNames = getAutoProjectNames();
      const additionalRepositories = repositories.filter((repo) => !existingNames.has(repo.name));

      renderAutoProjectCards(additionalRepositories, { append: existingNames.size > 0 });
      autoProjectsLoaded = true;

      if (additionalRepositories.length === 0 && autoProjectsStatus) {
        autoProjectsStatus.textContent = 'A seleção complementar atual já cobre os repositórios mais relevantes desta lista.';
      }

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

  async function ensureAutoProjectsLoaded() {
    const existingCards = getAutoProjectCards();
    if (existingCards.length > 0) {
      if (autoProjectsVisibleCount === 0) {
        autoProjectsVisibleCount = Math.min(existingCards.length, AUTO_PROJECTS_BATCH_SIZE);
      }
      updateAutoProjectsVisibility();
      return;
    }

    await loadAdditionalAutoProjects();

    if (autoProjectsVisibleCount === 0) {
      autoProjectsVisibleCount = Math.min(AUTO_PROJECTS_BATCH_SIZE, getAutoProjectCards().length);
    }

    updateAutoProjectsVisibility();
  }

  setupRadioGroup(projectFilterButtons, {
    getValue: (button) => button.dataset.language || 'all',
    onChange: filterProjects,
    controlsId: 'lista-projetos'
  });

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
    loadMoreAutoProjectsButton.addEventListener('click', async () => {
      if (!autoProjectsLoaded) {
        await loadAdditionalAutoProjects();
      }

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

  setupRadioGroup(certificationFilterButtons, {
    getValue: (button) => button.dataset.year || 'all',
    onChange: filterCertifications,
    controlsId: 'certificados-lista'
  });

  function setModalVisibility(modal, isOpen) {
    modal.hidden = !isOpen;
    modal.classList.toggle('is-open', isOpen);
    modal.setAttribute('aria-hidden', String(!isOpen));
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return !element.hidden && element.getAttribute('aria-hidden') !== 'true';
    });
  }

  function trapFocusInModal(event, modal) {
    const focusableElements = getFocusableElements(modal);

    if (focusableElements.length === 0) {
      event.preventDefault();
      modal.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (!modal.contains(activeElement)) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function closeModal(modal, options = {}) {
    const { onClose, restoreFocus = true } = options;

    if (!(modal instanceof HTMLElement)) {
      return;
    }

    setModalVisibility(modal, false);
    onClose?.();

    if (activeModal === modal) {
      activeModal = null;
      document.body.style.overflow = '';
    }

    if (!restoreFocus) {
      return;
    }

    const opener = modalOpeners.get(modal);
    if (opener instanceof HTMLElement && document.contains(opener)) {
      opener.focus();
    }
  }

  function closeModalWithCleanup(modal, options = {}) {
    closeModal(modal, {
      ...options,
      onClose: () => {
        const iframe = modal?.querySelector('iframe');
        if (iframe) {
          iframe.src = '';
        }
        options.onClose?.();
      }
    });
  }

  function openModal(modal, opener, onOpen) {
    if (!(modal instanceof HTMLElement)) {
      return;
    }

    if (activeModal && activeModal !== modal) {
      closeModalWithCleanup(activeModal, { restoreFocus: false });
    }

    const openerElement = opener instanceof HTMLElement
      ? opener
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (openerElement) {
      modalOpeners.set(modal, openerElement);
    }

    setModalVisibility(modal, true);
    activeModal = modal;
    document.body.style.overflow = 'hidden';
    onOpen?.();

    const closeButton = modal.querySelector('.fechar-modal');
    const initialFocusTarget = closeButton instanceof HTMLElement ? closeButton : modal;
    window.requestAnimationFrame(() => {
      initialFocusTarget.focus();
    });
  }

  document.querySelectorAll('.fechar-modal').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      closeModalWithCleanup(modal);
    });
  });

  const certificateModal = document.getElementById('certificado-modal');
  const certificateImage = document.getElementById('imagem-certificado');

  function getCertificateImageAlt(button) {
    const ariaLabel = button.getAttribute('aria-label') || '';
    const normalizedLabel = ariaLabel
      .replace(/^Ver credencial do certificado\s+/i, 'Certificado ')
      .replace(/^Ver credencial\s+/i, 'Certificado ')
      .trim();

    return normalizedLabel || 'Certificado';
  }

  certificateButtons.forEach((button) => {
    button.setAttribute('type', 'button');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'certificado-modal');

    button.addEventListener('click', () => {
      if (!certificateImage) {
        return;
      }

      certificateImage.src = button.dataset.imagem || '';
      certificateImage.alt = getCertificateImageAlt(button);
      openModal(certificateModal, button);
    });
  });

  const mapModal = document.getElementById('mapa-modal');
  const openMapButton = document.getElementById('abrir-mapa');
  const mapIframe = document.getElementById('iframe-mapa');

  if (openMapButton && mapIframe) {
    openMapButton.addEventListener('click', () => {
      openModal(mapModal, openMapButton, () => {
        mapIframe.src = 'https://maps.google.com/maps?width=600&height=450&hl=pt-BR&q=Zona%20Leste%20S%C3%A3o%20Paulo%20SP&ie=UTF8&t=&z=11&iwloc=B&output=embed';
      });
    });
  }

  const resumeModal = document.getElementById('curriculo-modal');
  const openResumeButton = document.getElementById('ver-curriculo');

  if (openResumeButton) {
    openResumeButton.setAttribute('aria-haspopup', 'dialog');
    openResumeButton.setAttribute('aria-controls', 'curriculo-modal');
    openResumeButton.addEventListener('click', () => openModal(resumeModal, openResumeButton));
  }

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModalWithCleanup(modal);
      }
    });
  });

  window.addEventListener('keydown', (event) => {
    if (!(activeModal instanceof HTMLElement) || activeModal.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModalWithCleanup(activeModal);
      return;
    }

    if (event.key === 'Tab') {
      trapFocusInModal(event, activeModal);
    }
  });

  if (backToTopButton) {
    const updateBackToTopVisibility = () => {
      const shouldShow = window.pageYOffset > 300;
      backToTopButton.hidden = !shouldShow;
      backToTopButton.setAttribute('aria-hidden', String(!shouldShow));
    };

    updateBackToTopVisibility();

    window.addEventListener('scroll', () => {
      updateBackToTopVisibility();
    });

    backToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });

      window.setTimeout(() => {
        mainContent?.focus({ preventScroll: true });
      }, prefersReducedMotion ? 0 : 400);
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
