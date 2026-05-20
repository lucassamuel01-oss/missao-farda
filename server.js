const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const COURSE_URL = process.env.COURSE_URL || "https://web.concurseiroelitelp.com.br/cursos-do-elite-parceiros-cris-andrade/";

app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

app.post('/salvar-lead', (req, res) => {

  const novoLead = req.body;

  let leads = [];

  if (fs.existsSync('leads.json')) {

    leads = JSON.parse(
      fs.readFileSync('leads.json')
    );

  }

  leads.push(novoLead);

  fs.writeFileSync(
    'leads.json',
    JSON.stringify(leads, null, 2)
  );

  res.json({
    success: true,
    message: 'Dados enviados com sucesso!'
  });

});

const EDITAIS = {
  "SD PMBA": {
    nome: "SD PMBA",
    subtitulo: "Soldado da Polícia Militar da Bahia",
    tipo: "Prova Objetiva + Prova Discursiva/Redação",
    duracao: "4h30",
    questoes: 80,
    notaAlerta: "Foco em Conhecimentos Gerais e Conhecimentos Específicos.",
    estrategia: "Para SD PMBA, o sistema equilibra base geral com bloco jurídico específico, evitando semana com matéria única.",
    prova: [
      "80 questões objetivas",
      "Conhecimentos Gerais: 50 questões",
      "Conhecimentos Específicos: 30 questões",
      "Prova discursiva/redação aplicada no mesmo dia",
      "Fases posteriores: avaliação física, psicológica, médica, investigação social e documentação"
    ],
    dicas: [
      "Português, Matemática e Atualidades precisam aparecer com frequência alta, pois fortalecem a base da prova.",
      "O bloco jurídico específico deve entrar desde o início: Constitucional, Administrativo, Penal, Penal Militar, Direitos Humanos e Igualdade Racial/Gênero.",
      "Faça questões desde a primeira semana. Não espere terminar teoria para treinar banca.",
      "Separe ao menos 2 dias por semana para condicionamento físico, mesmo que por 20 a 30 minutos."
    ],
    pesos: {
      "Língua Portuguesa": 14,
      "Matemática": 10,
      "Atualidades": 8,
      "Informática": 6,
      "História do Brasil": 6,
      "Geografia do Brasil": 6,
      "Direito Constitucional": 6,
      "Direitos Humanos": 5,
      "Direito Administrativo": 5,
      "Direito Penal": 5,
      "Direito Penal Militar": 5,
      "Igualdade Racial e de Gênero": 4
    },
    materias: {
      "Língua Portuguesa": ["Compreensão e interpretação de textos","Tipologia textual","Ortografia oficial","Acentuação gráfica","Classes de palavras","Sintaxe da oração e do período","Pontuação","Concordância verbal e nominal","Regência verbal e nominal","Crase","Semântica","Redação oficial"],
      "Matemática": ["Conjuntos numéricos","Operações fundamentais","Razão e proporção","Porcentagem","Regra de três","Equações","Funções","Geometria básica","Estatística","Probabilidade","Resolução de problemas"],
      "Atualidades": ["Política nacional","Economia","Segurança pública","Meio ambiente","Tecnologia","Relações internacionais","Temas sociais contemporâneos"],
      "Informática": ["Conceitos básicos de informática","Windows, Linux e sistemas operacionais","Editores de texto","Planilhas eletrônicas","Internet e intranet","Correio eletrônico","Computação em nuvem","Segurança da informação"],
      "História do Brasil": ["Brasil Colônia","Brasil Império","Primeira República","Era Vargas","Ditadura Militar","Redemocratização","História da Bahia"],
      "Geografia do Brasil": ["Formação territorial","Regionalização do Brasil","Aspectos físicos","População brasileira","Urbanização","Economia brasileira","Geografia da Bahia"],
      "Direito Constitucional": ["Constituição Federal","Direitos e garantias fundamentais","Organização do Estado","Administração Pública","Segurança pública"],
      "Direitos Humanos": ["Declaração Universal dos Direitos Humanos","Direitos fundamentais","Tratados internacionais","Cidadania","Proteção contra discriminação"],
      "Direito Administrativo": ["Princípios da Administração Pública","Atos administrativos","Poderes administrativos","Agentes públicos","Responsabilidade civil do Estado"],
      "Direito Penal": ["Aplicação da lei penal","Crime","Imputabilidade penal","Concurso de pessoas","Penas","Crimes contra a pessoa","Crimes contra o patrimônio","Crimes contra a Administração Pública","Lei de Drogas"],
      "Direito Penal Militar": ["Código Penal Militar","Crimes militares em tempo de paz","Crimes contra autoridade ou disciplina militar","Crimes contra o serviço militar","Crimes contra a Administração Militar"],
      "Igualdade Racial e de Gênero": ["Estatuto da Igualdade Racial","Políticas afirmativas","Lei Maria da Penha","Violência contra a mulher","Discriminação racial e de gênero"]
    }
  },
  "CFO PMBA": {
    nome: "CFO PMBA",
    subtitulo: "Curso de Formação de Oficiais da Polícia Militar da Bahia",
    tipo: "Prova Objetiva + Redação + 2ª Etapa",
    duracao: "5h",
    questoes: 80,
    notaAlerta: "Nota objetiva inferior a 60 ou zero em disciplina pode eliminar.",
    estrategia: "Português, Direito e Ciências Humanas formam o núcleo do CFO, mas o plano mantém rodízio para não zerar disciplina.",
    prova: [
      "80 questões objetivas",
      "Língua Portuguesa: 20 questões",
      "Direito: 20 questões",
      "Ciências Humanas: 20 questões",
      "Matemática: 10 questões",
      "Informática: 5 questões",
      "Língua Inglesa: 5 questões",
      "Redação de 20 a 30 linhas",
      "2ª etapa: avaliação psicológica, física, médica/odontológica, investigação social e documental"
    ],
    dicas: [
      "Português, Direito e Ciências Humanas somam a maior parte da prova: mantenha alta frequência nelas.",
      "Não abandone Inglês e Informática. Mesmo com menor peso, zerar disciplina é risco estratégico.",
      "Treine redação semanalmente: estrutura, clareza, coesão, concisão e domínio do tema.",
      "Inclua TAF na rotina: aprovação intelectual não substitui preparação física."
    ],
    pesos: {
      "Língua Portuguesa": 20,
      "Direito": 20,
      "Ciências Humanas": 20,
      "Matemática/RLM": 10,
      "Informática": 5,
      "Língua Inglesa": 5
    },
    materias: {
      "Língua Portuguesa": ["Leitura e interpretação de textos verbais, mistos e não verbais","Textos publicitários","Flexões nominais e verbais","Advérbios e circunstâncias","Preposições e conjunções","Frase, oração e período","Termos essenciais, integrantes e acessórios","Coordenação e subordinação","Concordância, regência e crase","Discurso direto, indireto e indireto livre","Semântica","Pontuação","Acentuação e ortografia","Redação oficial"],
      "Direito": ["Direito Constitucional","Direito Administrativo","Direitos Humanos","Direito Penal","Direito Processual Penal","Legislação penal especial","Direito Penal Militar","Direito Processual Penal Militar"],
      "Ciências Humanas": ["História: Antiguidade, Mundo Medieval, Mundo Moderno e Mundo Contemporâneo","Brasil Colônia","Brasil Império","Brasil República","História da Bahia","Independência da Bahia","Revolta de Canudos","Revolta dos Malês","Conjuração Baiana","Sabinada","Atualidades","Geografia: relação sociedade-natureza","Estruturação econômica, social e política do espaço mundial","Formação territorial do Brasil","Urbanização e metropolização"],
      "Matemática/RLM": ["Operações fundamentais","Razão e proporção","Porcentagem","Regra de três","Equações","Funções","Geometria","Proporcionalidade e finanças","Juros simples e compostos","Estatística","Gráficos","Sequências e resolução de problemas"],
      "Informática": ["Word, Writer, Excel, Calc, PowerPoint e Impress","Windows, Linux e organização de arquivos","Atalhos, ícones, área de trabalho e lixeira","Internet e intranet","Correio eletrônico","Computação em nuvem","Certificação e assinatura digital","Segurança da Informação","Componentes de computador"],
      "Língua Inglesa": ["Compreensão de textos verbais e não verbais","Substantivos","Plural regular e irregular","Gênero e contáveis/não contáveis","Artigos e demonstrativos","Adjetivos","Pronomes","Verbos regulares e irregulares","Voz ativa e passiva","Estratégias de leitura"]
    }
  }
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}
function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
function diasAte(dataProva) {
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const prova = new Date(dataProva + "T00:00:00");
  return Math.max(1, Math.ceil((prova - hoje) / (1000*60*60*24)));
}
function slug(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").toLowerCase();
}
function salvarLead(dados, plano) {
  try {
    const dir = path.join(__dirname, "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const arquivo = path.join(dir, "leads.csv");
    const header = "data,nome,email,whatsapp,concurso,dataProva,horasDia,diasSemana,trabalha,nivel,notaAlvo,diasRestantes,cargaSemanal\n";
    if (!fs.existsSync(arquivo)) fs.writeFileSync(arquivo, header, "utf8");
    const linha = [new Date().toISOString(), dados.nome, dados.email, dados.whatsapp, dados.concurso, dados.dataProva, dados.horasDia, dados.diasSemana, dados.trabalha, dados.nivel, dados.notaAlvo, plano.diasRestantes, plano.cargaSemanal]
      .map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",") + "\n";
    fs.appendFileSync(arquivo, linha, "utf8");
  } catch (err) {
    console.error("Erro ao salvar lead:", err.message);
  }
}


