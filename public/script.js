
const materiasPorConcurso = {
  "SD PMBA": ["Língua Portuguesa","Matemática","Atualidades","Informática","História do Brasil","Geografia do Brasil","Direito Constitucional","Direitos Humanos","Direito Administrativo","Direito Penal","Direito Penal Militar","Igualdade Racial e de Gênero"],
  "CFO PMBA": ["Língua Portuguesa","Direito","Ciências Humanas","Matemática/RLM","Informática","Língua Inglesa"]
};

const concurso = document.getElementById("concurso");
const difBox = document.getElementById("dificuldadesBox");
const facBox = document.getElementById("facilidadesBox");
const dataProva = document.getElementById("dataProva");
const horasDia = document.getElementById("horasDia");
const diasSemana = document.getElementById("diasSemana");
const daysLeft = document.getElementById("daysLeft");
const weeklyLoad = document.getElementById("weeklyLoad");
const mode = document.getElementById("mode");
const whatsapp = document.getElementById("whatsapp");
const dailyModel = document.getElementById("dailyModel");

function criarChecks(container, name, lista) {
  container.innerHTML = lista.map(materia => `
    <label class="choice">
      <input type="checkbox" name="${name}" value="${materia}">
      <span>${materia}</span>
    </label>
  `).join("");
}

function preencherMaterias() {
  const lista = materiasPorConcurso[concurso.value] || [];
  criarChecks(difBox, "dificuldades", lista);
  criarChecks(facBox, "facilidades", lista);
  document.querySelectorAll(".switch-row button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.concurso === concurso.value);
  });
}

function atualizarPreview() {
  const h = Number(horasDia.value || 0);
  const d = Number(diasSemana.value || 0);
  weeklyLoad.textContent = h && d ? `${h * d}h` : "--";
  if (dataProva.value) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const prova = new Date(dataProva.value + "T00:00:00");
    const diff = Math.max(1, Math.ceil((prova - hoje) / (1000*60*60*24)));
    daysLeft.textContent = diff;
    mode.textContent = diff <= 30 ? "Reta final" : diff <= 90 ? "90 dias" : "Base";
  } else {
    daysLeft.textContent = "--";
    mode.textContent = "Missão";
  }
}

function mascaraWhatsApp(value) {
  return value.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2").slice(0, 15);
}

document.querySelectorAll(".switch-row button").forEach(btn => {
  btn.addEventListener("click", () => {
    concurso.value = btn.dataset.concurso;
    preencherMaterias();
    atualizarPreview();
  });
});

[concurso, dataProva, horasDia, diasSemana].forEach(el => {
  el.addEventListener("input", () => {
    if (el === concurso) preencherMaterias();
    atualizarPreview();
  });
});

whatsapp.addEventListener("input", e => e.target.value = mascaraWhatsApp(e.target.value));

preencherMaterias();
atualizarPreview();
