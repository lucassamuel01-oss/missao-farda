const materiasPorConcurso = {
  "SD PMBA": [
    "Língua Portuguesa",
    "Matemática",
    "Atualidades",
    "Informática",
    "História do Brasil",
    "Geografia do Brasil",
    "Direito Constitucional",
    "Direitos Humanos",
    "Direito Administrativo",
    "Direito Penal",
    "Direito Penal Militar",
    "Igualdade Racial e de Gênero"
  ],
  "CFO PMBA": [
    "Língua Portuguesa",
    "Direito",
    "Ciências Humanas",
    "Matemática/RLM",
    "Informática",
    "Língua Inglesa"
  ],
  "SD PMMG": [
    "Língua Portuguesa",
    "Literatura",
    "Língua Inglesa",
    "Noções de Direito e Direitos Humanos",
    "Raciocínio Lógico-Matemático"
  ]
};

const form = document.getElementById("studyForm");
const concurso = document.getElementById("concurso");
const difBox = document.getElementById("dificuldadesBox");
const facBox = document.getElementById("facilidadesBox");
const dataProva = document.getElementById("dataProva");
const horasDia = document.getElementById("horasDia");
const diasSemana = document.getElementById("diasSemana");
const daysLeft = document.getElementById("daysLeft");
const weeklyLoad = document.getElementById("weeklyLoad");
const mode = document.getElementById("mode");
const dailyModel = document.getElementById("dailyModel");
const formStatus = document.getElementById("formStatus");
const planResult = document.getElementById("planResult");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

const telefone =
  document.getElementById("telefone") ||
  document.getElementById("whatsapp");

const switchButtons = document.querySelectorAll(".switch-row button");

function criarChecks(container, name, lista) {
  if (!container) return;

  container.innerHTML = lista
    .map(
      (materia, index) => `
        <label class="choice" for="${name}-${index}">
          <input type="checkbox" id="${name}-${index}" name="${name}" value="${materia}">
          <span>${materia}</span>
        </label>
      `
    )
    .join("");
}

function preencherMaterias() {
  const lista = materiasPorConcurso[concurso?.value] || [];
  criarChecks(difBox, "dificuldades", lista);
  criarChecks(facBox, "facilidades", lista);

  switchButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.concurso === concurso?.value);
  });
}

function formatarTelefone(valor) {
  const numeros = String(valor).replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 2) return numeros;

  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

function atualizarPreview() {
  const h = Number(horasDia?.value || 0);
  const d = Number(diasSemana?.value || 0);

  weeklyLoad.textContent = h && d ? `${h * d}h` : "--";

  if (dataProva?.value) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const prova = new Date(`${dataProva.value}T00:00:00`);
    const diffMs = prova - hoje;
    const diffDias = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    daysLeft.textContent = diffDias;

    if (diffDias <= 15) {
      mode.textContent = "Sprint final";
    } else if (diffDias <= 30) {
      mode.textContent = "Reta final";
    } else if (diffDias <= 90) {
      mode.textContent = "Intensivo";
    } else {
      mode.textContent = "Base";
    }
  } else {
    daysLeft.textContent = "--";
    mode.textContent = "Missão";
  }

  if (h && d) {
    dailyModel.textContent = `Treino com ${h}h por dia, ${d} dias por semana, total de ${h * d}h semanais.`;
  } else {
    dailyModel.textContent = "Informe seus dados para ver a estratégia de estudo.";
  }
}

function setStatus(message, type = "info") {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.dataset.type = type;
}

function getSelectedValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(
    (checkbox) => checkbox.value
  );
}

function atualizarResumoLocal() {
  const dificuldades = getSelectedValues(difBox);
  const facilidades = getSelectedValues(facBox);

  if (planResult) {
    const difText = dificuldades.length
      ? dificuldades.join(", ")
      : "nenhuma selecionada";

    const facText = facilidades.length
      ? facilidades.join(", ")
      : "nenhuma selecionada";

    planResult.innerHTML = `
      <article class="generated-plan">
        <div class="generated-plan-header">
          <p class="eyebrow">Prévia do plano</p>
          <h3>Estratégia em andamento</h3>
        </div>

        <div class="generated-plan-body">
          <p><strong>Dificuldades:</strong> ${difText}</p>
          <p><strong>Facilidades:</strong> ${facText}</p>
        </div>

        <div class="generated-plan-body">
          <p>A página do plano completo será aberta após o envio do formulário.</p>
        </div>
      </article>
    `;
  }
}

function salvarLeadSemBloquear(formElement) {
  const payload = {
    nome: formElement.nome?.value || "",
    email: formElement.email?.value || "",
    telefone: formElement.telefone?.value || formElement.whatsapp?.value || ""
  };

  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json" });

  try {
    if (navigator.sendBeacon) {
      return navigator.sendBeacon("/salvar-lead", blob);
    }
  } catch (error) {
    console.error("sendBeacon falhou:", error);
  }

  fetch("/salvar-lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: json,
    keepalive: true
  }).catch((error) => {
    console.error("Falha ao salvar lead:", error);
  });

  return false;
}

async function carregarUsuarioAtual() {
  try {
    const res = await fetch("/me", { headers: { Accept: "application/json" } });
    if (!res.ok) return;

    const user = await res.json();
    if (adminLink && user.role === "admin") {
      adminLink.hidden = false;
    }
  } catch (error) {
    console.error("Falha ao carregar usuário:", error);
  }
}

async function sair() {
  try {
    await fetch("/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
  }
}

switchButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    concurso.value = btn.dataset.concurso;
    preencherMaterias();
    atualizarPreview();
    atualizarResumoLocal();
  });
});

if (concurso) {
  concurso.addEventListener("change", () => {
    preencherMaterias();
    atualizarPreview();
    atualizarResumoLocal();
  });
}

[dataProva, horasDia, diasSemana].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", atualizarPreview);
  el.addEventListener("change", atualizarPreview);
});

if (telefone) {
  telefone.addEventListener("input", (e) => {
    e.target.value = formatarTelefone(e.target.value);
  });
}

if (difBox) {
  difBox.addEventListener("change", atualizarResumoLocal);
}

if (facBox) {
  facBox.addEventListener("change", atualizarResumoLocal);
}

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    setStatus("Gerando seu plano...", "loading");

    const salvou = salvarLeadSemBloquear(form);

    if (salvou) {
      setStatus("Dados enviados com sucesso!", "success");
    } else {
      setStatus("Plano será gerado agora.", "warning");
    }

    setTimeout(() => {
      if (typeof form.submit === "function") {
        form.submit();
      }
    }, 50);
  });
}

preencherMaterias();
atualizarPreview();
atualizarResumoLocal();
carregarUsuarioAtual();

if (logoutBtn) {
  logoutBtn.addEventListener("click", sair);
}