function perfilDoNivel(nivel = "") {
  const n = String(nivel).toLowerCase();
  if (n.includes("iniciante")) {
    return {
      nome: "Base guiada",
      dificuldadeExtra: 10,
      facilidadeReducao: 1,
      teoria: "teoria guiada + exemplos",
      questoes: "questões fundamentais",
      revisao: "revisão de base + caderno de erros",
      simulado: "mini-simulado leve"
    };
  }
  if (n.includes("avançado")) {
    return {
      nome: "Alta performance",
      dificuldadeExtra: 16,
      facilidadeReducao: 4,
      teoria: "revisão objetiva do ponto-chave",
      questoes: "questões cronometradas",
      revisao: "correção ativa + padrão de erro",
      simulado: "simulado com tempo controlado"
    };
  }
  return {
    nome: "Evolução equilibrada",
    dificuldadeExtra: 13,
    facilidadeReducao: 3,
    teoria: "teoria direcionada",
    questoes: "questões comentadas",
    revisao: "revisão/caderno de erros",
    simulado: "mini-simulado"
  };
}

function buildMateriaState(edital, dificuldades, facilidades, nivel) {
  const perfil = perfilDoNivel(nivel);
  const state = {};
  Object.entries(edital.materias).forEach(([materia, assuntos]) => {
    let score = edital.pesos[materia] || 5;
    const dificil = dificuldades.includes(materia);
    const facil = facilidades.includes(materia);

    if (dificil) score += perfil.dificuldadeExtra;
    if (facil) score -= perfil.facilidadeReducao;

    // Iniciantes precisam de mais estabilidade nas disciplinas-base.
    if (String(nivel).toLowerCase().includes("iniciante") && ["Língua Portuguesa", "Matemática", "Matemática/RLM"].includes(materia)) {
      score += 3;
    }

    state[materia] = {
      materia,
      assuntos: [...assuntos],
      cursor: 0,
      score: Math.max(2, score),
      total: assuntos.length,
      dificuldade: dificil,
      facilidade: facil,
      categoria: dificil ? "Prioridade de recuperação" : facil ? "Manutenção estratégica" : "Construção de desempenho"
    };
  });
  return state;
}

