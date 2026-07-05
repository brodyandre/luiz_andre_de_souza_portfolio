document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const projectFilterButtons = document.querySelectorAll('.filtro button');
  const projectCards = document.querySelectorAll('.projeto-card');
  const certificationFilterButtons = document.querySelectorAll('.filtro-certificacoes button');
  const certificatesContainer = document.getElementById('certificados-lista');
  const backToTopButton = document.getElementById('back-to-top');
  const themeToggle = document.getElementById('theme-toggle');
  const currentYear = document.getElementById('current-year');

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

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('darkTheme', String(isDark));
      themeToggle.textContent = isDark ? '🌞' : '🌓';
      themeToggle.setAttribute('aria-pressed', String(isDark));
    });

    if (localStorage.getItem('darkTheme') === 'true') {
      document.body.classList.add('dark-theme');
      themeToggle.textContent = '🌞';
      themeToggle.setAttribute('aria-pressed', 'true');
    }
  }

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
