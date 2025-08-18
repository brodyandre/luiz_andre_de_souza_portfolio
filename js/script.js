document.addEventListener('DOMContentLoaded', function() {
  const filtroBtns = document.querySelectorAll('.filtro button');
  const listaProjetos = document.getElementById('lista-projetos');

  function repoMatchesFilter(card, filterLanguage) {
    if (filterLanguage === 'all') return true;
    const tags = [...card.querySelectorAll('.linguagem-tag')].map(t => t.textContent.toLowerCase());
    return tags.includes(filterLanguage);
  }

  function aplicarFiltro(filter = 'all') {
    const cards = listaProjetos.querySelectorAll('.projeto-card');
    cards.forEach(card => {
      card.style.display = repoMatchesFilter(card, filter) ? "block" : "none";
    });
  }

  // Configura os botões do filtro
  filtroBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      filtroBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-checked', 'true');
      aplicarFiltro(this.dataset.language);
    });
  });

  // Aplica filtro inicial (mostrar todos os projetos)
  aplicarFiltro('all');

  // --- Acessibilidade: voltar ao topo ---
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- Alternar tema claro/escuro ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      themeToggle.setAttribute('aria-pressed', isDark);
    });
  }

  // --- Botão "Ver Currículo" ---
  const verCurriculoBtn = document.getElementById('ver-curriculo');
  if (verCurriculoBtn) {
    verCurriculoBtn.addEventListener('click', () => {
      window.open("assets/curriculo.pdf", "_blank");
    });
  }
});