function escolherMateria(materias, state, ctx) {
  let melhor = null;
  let melhorScore = -Infinity;
  materias.forEach((materia, idx) => {
    const s = state[materia];
    let score = s.score;
    score -= (ctx.weekCounts[materia] || 0) * 3.2;
    score -= (ctx.globalCounts[materia] || 0) * 0.45;
    if (ctx.lastMateria === materia) score -= 80;
    if (ctx.daySet.has(materia) && ctx.daySet.size < Math.min(3, materias.length)) score -= 30;
    if ((ctx.weekCounts[materia] || 0) === 0) score += 7;
    score += ((ctx.seed + idx) % 5) * 0.08;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = materia;
    }
  });
  return melhor || materias[ctx.seed % materias.length];
}

function proximoAssunto(state, materia) {
  const item = state[materia];
  const assunto = item.assuntos[item.cursor % item.assuntos.length];
  item.cursor++;
  return assunto;
}



function limiteMateriasPorDia(horasDia) {
  if (horasDia <= 1) return 1;
  if (horasDia <= 3) return 2;
  return 3;
}

function selecionarMateriasDoDia(materias, state, ctx, limite) {
  const escolhidas = [];

  // Primeiro garante que dificuldades marcadas pelo aluno apareçam com prioridade real,
  // mas sem transformar o dia em excesso de disciplinas.
  const prioridades = materias.filter(m => state[m].dificuldade);
  for (const materia of prioridades) {
    if (escolhidas.length >= limite) break;
    const usoSemana = ctx.weekCounts[materia] || 0;
    const usoGlobal = ctx.globalCounts[materia] || 0;
    const mediaUso = usoSemana + usoGlobal * 0.18;
    const menorQueOutras = escolhidas.length === 0 || mediaUso <= 2.5;
    if (menorQueOutras && !escolhidas.includes(materia)) escolhidas.push(materia);
  }

  let guard = 0;
  while (escolhidas.length < limite && guard < materias.length * 4) {
    const materia = escolherMateria(materias, state, {
      ...ctx,
      daySet: new Set(escolhidas)
    });
    if (!escolhidas.includes(materia)) escolhidas.push(materia);
    else {
      const fallback = materias.find(m => !escolhidas.includes(m));
      if (fallback) escolhidas.push(fallback);
    }
    guard++;
  }

  return escolhidas;
}

