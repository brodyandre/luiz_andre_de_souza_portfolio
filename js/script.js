// ========================
// FUNÇÕES AUXILIARES
// ========================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ========================
// PROJETOS GITHUB
// ========================
async function carregarProjetos() {
  const lista = $("#lista-projetos");
  lista.innerHTML = "<p>Carregando projetos...</p>";

  try {
    const response = await fetch("https://api.github.com/users/brodyandre/repos");
    if (!response.ok) throw new Error("Erro ao buscar repositórios");
    const repos = await response.json();

    lista.innerHTML = "";

    repos.forEach(repo => {
      const card = document.createElement("div");
      card.className = "projeto-card";
      card.dataset.language = (repo.language || "outros").toLowerCase();

      card.innerHTML = `
        <h3>${repo.name}</h3>
        <p>${repo.description || "Sem descrição"}</p>
        <a href="${repo.html_url}" target="_blank">Ver no GitHub</a>
      `;
      lista.appendChild(card);
    });
  } catch (error) {
    lista.innerHTML = "<p>Erro ao carregar projetos.</p>";
    console.error(error);
  }
}

function filtrarProjetos(language) {
  const cards = $$(".projeto-card");
  cards.forEach(card => {
    if (language === "all" || card.dataset.language === language) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

function initFiltroProjetos() {
  $$(".filtro button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".filtro button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtrarProjetos(btn.dataset.language);
    });
  });
}

// ========================
// CERTIFICADOS
// ========================
function filtrarCertificados(year) {
  $$(".certificado-item").forEach(item => {
    if (year === "all" || item.dataset.year === year) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

function initFiltroCertificados() {
  $$(".filtro-certificados button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".filtro-certificados button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtrarCertificados(btn.dataset.year);
    });
  });
}

function initCertificadoModal() {
  const modal = $("#certificadoModal");
  const img = $("#certificadoImg");
  const credencialLink = $("#credencialLink");
  const closeBtns = modal.querySelectorAll(".close, .close-btn");

  $$(".certificado-item").forEach(item => {
    item.addEventListener("click", () => {
      img.src = item.dataset.img;
      credencialLink.href = item.dataset.credencial;
      modal.style.display = "block";
    });
  });

  closeBtns.forEach(btn =>
    btn.addEventListener("click", () => {
      modal.style.display = "none";
    })
  );
}

// ========================
// CURRÍCULO (PDF)
// ========================
function initCurriculoModal() {
  const modal = $("#curriculoModal");
  const closeBtns = modal.querySelectorAll(".close, .close-btn");

  // Exemplo: abrir modal programaticamente
  // $("#abrirCurriculo").addEventListener("click", () => {
  //   modal.style.display = "block";
  // });

  closeBtns.forEach(btn =>
    btn.addEventListener("click", () => {
      modal.style.display = "none";
    })
  );
}

// ========================
// MAPA (GOOGLE MAPS)
// ========================
function initMapModal() {
  const modal = $("#mapModal");
  const iframe = $("#googleMap");
  const closeBtns = modal.querySelectorAll(".close, .close-btn");

  // Exemplo: abrir modal programaticamente
  // $("#abrirMapa").addEventListener("click", () => {
  //   iframe.src = "https://www.google.com/maps/embed?...";
  //   modal.style.display = "block";
  // });

  closeBtns.forEach(btn =>
    btn.addEventListener("click", () => {
      modal.style.display = "none";
      iframe.src = "";
    })
  );
}

// ========================
// TEMA ESCURO/CLARO
// ========================
function initTema() {
  const btn = $("#themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    body.classList.toggle("dark");
    btn.textContent = body.classList.contains("dark") ? "☀" : "🌙";
  });
}

// ========================
// FORMULÁRIO DE CONTATO
// ========================
function initContatoForm() {
  const form = $("#contatoForm");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Mensagem enviada com sucesso!");
    form.reset();
  });
}

// ========================
// BOTÃO VOLTAR AO TOPO
// ========================
function initBackToTop() {
  const btn = $("#backToTop");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      btn.style.display = "block";
    } else {
      btn.style.display = "none";
    }
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ========================
// INICIALIZAÇÃO
// ========================
document.addEventListener("DOMContentLoaded", () => {
  carregarProjetos();
  initFiltroProjetos();
  initFiltroCertificados();
  initCertificadoModal();
  initCurriculoModal();
  initMapModal();
  initTema();
  initContatoForm();
  initBackToTop();
});