function distribuirCiclos(ciclos, qtdMaterias, nivel) {
  if (qtdMaterias <= 1) return [ciclos];
  const avancado = String(nivel).toLowerCase().includes("avançado");
  const iniciante = String(nivel).toLowerCase().includes("iniciante");

  if (qtdMaterias === 2) {
    const primeira = Math.max(1, Math.ceil(ciclos * (avancado ? 0.55 : iniciante ? 0.65 : 0.6)));
    return [primeira, Math.max(1, ciclos - primeira)];
  }

  const primeira = Math.max(1, Math.ceil(ciclos * (iniciante ? 0.5 : 0.45)));
  const segunda = Math.max(1, Math.floor(ciclos * (avancado ? 0.35 : 0.33)));
  return [primeira, segunda, Math.max(1, ciclos - primeira - segunda)];
}

function tarefaPorNivel(perfil, etapa, retaFinal) {
  if (retaFinal && etapa >= 2) return perfil.simulado + " + correção";
  if (etapa === 1) return perfil.teoria;
  if (etapa === 2) return perfil.questoes;
  return perfil.revisao;
}

function gerarPomodorosDoDia({ horasDia, materias, state, weekCounts, globalCounts, seed, retaFinal, diaDaSemana, nivel }) {
  const perfil = perfilDoNivel(nivel);
  const minutosDisponiveis = horasDia * 60;
  let ciclos = Math.floor(minutosDisponiveis / 30);
  ciclos = Math.max(2, Math.min(ciclos, 10));

  const limite = Math.min(limiteMateriasPorDia(horasDia), materias.length);
  const materiasDoDia = selecionarMateriasDoDia(materias, state, { weekCounts, globalCounts, seed, lastMateria: null }, limite);
  const ciclosPorMateria = distribuirCiclos(ciclos, materiasDoDia.length, nivel);

  const blocos = [];
  let contador = 1;

  materiasDoDia.forEach((materia, idx) => {
    const qtd = ciclosPorMateria[idx] || 1;
    const assunto = proximoAssunto(state, materia);
    const categoria = state[materia].categoria;

    weekCounts[materia] = (weekCounts[materia] || 0) + qtd;
    globalCounts[materia] = (globalCounts[materia] || 0) + qtd;

    for (let i = 1; i <= qtd; i++) {
      const tarefa = tarefaPorNivel(perfil, i, retaFinal);

      blocos.push({
        tipo: "pomodoro",
        titulo: `Pomodoro ${contador}`,
        tempo: "25min foco + 5min pausa",
        materia,
        assunto,
        categoria,
        tarefa
      });

      if (contador % 4 === 0 && contador !== ciclos) {
        blocos.push({
          tipo: "pausa",
          titulo: "Pausa longa",
          tempo: "15min a 20min",
          materia: "",
          assunto: "Pausa para recuperar energia e manter foco no próximo ciclo.",
          categoria: "",
          tarefa: "recuperação"
        });
      }

      contador++;
    }
  });

  if (diaDaSemana === "Sábado" || diaDaSemana === "Domingo" || retaFinal) {
    blocos.push({
      tipo: "simulado",
      titulo: retaFinal ? "Fechamento tático" : "Revisão semanal",
      tempo: "30min a 60min",
      materia: "Treino integrado",
      assunto: retaFinal ? "Mini-simulado + correção dos erros" : "Revisão dos assuntos mais cobrados da semana",
      categoria: "Consolidação",
      tarefa: perfil.simulado
    });
  }

  return { blocos, materiasDoDia };
}

function gerarPlano(dados) {
  const edital = EDITAIS[dados.concurso] || EDITAIS["SD PMBA"];
  const diasRestantes = diasAte(dados.dataProva);
  const horasDia = Math.max(Number(dados.horasDia || 1), 1);
  const diasSemana = Math.max(Number(dados.diasSemana || 3), 1);
  const cargaSemanal = horasDia * diasSemana;
  const semanas = Math.max(1, Math.ceil(diasRestantes / 7));
  const dificuldades = normalizeArray(dados.dificuldades);
  const facilidades = normalizeArray(dados.facilidades);
  const state = buildMateriaState(edital, dificuldades, facilidades, dados.nivel);
  const materias = Object.keys(edital.pesos).sort((a,b) => state[b].score - state[a].score);
  const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const agenda = [];
  const globalCounts = {};
  for (let s = 1; s <= semanas; s++) {
    const retaFinal = diasRestantes <= 30 || s > Math.max(1, semanas - 2);
    const weekCounts = {};
    const dias = [];
    for (let d = 0; d < diasSemana; d++) {
      const diaNome = nomesDias[d] || `Dia ${d+1}`;
      const dia = gerarPomodorosDoDia({
        horasDia,
        materias,
        state,
        weekCounts,
        globalCounts,
        seed: s * 17 + d * 7,
        retaFinal,
        diaDaSemana: diaNome,
        nivel: dados.nivel
      });
      dias.push({
        dia: diaNome,
        materiasDoDia: dia.materiasDoDia,
        blocos: dia.blocos
      });
    }
    agenda.push({
      numero: s,
      foco: retaFinal ? "Reta final: questões, revisão e correção ativa" : "Distribuição por prioridade, dificuldade e desempenho",
      materiasDaSemana: Object.entries(weekCounts).sort((a,b) => b[1]-a[1]).map(([m]) => m),
      dias
    });
  }

  const prioridades = materias.slice(0, 6);
  const intensidade = diasRestantes <= 30 ? "Operação Reta Final" : diasRestantes <= 90 ? "Missão 90 Dias" : "Construção de Base";
  const ciclosPorDia = Math.max(2, Math.min(Math.floor((horasDia * 60) / 30), 10));

  const totalPomodoros = agenda.reduce((acc, semana) => acc + semana.dias.reduce((a, dia) => a + dia.blocos.filter(b => b.tipo === "pomodoro").length, 0), 0);

  return {
    edital,
    diasRestantes,
    semanas,
    cargaSemanal,
    intensidade,
    prioridades,
    agenda,
    ciclosPorDia,
    totalPomodoros,
    revisoes: [
      "Revisão 24h: o primeiro Pomodoro do próximo dia deve retomar erros e marcações do estudo anterior.",
      "Revisão 7 dias: no encerramento da semana, refaça questões erradas e registre padrões de erro.",
      "Revisão 15 dias: aplique mini-simulado dos assuntos acumulados e reorganize prioridades.",
      "Caderno de erros: toda questão errada deve virar anotação objetiva com motivo do erro."
    ],
    alertas: [
      dados.trabalha === "Sim" ? "Como você trabalha, o plano usa Pomodoros para reduzir atrito e manter constância." : "Use sua disponibilidade para elevar volume de questões sem abandonar revisão.",
      dados.nivel === "iniciante" ? "Como iniciante, o sistema reforça base, leitura ativa e questões fundamentais." : "Como você já tem base, o plano aumenta questões, correção ativa e simulados curtos.",
      "A distribuição prioriza os assuntos em que você declarou mais dificuldade, sem abandonar as disciplinas de manutenção.",
      "Inclua treino físico fora do cronograma teórico, especialmente 2 a 4 vezes por semana."
    ]
  };
}

function renderCursoPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Curso Completo — Elite Feminina Missão Farda</title><link rel="stylesheet" href="/styles.css" /></head>
<body>
<header class="topbar">
  <a class="brand" href="/"><span class="crest">✦</span><span><strong>ELITE FEMININA</strong><small>MISSÃO FARDA</small></span></a>
  <nav><a href="/">Início</a><a href="/#dicas">Dicas do edital</a><a href="/#plano">Gerar plano</a></nav>
</header>
<main class="course-page">
  <section class="course-hero glass">
    <div>
      <p class="eyebrow">Próxima etapa da missão</p>
      <h1>Curso completo para acelerar sua aprovação</h1>
      <p>Seu plano mostra o caminho. O curso completo entrega aulas, estratégia, revisão, questões, redação e direção para executar com constância até a prova.</p>
      <div class="course-actions">
        <a class="submit-btn course-btn" href="${COURSE_URL}" target="_blank" rel="noopener">Comprar curso completo</a>
        <a class="ghost-btn" href="/">Voltar ao gerador</a>
      </div>
    </div>
    <div class="course-card">
      <h2>O que incluir na oferta</h2>
      <ul>
        <li>Aulas organizadas por edital e por prioridade</li>
        <li>Cronograma Pomodoro semanal</li>
        <li>Banco de questões e simulados</li>
        <li>Redação com modelo de correção</li>
        <li>Revisão 24h / 7 dias / 15 dias</li>
        <li>Orientação para TAF e fases posteriores</li>
      </ul>
    </div>
  </section>
</main>
</body></html>`;
}

function renderPlanoPage(dados, plano) {
  const agendaHtml = plano.agenda.map(semana => `
    <section class="week-card">
      <div class="week-head">
        <div>
          <span>Semana ${semana.numero}</span>
          <strong>${escapeHtml(semana.foco)}</strong>
        </div>
        <small>${semana.materiasDaSemana.slice(0,4).map(escapeHtml).join(" • ")}</small>
      </div>
      <div class="days-grid">
        ${semana.dias.map(dia => `
          <article class="day-card">
            <h4>${escapeHtml(dia.dia)}</h4>
            <p class="day-focus">${dia.materiasDoDia.map(m => `<span>${escapeHtml(m)}</span>`).join("")}</p>
            <ul class="pomodoro-list">
              ${dia.blocos.map(bloco => bloco.tipo === "pausa" ? `
                <li class="break-line"><b>${escapeHtml(bloco.titulo)}</b> — ${escapeHtml(bloco.tempo)}: ${escapeHtml(bloco.assunto)}</li>
              ` : `
                <li>
                  <b>${escapeHtml(bloco.titulo)}</b> <em>${escapeHtml(bloco.tempo)}</em><br>
                  <span>${escapeHtml(bloco.materia)}</span> — ${escapeHtml(bloco.assunto)}<br>
                  <small>Missão: ${escapeHtml(bloco.tarefa)}${bloco.categoria ? " • " + escapeHtml(bloco.categoria) : ""}</small>
                </li>
              `).join("")}
            </ul>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  const distribuicao = plano.prioridades.map(m => {
    const peso = plano.edital.pesos[m] || 5;
    const pct = Math.min(100, Math.round((peso / Math.max(...Object.values(plano.edital.pesos))) * 100));
    return `<div class="bar-row"><span>${escapeHtml(m)}</span><div><i style="width:${pct}%"></i></div><b>${peso}</b></div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Plano gerado — Elite Feminina Missão Farda</title><link rel="stylesheet" href="/styles.css" /></head>
<body class="result-page">
<header class="topbar result-topbar">
  <a href="/" class="brand"><span class="crest">✦</span><span><strong>ELITE FEMININA</strong><small>MISSÃO FARDA</small></span></a>
  <nav><a href="/">Novo plano</a><a href="/curso" class="nav-highlight">Curso completo</a><button onclick="window.print()" class="btn small">Salvar PDF</button></nav>
</header>
<main class="result-wrap">

  <section class="pdf-cover glass">
    <p class="eyebrow">Elite Feminina — Missão Farda</p>
    <h1>Plano de Estudos Personalizado</h1>
    <div class="pdf-meta-grid">
      <div><span>Aluna</span><strong>${escapeHtml(dados.nome || "Não informado")}</strong></div>
      <div><span>Concurso</span><strong>${escapeHtml(plano.edital.nome)}</strong></div>
      <div><span>Data da prova</span><strong>${escapeHtml(dados.dataProva || "-")}</strong></div>
      <div><span>Dias restantes</span><strong>${plano.diasRestantes}</strong></div>
      <div><span>Carga semanal</span><strong>${plano.cargaSemanal}h</strong></div>
      <div><span>Pomodoros totais</span><strong>${plano.totalPomodoros}</strong></div>
      <div><span>Modelo</span><strong>25min foco + 5min pausa</strong></div>
    </div>
  </section>

  <section class="result-hero glass">
    <div>
      <p class="eyebrow">Plano gerado para ${escapeHtml(dados.nome || "aluna")}</p>
      <h1>${escapeHtml(plano.intensidade)} — ${escapeHtml(plano.edital.nome)}</h1>
      <p>${escapeHtml(plano.edital.subtitulo)} • ${plano.diasRestantes} dias até a prova • ${plano.cargaSemanal}h por semana • ${plano.totalPomodoros} Pomodoros planejados</p>
      <p class="contact-line">Contato: ${escapeHtml(dados.email || "-")} • WhatsApp: ${escapeHtml(dados.whatsapp || "-")}</p>
    </div>
    <div class="score-card">
      <span>Meta</span>
      <strong>${escapeHtml(dados.notaAlvo || "Aprovação")}</strong>
      <small>estratégia por dificuldade e nível</small>
    </div>
  </section>

  <section class="result-grid">
    <div class="glass panel">
      <h2>Prioridades</h2>
      <ol>${plano.prioridades.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ol>
    </div>
    <div class="glass panel">
      <h2>Revisões</h2>
      <ul>${plano.revisoes.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </div>
    <div class="glass panel">
      <h2>Alertas táticos</h2>
      <ul>${plano.alertas.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </div>
  </section>

  <section class="glass panel diagnosis-box">
    <h2>Diagnóstico da estratégia</h2>
    <div class="diagnosis-grid">
      <div><span>Nível informado</span><strong>${escapeHtml(dados.nivel || "Não informado")}</strong></div>
      <div><span>Dificuldades priorizadas</span><strong>${normalizeArray(dados.dificuldades).map(escapeHtml).join(" • ") || "Nenhuma informada"}</strong></div>
      <div><span>Facilidades em manutenção</span><strong>${normalizeArray(dados.facilidades).map(escapeHtml).join(" • ") || "Nenhuma informada"}</strong></div>
    </div>
    <p>O cronograma distribui os assuntos de maior dificuldade com mais frequência e mantém as matérias dominadas em ciclos de revisão para evitar esquecimento.</p>
  </section>

  <section class="glass panel edital-box">
    <h2>Resumo do edital selecionado</h2>
    <div class="edital-summary">
      <div><span>Tipo</span><strong>${escapeHtml(plano.edital.tipo)}</strong></div>
      <div><span>Duração</span><strong>${escapeHtml(plano.edital.duracao)}</strong></div>
      <div><span>Estratégia</span><strong>${escapeHtml(plano.edital.notaAlerta)}</strong></div>
    </div>
    <ul class="two-col-list">${plano.edital.prova.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>

  <section class="result-grid two-one">
    <div class="glass panel">
      <h2>Distribuição por peso</h2>
      <div class="bars">${distribuicao}</div>
    </div>
    <div class="glass panel">
      <h2>Técnica Pomodoro usada</h2>
      <p>O sistema usa ciclos de <strong>25 minutos de foco + 5 minutos de pausa</strong>. A distribuição considera o nível atual, as dificuldades marcadas e o peso das disciplinas no edital. Cada bloco alterna teoria, questões e revisão conforme a necessidade do aluno.</p>
    </div>
  </section>

  <section class="glass panel subjects">
    <h2>Assuntos do edital usados no plano</h2>
    <div class="subject-list">
      ${Object.entries(plano.edital.materias).map(([materia, assuntos]) => `
        <details>
          <summary>${escapeHtml(materia)} <span>${assuntos.length} assuntos</span></summary>
          <p>${assuntos.map(escapeHtml).join(" • ")}</p>
        </details>
      `).join("")}
    </div>
  </section>

  <section class="upsell glass">
    <div>
      <h2>Quer transformar esse plano em execução guiada?</h2>
      <p>Entre para o curso completo e siga uma preparação com aulas, questões, revisões, simulados e estratégia por edital.</p>
    </div>
    <a href="/curso" class="submit-btn mini-cta">Ver curso completo</a>
  </section>

  <section class="schedule">
    <h2>Cronograma Pomodoro por assunto</h2>
    ${agendaHtml}
  </section>
</main>
</body></html>`;
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/curso", (req, res) => res.send(renderCursoPage()));

app.post("/gerar-plano", (req, res) => {
  const dados = {
    concurso: req.body.concurso,
    nome: req.body.nome,
    email: req.body.email,
    whatsapp: req.body.whatsapp,
    dataProva: req.body.dataProva,
    horasDia: req.body.horasDia,
    diasSemana: req.body.diasSemana,
    trabalha: req.body.trabalha,
    nivel: req.body.nivel,
    dificuldades: req.body.dificuldades,
    facilidades: req.body.facilidades,
    estudouAntes: req.body.estudouAntes,
    notaAlvo: req.body.notaAlvo,
    observacoes: req.body.observacoes
  };
  const plano = gerarPlano(dados);
  salvarLead(dados, plano);
  res.send(renderPlanoPage(dados, plano));
});

app.listen(PORT, () => console.log(`Elite Feminina Missão Farda rodando em http://localhost:${PORT}`));
