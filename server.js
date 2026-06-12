const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const COURSE_URL =
  process.env.COURSE_URL ||
  "https://pay.cakto.com.br/33krayz?affiliate=s7XUk8bn";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const LEADS_JSON = path.join(DATA_DIR, "leads.json");
const LEADS_CSV = path.join(DATA_DIR, "leads.csv");
const USERS_JSON   = path.join(DATA_DIR, "users.json");
const INVITES_JSON = path.join(DATA_DIR, "invites.json");
const AVISOS_JSON  = path.join(DATA_DIR, "avisos.json");
const SESSION_SECRET_FILE = path.join(DATA_DIR, "session-secret.txt");

app.disable("x-powered-by");
app.set("trust proxy", 1);

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(SESSION_SECRET_FILE)) {
    const storedSecret = fs.readFileSync(SESSION_SECRET_FILE, "utf8").trim();
    if (storedSecret) return storedSecret;
  }

  const generatedSecret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SESSION_SECRET_FILE, generatedSecret, "utf8");
  return generatedSecret;
}

app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(
  session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// ── MongoDB + cache em memória ────────────────────────────────────────────────
// Estratégia: cache síncrono em memória + persistência assíncrona no MongoDB.
// readUsers() e writeUsers() continuam síncronos — nenhum outro código muda.
// Na inicialização, carregamos o MongoDB (ou o arquivo local como fallback).

const MONGODB_URI = process.env.MONGODB_URI || null;
let _mongoDb      = null;   // conexão ativa
let _usersCache   = null;   // null = ainda não carregado
let _invitesCache = [];     // convites únicos por aluna
let _avisosCache  = [];     // quadro de avisos publicado pelo admin

async function connectMongo() {
  if (!MONGODB_URI) return null;
  try {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    // O nome legado "elite-feminina" é mantido como padrão porque os dados de
    // produção (usuárias, convites, avisos) já vivem nesse banco no Atlas.
    // Para migrar, defina MONGODB_DB e copie os dados antes.
    _mongoDb = client.db(process.env.MONGODB_DB || "elite-feminina");
    console.log("[DB] MongoDB Atlas conectado ✓");
    return _mongoDb;
  } catch (err) {
    console.error("[DB] Falha ao conectar MongoDB:", err.message);
    return null;
  }
}

async function loadUsersFromStorage() {
  // 1) Tenta MongoDB
  if (_mongoDb) {
    try {
      const doc = await _mongoDb.collection("app_data").findOne({ _id: "users" });
      const list = doc && Array.isArray(doc.users) ? doc.users : [];
      console.log(`[DB] ${list.length} usuário(s) carregado(s) do MongoDB`);
      return list;
    } catch (err) {
      console.error("[DB] Erro ao carregar usuários do MongoDB:", err.message);
    }
  }
  // 2) Fallback: arquivo local (dev / sem MONGODB_URI)
  if (!fs.existsSync(USERS_JSON)) return [];
  try {
    const raw = fs.readFileSync(USERS_JSON, "utf8").trim();
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistUsersToDB(users) {
  if (_mongoDb) {
    _mongoDb.collection("app_data")
      .replaceOne({ _id: "users" }, { _id: "users", users }, { upsert: true })
      .catch((err) => console.error("[DB] Erro ao salvar usuários:", err.message));
  } else {
    // Fallback local
    try {
      ensureDirectories();
      fs.writeFileSync(USERS_JSON, JSON.stringify(users, null, 2), "utf8");
    } catch (err) {
      console.error("[DB] Erro ao salvar users.json:", err.message);
    }
  }
}

// ── Convites ──────────────────────────────────────────────────────────────────

function readInvites() {
  return _invitesCache;
}

function writeInvites(invites) {
  _invitesCache = invites;
  if (_mongoDb) {
    _mongoDb.collection("app_data")
      .replaceOne({ _id: "invites" }, { _id: "invites", invites }, { upsert: true })
      .catch((err) => console.error("[DB] Erro ao salvar convites:", err.message));
  } else {
    try {
      ensureDirectories();
      fs.writeFileSync(INVITES_JSON, JSON.stringify(invites, null, 2), "utf8");
    } catch (err) {
      console.error("[DB] Erro ao salvar invites.json:", err.message);
    }
  }
}

async function loadInvitesFromStorage() {
  if (_mongoDb) {
    try {
      const doc = await _mongoDb.collection("app_data").findOne({ _id: "invites" });
      const list = doc && Array.isArray(doc.invites) ? doc.invites : [];
      console.log(`[DB] ${list.length} convite(s) carregado(s)`);
      return list;
    } catch (err) {
      console.error("[DB] Erro ao carregar convites:", err.message);
    }
  }
  if (!fs.existsSync(INVITES_JSON)) return [];
  try {
    const raw = fs.readFileSync(INVITES_JSON, "utf8").trim();
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ── Quadro de Avisos ──────────────────────────────────────────────────────────

function readAvisos() {
  return _avisosCache;
}

function writeAvisos(avisos) {
  _avisosCache = avisos;
  if (_mongoDb) {
    _mongoDb.collection("app_data")
      .replaceOne({ _id: "avisos" }, { _id: "avisos", avisos }, { upsert: true })
      .catch((err) => console.error("[DB] Erro ao salvar avisos:", err.message));
  } else {
    try {
      ensureDirectories();
      fs.writeFileSync(AVISOS_JSON, JSON.stringify(avisos, null, 2), "utf8");
    } catch (err) {
      console.error("[DB] Erro ao salvar avisos.json:", err.message);
    }
  }
}

async function loadAvisosFromStorage() {
  if (_mongoDb) {
    try {
      const doc = await _mongoDb.collection("app_data").findOne({ _id: "avisos" });
      const list = doc && Array.isArray(doc.avisos) ? doc.avisos : [];
      console.log(`[DB] ${list.length} aviso(s) carregado(s)`);
      return list;
    } catch (err) {
      console.error("[DB] Erro ao carregar avisos:", err.message);
    }
  }
  if (!fs.existsSync(AVISOS_JSON)) return [];
  try {
    const raw = fs.readFileSync(AVISOS_JSON, "utf8").trim();
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function readUsers() {
  return _usersCache || [];
}

function writeUsers(users) {
  _usersCache = users;
  persistUsersToDB(users);
}

function isAccessValid(user) {
  if (!user.active) return false;
  if (!user.expiresAt) return true;
  return new Date(user.expiresAt).getTime() >= Date.now();
}

function seedAdminUser() {
  const users = readUsers();
  if (users.some((u) => u.role === "admin")) return;
  const hash = bcrypt.hashSync("admin123", 10);
  users.push({
    id: crypto.randomUUID(),
    name: "Administrador",
    email: "admin@missaofarda.com",
    password: hash,
    role: "admin",
    active: true,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
  console.log("Admin padrão criado — email: admin@missaofarda.com  senha: admin123");
}

// ── Auth middleware ───────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/login", "/logout", "/health", "/curso", "/cadastro"];
const STATIC_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/;

function requireAuth(req, res, next) {
  if (
    PUBLIC_PATHS.includes(req.path) ||
    STATIC_EXTENSIONS.test(req.path)
  ) {
    return next();
  }

  if (!req.session.userId) {
    if (req.accepts("html")) return res.redirect("/login");
    return res.status(401).json({ success: false, message: "Não autenticado." });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === req.session.userId);

  if (!user || !isAccessValid(user)) {
    req.session.destroy(() => {});
    if (req.accepts("html")) return res.redirect("/login");
    return res.status(403).json({ success: false, message: "Acesso expirado ou inativo." });
  }

  req.currentUser = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    if (req.accepts("html")) return res.redirect("/");
    return res.status(403).json({ success: false, message: "Acesso negado." });
  }
  next();
}

app.use(requireAuth);

// ── Static files (after auth) ─────────────────────────────────────────────────
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders(res, filePath) {
      if (filePath.toLowerCase().endsWith(".pdf")) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        res.setHeader("Cache-Control", "private, max-age=3600");
      }
    },
  })
);

// ── Auth routes ───────────────────────────────────────────────────────────────

app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

// ── Cadastro (auto-registro) ───────────────────────────────────────────────────
// ── Cadastro via convite único ─────────────────────────────────────────────────

function validateInviteToken(token) {
  if (!token) return null;
  const invite = readInvites().find((i) => i.token === token);
  if (!invite)            return { error: "Este link de cadastro é inválido." };
  if (invite.usedAt)      return { error: "Este link já foi utilizado. Faça login ou solicite um novo link." };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())
                          return { error: "Este link expirou. Solicite um novo link ao suporte." };
  return { invite };
}

app.get("/cadastro", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  const token = String(req.query.convite || "").trim();
  const result = validateInviteToken(token);
  if (!result || result.error) {
    // Redireciona para login com mensagem de erro embutida na URL
    const msg = encodeURIComponent(result?.error || "Link de cadastro inválido ou ausente.");
    return res.redirect(`/login?erro=${msg}`);
  }
  res.sendFile(path.join(PUBLIC_DIR, "cadastro.html"));
});

app.post("/cadastro", (req, res) => {
  const token = String(req.body.token || "").trim();
  const result = validateInviteToken(token);
  if (!result || result.error) {
    return res.status(400).json({ success: false, message: result?.error || "Convite inválido." });
  }

  const name            = String(req.body.name            || "").trim();
  const email           = String(req.body.email           || "").trim().toLowerCase();
  const password        = String(req.body.password        || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Preencha todos os campos obrigatórios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "A senha deve ter no mínimo 6 caracteres." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "As senhas não coincidem." });
  }

  const users = readUsers();
  if (users.find((u) => u.email.toLowerCase() === email)) {
    return res.status(409).json({ success: false, message: "Este e-mail já possui cadastro. Faça login." });
  }

  const hash = bcrypt.hashSync(password, 10);

  // Expiração padrão: DEFAULT_ACCESS_DAYS dias (env). 0 = sem limite.
  const defaultDays = parseInt(process.env.DEFAULT_ACCESS_DAYS ?? "365", 10);
  const expiresAt = defaultDays > 0
    ? new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password: hash,
    role: "user",
    active: true,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  // Marca o convite como usado (não pode ser reutilizado)
  const invites = readInvites();
  const idx = invites.findIndex((i) => i.token === token);
  if (idx !== -1) {
    invites[idx] = { ...invites[idx], usedAt: new Date().toISOString(), usedBy: newUser.id };
    writeInvites(invites);
  }

  // Loga automaticamente após o cadastro
  req.session.userId = newUser.id;
  return res.json({ success: true, redirect: "/" });
});

app.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const users = readUsers();
  const user = users.find((u) => u.email.toLowerCase() === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: "E-mail ou senha incorretos." });
  }

  if (!isAccessValid(user)) {
    return res.status(403).json({ success: false, message: "Seu acesso está inativo ou expirado. Entre em contato com o suporte." });
  }

  req.session.userId = user.id;
  const redirect = user.role === "admin" ? "/admin" : "/";
  return res.json({ success: true, redirect });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ success: true });
});

// ── Admin API ─────────────────────────────────────────────────────────────────

app.get("/me", (req, res) => {
  const user = req.currentUser;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    expiresAt: user.expiresAt,
  });
});

// ── Current user ─────────────────────────────────────────────────────────────

app.get("/me", (req, res) => {
  if (!req.currentUser) return res.status(401).json({ success: false });
  const { password: _, ...safe } = req.currentUser;
  res.json(safe);
});

// ── Student area ──────────────────────────────────────────────────────────────

app.get("/minha-area", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "minha-area.html"));
});

// ── Admin panel ───────────────────────────────────────────────────────────────

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

// ── Rotas de convites (admin) ─────────────────────────────────────────────────

// Listar convites
app.get("/admin/invites", requireAdmin, (req, res) => {
  res.json(readInvites());
});

// Gerar novo convite
app.post("/admin/invites", requireAdmin, (req, res) => {
  const label    = String(req.body.label    || "").trim();
  const expiresAt = req.body.expiresAt || null;

  const token = crypto.randomBytes(24).toString("hex");
  const invite = {
    id: crypto.randomUUID(),
    token,
    label,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
    usedAt: null,
    usedBy: null,
  };

  const invites = readInvites();
  invites.push(invite);
  writeInvites(invites);

  const base = `${req.protocol}://${req.get("host")}`;
  res.json({ success: true, invite: { ...invite, url: `${base}/cadastro?convite=${token}` } });
});

// Revogar convite
app.delete("/admin/invites/:id", requireAdmin, (req, res) => {
  const filtered = readInvites().filter((i) => i.id !== req.params.id);
  if (filtered.length === readInvites().length) {
    return res.status(404).json({ success: false, message: "Convite não encontrado." });
  }
  writeInvites(filtered);
  res.json({ success: true });
});

// ── Rotas do Quadro de Avisos ─────────────────────────────────────────────────

const AVISO_CATEGORIAS = ["aula", "concurso", "edital", "aviso"];

// Alunas: lista avisos (fixados primeiro, depois mais recentes)
app.get("/avisos", (req, res) => {
  const avisos = readAvisos()
    .slice()
    .sort((a, b) => {
      if (!!b.fixado !== !!a.fixado) return b.fixado ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  res.json(avisos);
});

// Admin: publicar aviso
app.post("/admin/avisos", requireAdmin, (req, res) => {
  const titulo    = String(req.body.titulo   || "").trim().slice(0, 120);
  const mensagem  = String(req.body.mensagem || "").trim().slice(0, 2000);
  const categoria = AVISO_CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : "aviso";
  const rawLink   = String(req.body.link || "").trim();
  const link      = /^https?:\/\//i.test(rawLink) ? rawLink : null;
  const dataEvento = req.body.dataEvento || null;
  const fixado     = !!req.body.fixado;

  if (!titulo || !mensagem) {
    return res.status(400).json({ success: false, message: "Título e mensagem são obrigatórios." });
  }

  const aviso = {
    id: crypto.randomUUID(),
    titulo,
    mensagem,
    categoria,
    link,
    dataEvento,
    fixado,
    createdAt: new Date().toISOString(),
  };

  const avisos = readAvisos();
  avisos.push(aviso);
  writeAvisos(avisos);
  res.json({ success: true, aviso });
});

// Admin: excluir aviso
app.delete("/admin/avisos/:id", requireAdmin, (req, res) => {
  const avisos = readAvisos();
  const filtered = avisos.filter((a) => a.id !== req.params.id);
  if (filtered.length === avisos.length) {
    return res.status(404).json({ success: false, message: "Aviso não encontrado." });
  }
  writeAvisos(filtered);
  res.json({ success: true });
});

// ── Rotas de usuários (admin) ─────────────────────────────────────────────────

app.get("/admin/users", requireAdmin, (req, res) => {
  const users = readUsers().map(({ password: _, ...u }) => u);
  res.json(users);
});

app.post("/admin/users", requireAdmin, (req, res) => {
  const { name, email, password, expiresAt, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Nome, e-mail e senha são obrigatórios." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: "Senha mínima de 6 caracteres." });
  }

  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(400).json({ success: false, message: "E-mail já cadastrado." });
  }

  const hash = bcrypt.hashSync(String(password), 10);
  const newUser = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password: hash,
    role: role === "admin" ? "admin" : "user",
    active: true,
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  const { password: _, ...safe } = newUser;
  res.json({ success: true, user: safe });
});

app.patch("/admin/users/:id", requireAdmin, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Usuário não encontrado." });
  }

  const allowed = ["active", "expiresAt", "name", "role"];
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      users[idx][field] = req.body[field];
    }
  });

  writeUsers(users);
  res.json({ success: true });
});

app.delete("/admin/users/:id", requireAdmin, (req, res) => {
  if (req.params.id === req.currentUser.id) {
    return res.status(400).json({ success: false, message: "Você não pode remover a própria conta." });
  }

  const users = readUsers();
  const filtered = users.filter((u) => u.id !== req.params.id);

  if (filtered.length === users.length) {
    return res.status(404).json({ success: false, message: "Usuário não encontrado." });
  }

  writeUsers(filtered);
  res.json({ success: true });
});

const EDITAIS = {
  "SD PMBA": {
    nome: "SD PMBA",
    subtitulo: "Soldado da Polícia Militar da Bahia",
    tipo: "Prova Objetiva + Prova Discursiva/Redação",
    duracao: "4h30",
    questoes: 80,
    notaAlerta: "Foco em Conhecimentos Gerais e Conhecimentos Específicos.",
    estrategia:
      "Para SD PMBA, o sistema equilibra base geral com bloco jurídico específico, evitando semana com matéria única.",
    prova: [
      "80 questões objetivas",
      "Conhecimentos Gerais: 50 questões",
      "Conhecimentos Específicos: 30 questões",
      "Prova discursiva/redação aplicada no mesmo dia",
      "Fases posteriores: avaliação física, psicológica, médica, investigação social e documentação",
    ],
    dicas: [
      "Português, Matemática e Atualidades precisam aparecer com frequência alta, pois fortalecem a base da prova.",
      "O bloco jurídico específico deve entrar desde o início: Constitucional, Administrativo, Penal, Penal Militar, Direitos Humanos e Igualdade Racial/Gênero.",
      "Faça questões desde a primeira semana. Não espere terminar teoria para treinar banca.",
      "Separe ao menos 2 dias por semana para condicionamento físico, mesmo que por 20 a 30 minutos.",
    ],
    pesos: {
      "Língua Portuguesa": 14,
      Matemática: 10,
      Atualidades: 8,
      Informática: 6,
      "História do Brasil": 6,
      "Geografia do Brasil": 6,
      "Direito Constitucional": 6,
      "Direitos Humanos": 5,
      "Direito Administrativo": 5,
      "Direito Penal": 5,
      "Direito Penal Militar": 5,
      "Igualdade Racial e de Gênero": 4,
    },
    materias: {
      "Língua Portuguesa": [
        "Compreensão e interpretação de textos",
        "Tipologia textual",
        "Ortografia oficial",
        "Acentuação gráfica",
        "Classes de palavras",
        "Sintaxe da oração e do período",
        "Pontuação",
        "Concordância verbal e nominal",
        "Regência verbal e nominal",
        "Crase",
        "Semântica",
        "Redação oficial",
      ],
      Matemática: [
        "Conjuntos numéricos",
        "Operações fundamentais",
        "Razão e proporção",
        "Porcentagem",
        "Regra de três",
        "Equações",
        "Funções",
        "Geometria básica",
        "Estatística",
        "Probabilidade",
        "Resolução de problemas",
      ],
      Atualidades: [
        "Política nacional",
        "Economia",
        "Segurança pública",
        "Meio ambiente",
        "Tecnologia",
        "Relações internacionais",
        "Temas sociais contemporâneos",
      ],
      Informática: [
        "Conceitos básicos de informática",
        "Windows, Linux e sistemas operacionais",
        "Editores de texto",
        "Planilhas eletrônicas",
        "Internet e intranet",
        "Correio eletrônico",
        "Computação em nuvem",
        "Segurança da informação",
      ],
      "História do Brasil": [
        "Brasil Colônia",
        "Brasil Império",
        "Primeira República",
        "Era Vargas",
        "Ditadura Militar",
        "Redemocratização",
        "História da Bahia",
      ],
      "Geografia do Brasil": [
        "Formação territorial",
        "Regionalização do Brasil",
        "Aspectos físicos",
        "População brasileira",
        "Urbanização",
        "Economia brasileira",
        "Geografia da Bahia",
      ],
      "Direito Constitucional": [
        "Constituição Federal",
        "Direitos e garantias fundamentais",
        "Organização do Estado",
        "Administração Pública",
        "Segurança pública",
      ],
      "Direitos Humanos": [
        "Declaração Universal dos Direitos Humanos",
        "Direitos fundamentais",
        "Tratados internacionais",
        "Cidadania",
        "Proteção contra discriminação",
      ],
      "Direito Administrativo": [
        "Princípios da Administração Pública",
        "Atos administrativos",
        "Poderes administrativos",
        "Agentes públicos",
        "Responsabilidade civil do Estado",
      ],
      "Direito Penal": [
        "Aplicação da lei penal",
        "Crime",
        "Imputabilidade penal",
        "Concurso de pessoas",
        "Penas",
        "Crimes contra a pessoa",
        "Crimes contra o patrimônio",
        "Crimes contra a Administração Pública",
        "Lei de Drogas",
      ],
      "Direito Penal Militar": [
        "Código Penal Militar",
        "Crimes militares em tempo de paz",
        "Crimes contra autoridade ou disciplina militar",
        "Crimes contra o serviço militar",
        "Crimes contra a Administração Militar",
      ],
      "Igualdade Racial e de Gênero": [
        "Estatuto da Igualdade Racial",
        "Políticas afirmativas",
        "Lei Maria da Penha",
        "Violência contra a mulher",
        "Discriminação racial e de gênero",
      ],
    },
  },

  "CFO PMBA": {
    nome: "CFO PMBA",
    subtitulo: "Curso de Formação de Oficiais da Polícia Militar da Bahia",
    tipo: "Prova Objetiva + Redação + 2ª Etapa",
    duracao: "5h",
    questoes: 80,
    notaAlerta: "Nota objetiva inferior a 60 ou zero em disciplina pode eliminar.",
    estrategia:
      "Português, Direito e Ciências Humanas formam o núcleo do CFO, mas o plano mantém rodízio para não zerar disciplina.",
    prova: [
      "80 questões objetivas",
      "Língua Portuguesa: 20 questões",
      "Direito: 20 questões",
      "Ciências Humanas: 20 questões",
      "Matemática: 10 questões",
      "Informática: 5 questões",
      "Língua Inglesa: 5 questões",
      "Redação de 20 a 30 linhas",
      "2ª etapa: avaliação psicológica, física, médica/odontológica, investigação social e documental",
    ],
    dicas: [
      "Português, Direito e Ciências Humanas somam a maior parte da prova: mantenha alta frequência nelas.",
      "Não abandone Inglês e Informática. Mesmo com menor peso, zerar disciplina é risco estratégico.",
      "Treine redação semanalmente: estrutura, clareza, coesão, concisão e domínio do tema.",
      "Inclua TAF na rotina: aprovação intelectual não substitui preparação física.",
    ],
    pesos: {
      "Língua Portuguesa": 20,
      Direito: 20,
      "Ciências Humanas": 20,
      "Matemática/RLM": 10,
      Informática: 5,
      "Língua Inglesa": 5,
    },
    materias: {
      "Língua Portuguesa": [
        "Leitura e interpretação de textos verbais, mistos e não verbais",
        "Textos publicitários",
        "Flexões nominais e verbais",
        "Advérbios e circunstâncias",
        "Preposições e conjunções",
        "Frase, oração e período",
        "Termos essenciais, integrantes e acessórios",
        "Coordenação e subordinação",
        "Concordância, regência e crase",
        "Discurso direto, indireto e indireto livre",
        "Semântica",
        "Pontuação",
        "Acentuação e ortografia",
        "Redação oficial",
      ],
      Direito: [
        "Direito Constitucional",
        "Direito Administrativo",
        "Direitos Humanos",
        "Direito Penal",
        "Direito Processual Penal",
        "Legislação penal especial",
        "Direito Penal Militar",
        "Direito Processual Penal Militar",
      ],
      "Ciências Humanas": [
        "História: Antiguidade, Mundo Medieval, Mundo Moderno e Mundo Contemporâneo",
        "Brasil Colônia",
        "Brasil Império",
        "Brasil República",
        "História da Bahia",
        "Independência da Bahia",
        "Revolta de Canudos",
        "Revolta dos Malês",
        "Conjuração Baiana",
        "Sabinada",
        "Atualidades",
        "Geografia: relação sociedade-natureza",
        "Estruturação econômica, social e política do espaço mundial",
        "Formação territorial do Brasil",
        "Urbanização e metropolização",
      ],
      "Matemática/RLM": [
        "Operações fundamentais",
        "Razão e proporção",
        "Porcentagem",
        "Regra de três",
        "Equações",
        "Funções",
        "Geometria",
        "Proporcionalidade e finanças",
        "Juros simples e compostos",
        "Estatística",
        "Gráficos",
        "Sequências e resolução de problemas",
      ],
      Informática: [
        "Word, Writer, Excel, Calc, PowerPoint e Impress",
        "Windows, Linux e organização de arquivos",
        "Atalhos, ícones, área de trabalho e lixeira",
        "Internet e intranet",
        "Correio eletrônico",
        "Computação em nuvem",
        "Certificação e assinatura digital",
        "Segurança da Informação",
        "Componentes de computador",
      ],
      "Língua Inglesa": [
        "Compreensão de textos verbais e não verbais",
        "Substantivos",
        "Plural regular e irregular",
        "Gênero e contáveis/não contáveis",
        "Artigos e demonstrativos",
        "Adjetivos",
        "Pronomes",
        "Verbos regulares e irregulares",
        "Voz ativa e passiva",
        "Estratégias de leitura",
      ],
    },
  },
};

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEADS_JSON)) {
    fs.writeFileSync(LEADS_JSON, "[]", "utf8");
  }
  if (!fs.existsSync(LEADS_CSV)) {
    const header =
      "id,data,nome,email,whatsapp,concurso,dataProva,horasDia,diasSemana,trabalha,nivel,estudouAntes,notaAlvo,observacoes,dificuldades,facilidades,diasRestantes,cargaSemanal\n";
    fs.writeFileSync(LEADS_CSV, header, "utf8");
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c];
  });
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(value, fallback = "") {
  if (Array.isArray(value)) return String(value[0] ?? fallback).trim();
  return String(value ?? fallback).trim();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function diasAte(dataProva) {
  if (!dataProva) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prova = new Date(`${dataProva}T00:00:00`);
  if (Number.isNaN(prova.getTime())) return null;
  return Math.max(0, Math.ceil((prova - hoje) / (1000 * 60 * 60 * 24)));
}

function formatDateBR(dataProva) {
  if (!dataProva) return "-";
  const prova = new Date(`${dataProva}T00:00:00`);
  if (Number.isNaN(prova.getTime())) return "-";
  return prova.toLocaleDateString("pt-BR");
}

function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

function readLeads() {
  ensureDirectories();
  try {
    const raw = fs.readFileSync(LEADS_JSON, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Erro ao ler leads.json:", err.message);
    return [];
  }
}

function writeLeads(leads) {
  ensureDirectories();
  fs.writeFileSync(LEADS_JSON, JSON.stringify(leads, null, 2), "utf8");
}

function appendLeadCsv(record) {
  ensureDirectories();
  const csvValue = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linha = [
    record.id,
    record.data,
    record.nome,
    record.email,
    record.whatsapp,
    record.concurso,
    record.dataProva,
    record.horasDia,
    record.diasSemana,
    record.trabalha,
    record.nivel,
    record.estudouAntes,
    record.notaAlvo,
    record.observacoes,
    Array.isArray(record.dificuldades) ? record.dificuldades.join(" | ") : "",
    Array.isArray(record.facilidades) ? record.facilidades.join(" | ") : "",
    record.diasRestantes,
    record.cargaSemanal,
  ]
    .map(csvValue)
    .join(",");

  fs.appendFileSync(LEADS_CSV, linha + "\n", "utf8");
}

function normalizeLeadBody(body = {}) {
  return {
    concurso: pickText(body.concurso),
    nome: pickText(body.nome),
    email: pickText(body.email),
    whatsapp: pickText(body.whatsapp || body.telefone),
    dataProva: pickText(body.dataProva),
    horasDia: safeNumber(body.horasDia, 0),
    diasSemana: safeNumber(body.diasSemana, 0),
    trabalha: pickText(body.trabalha),
    nivel: pickText(body.nivel),
    dificuldades: normalizeArray(body.dificuldades).map((v) => pickText(v)),
    facilidades: normalizeArray(body.facilidades).map((v) => pickText(v)),
    estudouAntes: pickText(body.estudouAntes),
    notaAlvo: safeNumber(body.notaAlvo, 0),
    observacoes: pickText(body.observacoes),
  };
}

function validateLead(lead) {
  const errors = [];

  if (!lead.concurso) errors.push("Concurso é obrigatório.");
  if (!lead.nome) errors.push("Nome é obrigatório.");
  if (!lead.email) errors.push("E-mail é obrigatório.");
  if (!lead.whatsapp) errors.push("WhatsApp é obrigatório.");
  if (!lead.dataProva) errors.push("Data da prova é obrigatória.");
  if (!lead.horasDia || lead.horasDia < 1) errors.push("Horas por dia inválidas.");
  if (!lead.diasSemana || lead.diasSemana < 1) errors.push("Dias por semana inválidos.");
  if (!lead.trabalha) errors.push("Campo 'Trabalha?' é obrigatório.");
  if (!lead.nivel) errors.push("Nível atual é obrigatório.");
  if (!lead.estudouAntes) errors.push("Campo 'Já estudou para a PMBA antes?' é obrigatório.");

  return errors;
}

function buildLeadRecord(lead, req, plano = null) {
  const id = crypto.randomUUID();

  const record = {
    id,
    data: new Date().toISOString(),
    ip:
      (req.headers["x-forwarded-for"] || "")
        .toString()
        .split(",")[0]
        .trim() || req.ip || "",
    userAgent: req.headers["user-agent"] || "",
    concurso: lead.concurso,
    nome: lead.nome,
    email: lead.email,
    whatsapp: lead.whatsapp,
    dataProva: lead.dataProva,
    horasDia: lead.horasDia,
    diasSemana: lead.diasSemana,
    trabalha: lead.trabalha,
    nivel: lead.nivel,
    estudouAntes: lead.estudouAntes,
    notaAlvo: lead.notaAlvo,
    observacoes: lead.observacoes,
    dificuldades: lead.dificuldades,
    facilidades: lead.facilidades,
    diasRestantes: plano?.diasRestantes ?? diasAte(lead.dataProva),
    cargaSemanal: plano?.cargaSemanal ?? lead.horasDia * lead.diasSemana,
  };

  return record;
}

function saveLead(lead, req, plano = null) {
  const record = buildLeadRecord(lead, req, plano);
  const leads = readLeads();
  leads.push(record);
  writeLeads(leads);
  appendLeadCsv(record);
  return record;
}

function perfilDoNivel(nivel = "") {
  const n = String(nivel).toLowerCase();

  if (n.includes("iniciante")) {
    return {
      nome: "Base guiada",
      dificuldadeExtra: 5,   // reduzido: gap menor → rotação funciona
      facilidadeReducao: 1,
      teoria: "teoria guiada + exemplos",
      questoes: "questões fundamentais",
      revisao: "revisão de base + caderno de erros",
      simulado: "mini-simulado leve",
    };
  }

  if (n.includes("avançado")) {
    return {
      nome: "Alta performance",
      dificuldadeExtra: 7,   // reduzido
      facilidadeReducao: 2,
      teoria: "revisão objetiva do ponto-chave",
      questoes: "questões cronometradas",
      revisao: "correção ativa + padrão de erro",
      simulado: "simulado com tempo controlado",
    };
  }

  return {
    nome: "Evolução equilibrada",
    dificuldadeExtra: 6,   // reduzido
    facilidadeReducao: 3,
    teoria: "teoria direcionada",
    questoes: "questões comentadas",
    revisao: "revisão/caderno de erros",
    simulado: "mini-simulado",
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

    if (
      String(nivel).toLowerCase().includes("iniciante") &&
      ["Língua Portuguesa", "Matemática", "Matemática/RLM"].includes(materia)
    ) {
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
      categoria: dificil
        ? "Prioridade de recuperação"
        : facil
        ? "Manutenção estratégica"
        : "Construção de desempenho",
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

    // Penalidade progressiva por semana — freio efetivo contra repetição
    score -= (ctx.weekCounts[materia] || 0) * 5.5;
    // Penalidade suave por uso total
    score -= (ctx.globalCounts[materia] || 0) * 0.4;
    // Bloqueio forte para repetição consecutiva
    if (ctx.lastMateria === materia) score -= 120;
    // Penalidade para matéria já selecionada no dia
    if (ctx.daySet.has(materia)) score -= 60;
    // Bônus forte se a matéria ainda não apareceu essa semana
    if ((ctx.weekCounts[materia] || 0) === 0) score += 14;
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
  if (!item || !item.assuntos.length) return "";
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
  // Seleção puramente pelo score unificado — sem loop de prioridades forçadas.
  // Matérias difíceis aparecem mais (score base maior), mas as penalidades
  // por uso semanal garantem revezamento real com as demais disciplinas.
  const escolhidas = [];

  let guard = 0;
  while (escolhidas.length < limite && guard < materias.length * 4) {
    const materia = escolherMateria(materias, state, {
      ...ctx,
      daySet: new Set(escolhidas),
      lastMateria: escolhidas[escolhidas.length - 1] || null,
    });

    if (!escolhidas.includes(materia)) {
      escolhidas.push(materia);
    } else {
      const fallback = materias.find((m) => !escolhidas.includes(m));
      if (fallback) escolhidas.push(fallback);
      else break;
    }

    guard++;
  }

  return escolhidas;
}

function distribuirCiclos(ciclos, qtdMaterias, nivel) {
  // Distribuição equilibrada: leve destaque para a prioritária,
  // mas todas as matérias do dia têm tempo real de estudo.
  if (qtdMaterias <= 1) return [ciclos];

  if (qtdMaterias === 2) {
    // 55% / 45%
    const a = Math.max(1, Math.round(ciclos * 0.55));
    return [a, Math.max(1, ciclos - a)];
  }

  // 3 matérias: 44% / 34% / 22%
  const a = Math.max(1, Math.round(ciclos * 0.44));
  const b = Math.max(1, Math.round(ciclos * 0.34));
  return [a, b, Math.max(1, ciclos - a - b)];
}

function tarefaPorNivel(perfil, etapa, retaFinal) {
  if (retaFinal && etapa >= 2) return `${perfil.simulado} + correção`;
  if (etapa === 1) return perfil.teoria;
  if (etapa === 2) return perfil.questoes;
  return perfil.revisao;
}

function gerarPomodorosDoDia({
  horasDia,
  materias,
  state,
  weekCounts,
  globalCounts,
  seed,
  retaFinal,
  diaDaSemana,
  nivel,
}) {
  const perfil = perfilDoNivel(nivel);
  const minutosDisponiveis = horasDia * 60;
  let ciclos = Math.floor(minutosDisponiveis / 30);
  ciclos = Math.max(2, Math.min(ciclos, 10));

  const limite = Math.min(limiteMateriasPorDia(horasDia), materias.length);
  const materiasDoDia = selecionarMateriasDoDia(
    materias,
    state,
    { weekCounts, globalCounts, seed, lastMateria: null },
    limite
  );

  const ciclosPorMateria = distribuirCiclos(ciclos, materiasDoDia.length, nivel);

  const blocos = [];
  let contador = 1;

  materiasDoDia.forEach((materia, idx) => {
    const qtd = ciclosPorMateria[idx] || 1;
    const assunto = proximoAssunto(state, materia);
    const categoria = state[materia]?.categoria || "";

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
        tarefa,
      });

      if (contador % 4 === 0 && contador !== ciclos) {
        blocos.push({
          tipo: "pausa",
          titulo: "Pausa longa",
          tempo: "15min a 20min",
          materia: "",
          assunto: "Pausa para recuperar energia e manter foco no próximo ciclo.",
          categoria: "",
          tarefa: "recuperação",
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
      assunto: retaFinal
        ? "Mini-simulado + correção dos erros"
        : "Revisão dos assuntos mais cobrados da semana",
      categoria: "Consolidação",
      tarefa: perfil.simulado,
    });
  }

  return { blocos, materiasDoDia };
}

function gerarPlano(dados) {
  const edital = EDITAIS[dados.concurso] || EDITAIS["SD PMBA"];
  const diasRestantes = diasAte(dados.dataProva);
  const horasDia = Math.max(safeNumber(dados.horasDia, 1), 1);
  const diasSemana = Math.max(safeNumber(dados.diasSemana, 3), 1);
  const cargaSemanal = horasDia * diasSemana;
  const semanas = Math.max(1, Math.ceil((diasRestantes || 1) / 7));

  const dificuldades = normalizeArray(dados.dificuldades);
  const facilidades = normalizeArray(dados.facilidades);
  const state = buildMateriaState(edital, dificuldades, facilidades, dados.nivel);
  const materias = Object.keys(edital.pesos).sort((a, b) => state[b].score - state[a].score);
  const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const agenda = [];
  const globalCounts = {};

  for (let s = 1; s <= semanas; s++) {
    const retaFinal = diasRestantes !== null && (diasRestantes <= 30 || s > Math.max(1, semanas - 2));
    const weekCounts = {};
    const dias = [];

    for (let d = 0; d < diasSemana; d++) {
      const diaNome = nomesDias[d] || `Dia ${d + 1}`;
      const dia = gerarPomodorosDoDia({
        horasDia,
        materias,
        state,
        weekCounts,
        globalCounts,
        seed: s * 17 + d * 7,
        retaFinal,
        diaDaSemana: diaNome,
        nivel: dados.nivel,
      });

      dias.push({
        dia: diaNome,
        materiasDoDia: dia.materiasDoDia,
        blocos: dia.blocos,
      });
    }

    agenda.push({
      numero: s,
      foco: retaFinal
        ? "Reta final: questões, revisão e correção ativa"
        : "Distribuição por prioridade, dificuldade e desempenho",
      materiasDaSemana: Object.entries(weekCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m),
      dias,
    });
  }

  const prioridades = materias.slice(0, 6);
  const intensidade =
    diasRestantes !== null && diasRestantes <= 30
      ? "Operação Reta Final"
      : diasRestantes !== null && diasRestantes <= 90
      ? "Missão 90 Dias"
      : "Construção de Base";

  const ciclosPorDia = Math.max(2, Math.min(Math.floor((horasDia * 60) / 30), 10));
  const totalPomodoros = agenda.reduce(
    (acc, semana) =>
      acc +
      semana.dias.reduce(
        (a, dia) => a + dia.blocos.filter((b) => b.tipo === "pomodoro").length,
        0
      ),
    0
  );

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
      "Caderno de erros: toda questão errada deve virar anotação objetiva com motivo do erro.",
    ],
    alertas: [
      dados.trabalha === "Sim"
        ? "Como você trabalha, o plano usa Pomodoros para reduzir atrito e manter constância."
        : "Use sua disponibilidade para elevar volume de questões sem abandonar revisão.",
      String(dados.nivel).toLowerCase().includes("iniciante")
        ? "Como iniciante, o sistema reforça base, leitura ativa e questões fundamentais."
        : "Como você já tem base, o plano aumenta questões, correção ativa e simulados curtos.",
      "A distribuição prioriza os assuntos em que você declarou mais dificuldade, sem abandonar as disciplinas de manutenção.",
      "Inclua treino físico fora do cronograma teórico, especialmente 2 a 4 vezes por semana.",
    ],
  };
}

function renderTopbar(activePage = "") {
  return `
  <header class="topbar">
    <a class="brand" href="/">
      <span class="crest">MF</span>
      <span><strong>MISSÃO FARDA</strong><small>CRIS ANDRADE</small></span>
    </a>
    <nav id="mainNav">
      <a href="/#plano">Gerar plano</a>
      <a href="/#materiais">Materiais</a>
      <a href="/#dicas">Dicas do edital</a>
      <a href="/minha-area"${activePage==="area"?' class="nav-highlight"':""}>Minha Área</a>
      <a href="/curso"${activePage==="curso"?' class="nav-highlight"':""}>Curso completo</a>
      <span id="adminNavWrap" hidden><a href="/admin">Admin</a></span>
      <button type="button" class="logout-link" id="logoutBtn">Sair</button>
    </nav>
    <button class="hamburger" id="hamburgerBtn" aria-label="Abrir menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </header>
  <div class="mobile-nav-overlay" id="mobileOverlay"></div>
  <nav class="mobile-nav" id="mobileNav" aria-hidden="true">
    <div class="mobile-nav-header">
      <span class="crest" style="width:38px;height:38px;font-size:14px;">MF</span>
      <button class="mobile-nav-close" id="mobileNavClose" aria-label="Fechar menu">✕</button>
    </div>
    <a href="/#plano">Gerar plano</a>
    <a href="/#materiais">Materiais</a>
    <a href="/#dicas">Dicas do edital</a>
    <a href="/minha-area"${activePage==="area"?' class="active"':""}>Minha Área</a>
    <a href="/curso"${activePage==="curso"?' class="active"':""}>Curso completo</a>
    <span id="adminMobileWrap" hidden><a href="/admin">Admin</a></span>
    <button type="button" class="mobile-logout" id="mobileLogoutBtn">Sair da conta</button>
  </nav>
  <script>
    (function(){
      var h=document.getElementById('hamburgerBtn'),
          n=document.getElementById('mobileNav'),
          o=document.getElementById('mobileOverlay'),
          c=document.getElementById('mobileNavClose');
      function open(){n.classList.add('open');o.classList.add('show');h.setAttribute('aria-expanded','true');n.setAttribute('aria-hidden','false');}
      function close(){n.classList.remove('open');o.classList.remove('show');h.setAttribute('aria-expanded','false');n.setAttribute('aria-hidden','true');}
      h.addEventListener('click',open);c.addEventListener('click',close);o.addEventListener('click',close);
      n.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
      async function logout(){await fetch('/logout',{method:'POST'});window.location.href='/login';}
      document.getElementById('logoutBtn').addEventListener('click',logout);
      document.getElementById('mobileLogoutBtn').addEventListener('click',logout);
      fetch('/me').then(function(r){return r.ok?r.json():null;}).then(function(u){
        if(u&&u.role==='admin'){
          document.getElementById('adminNavWrap').removeAttribute('hidden');
          document.getElementById('adminMobileWrap').removeAttribute('hidden');
        }
      });
    })();
  </script>`;
}

const MIKE_URL = "https://pay.cakto.com.br/33krayz?affiliate=s7XUk8bn";
const MIKE_COUPON = "Cris15";

function renderCursoPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preparatório PMBA — Manual do Mike · Missão Farda</title>
  <link rel="stylesheet" href="/styles.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .mike { font-family: 'Segoe UI', sans-serif; color: var(--text); }

    /* Hero */
    .mk-hero {
      position: relative; overflow: hidden; min-height: 620px;
      display: flex; align-items: center; padding: 80px 48px;
      background:
        linear-gradient(110deg, rgba(4,6,5,.98) 0%, rgba(4,6,5,.85) 50%, rgba(4,6,5,.45) 100%),
        url('/assets/hero-1.jpeg') center / cover;
      border-bottom: 1px solid var(--line);
    }
    .mk-hero-inner { max-width: 680px; position: relative; z-index: 1; }
    .mk-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 999px;
      background: linear-gradient(135deg, var(--gold-3), var(--gold));
      color: #16110a; font-size: 11px; font-weight: 900;
      letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 24px;
    }
    .mk-hero h1 {
      font-family: Georgia, serif;
      font-size: clamp(42px, 6vw, 78px);
      line-height: .92; color: white; margin-bottom: 6px;
    }
    .mk-hero h1 em {
      display: block; font-style: italic; font-weight: 400;
      color: var(--gold-3); font-size: clamp(36px, 5vw, 64px);
    }
    .mk-hero-sub {
      font-size: 18px; color: #ddd5c9; line-height: 1.7;
      margin: 22px 0 36px; max-width: 560px;
    }
    .mk-hero-sub strong { color: var(--gold-3); }
    .mk-btn-gold {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 20px 32px; border-radius: 14px; border: none;
      background: linear-gradient(135deg, var(--gold-3), var(--gold));
      color: #16110a; font-family: Georgia, serif;
      font-size: 18px; font-weight: 900; text-decoration: none;
      cursor: pointer; box-shadow: 0 12px 36px rgba(217,168,78,.35);
      transition: var(--transition);
    }
    .mk-btn-gold:hover { filter: brightness(1.08); transform: translateY(-3px); }
    .mk-coupon-chip {
      display: inline-flex; flex-direction: column;
      padding: 12px 18px; border: 1px dashed var(--line-strong);
      border-radius: 13px; background: rgba(217,168,78,.07);
    }
    .mk-coupon-chip small { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
    .mk-coupon-chip strong { font-size: 24px; color: var(--gold-3); letter-spacing: 3px; font-family: Georgia, serif; }
    .mk-coupon-chip span { font-size: 11px; color: var(--gold); margin-top: 2px; }
    .mk-cta-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

    /* wrap */
    .mk-wrap { max-width: 1140px; margin: 0 auto; padding: 0 48px; }

    /* sections */
    .mk-section { padding: 60px 0; border-bottom: 1px solid var(--line-soft); }
    .mk-eyebrow {
      font-size: 11px; font-weight: 900; letter-spacing: 2px;
      text-transform: uppercase; color: var(--gold); margin-bottom: 10px;
    }
    .mk-h2 {
      font-family: Georgia, serif; font-size: clamp(26px, 3.5vw, 42px);
      color: var(--gold-3); line-height: 1.1; margin-bottom: 14px;
    }
    .mk-lead { color: var(--muted); font-size: 16px; line-height: 1.7; max-width: 640px; }

    /* Proof bar */
    .mk-proof-bar {
      display: flex; align-items: center; justify-content: center;
      flex-wrap: wrap;
      background: linear-gradient(135deg, rgba(217,168,78,.1), rgba(217,168,78,.04));
      border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
      padding: 22px 48px;
    }
    .mk-proof-item {
      display: flex; flex-direction: column; align-items: center;
      padding: 14px 36px; text-align: center;
    }
    .mk-proof-item + .mk-proof-item { border-left: 1px solid var(--line); }
    .mk-proof-item strong { font-family: Georgia, serif; font-size: 36px; color: var(--gold-3); line-height: 1; }
    .mk-proof-item span { font-size: 12px; color: var(--muted); margin-top: 4px; }

    /* Includes */
    .mk-includes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; }
    .mk-inc-card {
      padding: 26px 22px; border: 1px solid var(--line); border-radius: 18px;
      background: linear-gradient(145deg, rgba(18,22,20,.9), rgba(10,12,11,.95));
      transition: var(--transition);
    }
    .mk-inc-card:hover { border-color: var(--line-strong); transform: translateY(-3px); }
    .mk-inc-card .ico { font-size: 32px; display: block; margin-bottom: 14px; }
    .mk-inc-card h3 { font-family: Georgia, serif; font-size: 17px; color: var(--gold-3); margin-bottom: 8px; }
    .mk-inc-card p { color: var(--muted); font-size: 14px; line-height: 1.6; }
    .mk-inc-tag {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      background: rgba(217,168,78,.12); color: var(--gold);
      font-size: 10px; font-weight: 800; letter-spacing: .8px;
      text-transform: uppercase; margin-bottom: 10px;
    }

    /* Testimonials */
    .mk-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; }
    .mk-testi {
      padding: 28px 24px; border: 1px solid var(--line); border-radius: 18px;
      background: linear-gradient(145deg, rgba(15,19,17,.95), rgba(8,10,9,.98));
      display: flex; flex-direction: column; gap: 16px;
    }
    .mk-testi-stars { color: var(--gold-3); font-size: 18px; letter-spacing: 2px; }
    .mk-testi blockquote { color: #ddd5c9; font-size: 14.5px; line-height: 1.75; font-style: italic; flex: 1; }
    .mk-testi-author {
      display: flex; align-items: center; gap: 12px;
      padding-top: 14px; border-top: 1px solid var(--line-soft);
    }
    .mk-testi-avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: linear-gradient(135deg, var(--gold-3), var(--gold));
      display: grid; place-items: center;
      font-family: Georgia, serif; font-size: 17px; color: #16110a; font-weight: 900; flex-shrink: 0;
    }
    .mk-testi-name strong { display: block; color: var(--text); font-size: 14px; }
    .mk-testi-name span { color: var(--gold); font-size: 12px; font-weight: 700; }

    /* Guarantee */
    .mk-guarantee {
      display: flex; align-items: center; gap: 32px;
      padding: 36px 40px; border: 1px solid var(--gold);
      border-radius: 20px; margin-top: 32px; background: rgba(217,168,78,.05);
    }
    .mk-guarantee-icon { font-size: 56px; flex-shrink: 0; }
    .mk-guarantee h3 { font-family: Georgia, serif; font-size: 22px; color: var(--gold-3); margin-bottom: 8px; }
    .mk-guarantee p { color: var(--muted); font-size: 15px; line-height: 1.7; }

    /* FAQ */
    .mk-faq { margin-top: 32px; display: flex; flex-direction: column; gap: 10px; }
    .mk-faq-item { border: 1px solid var(--line); border-radius: 14px; background: rgba(12,15,13,.85); overflow: hidden; }
    .mk-faq-q {
      width: 100%; text-align: left; padding: 18px 22px;
      background: none; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      color: var(--text); font-size: 15px; font-weight: 700;
    }
    .mk-faq-q .arrow { color: var(--gold); font-size: 18px; transition: transform .25s; flex-shrink: 0; }
    .mk-faq-a { max-height: 0; overflow: hidden; transition: max-height .35s ease; color: var(--muted); font-size: 14.5px; line-height: 1.75; }
    .mk-faq-a-inner { padding: 0 22px 18px; }
    .mk-faq-item.open .mk-faq-q .arrow { transform: rotate(180deg); }
    .mk-faq-item.open .mk-faq-a { max-height: 300px; }

    /* Final CTA */
    .mk-final { padding: 70px 0 80px; text-align: center; }
    .mk-final h2 { font-family: Georgia, serif; font-size: clamp(32px, 5vw, 58px); color: white; line-height: 1; margin-bottom: 10px; }
    .mk-final h2 em { color: var(--gold-3); font-style: italic; }
    .mk-final p { color: var(--muted); font-size: 16px; line-height: 1.7; max-width: 540px; margin: 14px auto 36px; }
    .mk-final .mk-coupon-chip { margin: 28px auto 0; display: inline-flex; flex-direction: row; align-items: center; gap: 16px; }
    .mk-final .mk-coupon-chip small { margin: 0; }

    /* Footer */
    .mk-foot {
      margin: 0 48px 48px; padding: 20px 28px;
      border: 1px solid var(--line); border-radius: 14px; background: rgba(8,10,9,.8);
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    }
    .mk-foot strong { font-family: Georgia, serif; color: var(--gold-3); letter-spacing: 1px; }
    .mk-foot a { color: var(--muted); font-size: 13px; text-decoration: none; }
    .mk-foot a:hover { color: var(--gold-2); }

    /* Responsive */
    @media (max-width: 960px) {
      .mk-hero { padding: 56px 24px; min-height: auto; }
      .mk-wrap { padding: 0 24px; }
      .mk-includes-grid { grid-template-columns: 1fr 1fr; }
      .mk-testimonials-grid { grid-template-columns: 1fr; }
      .mk-proof-bar { padding: 16px 24px; }
      .mk-proof-item { padding: 12px 20px; }
      .mk-guarantee { flex-direction: column; text-align: center; padding: 28px 24px; }
      .mk-foot { margin: 0 24px 32px; }
    }
    @media (max-width: 640px) {
      .mk-includes-grid { grid-template-columns: 1fr; }
      .mk-cta-row { flex-direction: column; align-items: stretch; }
      .mk-btn-gold { justify-content: center; }
      .mk-proof-bar { flex-direction: column; }
      .mk-proof-item + .mk-proof-item { border-left: none; border-top: 1px solid var(--line); }
      .mk-final .mk-coupon-chip { flex-direction: column; }
    }
  </style>
</head>
<body>
  ${renderTopbar("curso")}
  <div class="mike">

  <!-- HERO -->
  <section class="mk-hero">
    <div class="mk-hero-inner">
      <div class="mk-badge">✦ Preparatório PMBA</div>
      <h1>DO ZERO À<em>APROVAÇÃO</em></h1>
      <p class="mk-hero-sub">
        O preparatório mais completo das carreiras policiais,
        <strong>criado por quem veste a farda</strong>. Método, estratégia e
        acompanhamento do início ao fim — focado em SD PMBA e CFO PMBA.
      </p>
      <div class="mk-cta-row">
        <a class="mk-btn-gold" href="https://pay.cakto.com.br/33krayz?affiliate=s7XUk8bn" target="_blank" rel="noopener">
          COMEÇAR MINHA PREPARAÇÃO →
        </a>
        <div class="mk-coupon-chip">
          <small>Cupom de desconto</small>
          <strong>Cris15</strong>
          <span>Use no checkout</span>
        </div>
      </div>
    </div>
  </section>

  <!-- PROOF BAR -->
  <div class="mk-proof-bar">
    <div class="mk-proof-item"><strong>40.000+</strong><span>Questões no banco</span></div>
    <div class="mk-proof-item"><strong>100</strong><span>Dias de mentoria coletiva</span></div>
    <div class="mk-proof-item"><strong>12x</strong><span>Parcelas sem juros</span></div>
    <div class="mk-proof-item"><strong>7 dias</strong><span>Garantia incondicional</span></div>
    <div class="mk-proof-item"><strong>FCC</strong><span>Foco total na banca</span></div>
  </div>

  <div class="mk-wrap">

    <!-- O QUE É -->
    <div class="mk-section">
      <p class="mk-eyebrow">O preparatório</p>
      <h2 class="mk-h2">O Manual do Mike para o concurso PMBA</h2>
      <p class="mk-lead">
        O <strong style="color:var(--gold-3)">Preparatório PMBA – Manual do Mike</strong> é um
        curso anual completo e atualizado, criado com foco total nos padrões reais de cobrança da
        banca FCC. Aqui você não perde tempo com conteúdo irrelevante: cada aula é estruturada com
        base no que realmente cai na prova — da teoria às questões, da redação à estratégia.
      </p>
      <p class="mk-lead" style="margin-top:14px;">
        Combinado com a <strong style="color:var(--gold-3)">plataforma Missão Farda</strong>,
        que gera seu cronograma Pomodoro personalizado, você terá uma preparação completa e
        inteligente do zero à aprovação.
      </p>
    </div>

    <!-- INCLUDES -->
    <div class="mk-section">
      <p class="mk-eyebrow">O que está incluso</p>
      <h2 class="mk-h2">Tudo o que você precisa em um só lugar</h2>
      <p class="mk-lead">Preparação completa — conteúdo, prática, redação, estratégia e acompanhamento.</p>
      <div class="mk-includes-grid">
        <div class="mk-inc-card">
          <span class="mk-inc-tag">Conteúdo</span>
          <span class="ico">📖</span>
          <h3>Curso Preparatório Anual Atualizado</h3>
          <p>Aulas por disciplina com foco nos tópicos de maior peso e frequência na FCC — da teoria ao raciocínio jurídico.</p>
        </div>
        <div class="mk-inc-card">
          <span class="mk-inc-tag">Acompanhamento</span>
          <span class="ico">🎯</span>
          <h3>Mentoria Coletiva 100 Dias</h3>
          <p>Aulas ao vivo semanais durante 100 dias de imersão total. Dúvidas respondidas, ritmo mantido e constância garantida.</p>
        </div>
        <div class="mk-inc-card">
          <span class="mk-inc-tag">Prática</span>
          <span class="ico">📝</span>
          <h3>Banco de 40.000+ Questões</h3>
          <p>Questões comentadas por disciplina e nível, com análise das alternativas e padrão FCC de eliminação.</p>
        </div>
        <div class="mk-inc-card">
          <span class="mk-inc-tag">IA</span>
          <span class="ico">🤖</span>
          <h3>RedaMike IA — Correção de Redação</h3>
          <p>Inteligência artificial que corrige sua redação dissertativa com os critérios reais da banca, em segundos.</p>
        </div>
        <div class="mk-inc-card">
          <span class="mk-inc-tag">Simulados</span>
          <span class="ico">⏱️</span>
          <h3>Simulados por Edital</h3>
          <p>Treinos com o mesmo formato, quantidade de questões e tempo da prova real — para você chegar preparada no dia.</p>
        </div>
        <div class="mk-inc-card">
          <span class="mk-inc-tag">Suporte</span>
          <span class="ico">💬</span>
          <h3>Suporte Completo</h3>
          <p>Acesso ao suporte durante toda a preparação. Dúvidas sobre conteúdo, plataforma ou estratégia — respondidas.</p>
        </div>
      </div>
    </div>

    <!-- TESTIMONIALS -->
    <div class="mk-section">
      <p class="mk-eyebrow">Resultados reais</p>
      <h2 class="mk-h2">Quem estudou, aprovou</h2>
      <p class="mk-lead">Com dedicação e constância nos estudos, candidatas chegam à aprovação.</p>
      <div class="mk-testimonials-grid">
        <div class="mk-testi">
          <div class="mk-testi-stars">★★★★★</div>
          <blockquote>"Com dedicação e constância nos estudos, alcancei minha aprovação. O método faz toda a diferença — você sabe exatamente o que estudar e como priorizar."</blockquote>
          <div class="mk-testi-author">
            <div class="mk-testi-avatar">L</div>
            <div class="mk-testi-name"><strong>Lavínia</strong><span>✦ APROVADA</span></div>
          </div>
        </div>
        <div class="mk-testi">
          <div class="mk-testi-stars">★★★★★</div>
          <blockquote>"O banco de questões e as aulas ao vivo foram fundamentais. Cada aula me deixava mais segura sobre o que a banca realmente cobra. Fui aprovado!"</blockquote>
          <div class="mk-testi-author">
            <div class="mk-testi-avatar">J</div>
            <div class="mk-testi-name"><strong>Jozimar</strong><span>✦ APROVADO</span></div>
          </div>
        </div>
        <div class="mk-testi">
          <div class="mk-testi-stars">★★★★★</div>
          <blockquote>"Nunca pensei que conseguiria em tão pouco tempo. A metodologia de engenharia reversa da banca é real — você estuda o que vai cair, sem desperdício."</blockquote>
          <div class="mk-testi-author">
            <div class="mk-testi-avatar">M</div>
            <div class="mk-testi-name"><strong>Monizi</strong><span>✦ APROVADA</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- GUARANTEE -->
    <div class="mk-section">
      <p class="mk-eyebrow">Sem riscos</p>
      <h2 class="mk-h2">Garantia incondicional de 7 dias</h2>
      <div class="mk-guarantee">
        <div class="mk-guarantee-icon">🛡️</div>
        <div>
          <h3>Compre sem medo</h3>
          <p>Se em até <strong style="color:var(--gold-3)">7 dias corridos</strong> após a compra você
          não ficar satisfeita com o preparatório, basta solicitar o reembolso e devolvemos
          <strong style="color:var(--gold-3)">100% do valor pago</strong> — sem burocracia,
          sem perguntas. Você não tem nada a perder, só a aprovação a ganhar.</p>
        </div>
      </div>
    </div>

    <!-- FAQ -->
    <div class="mk-section">
      <p class="mk-eyebrow">Dúvidas frequentes</p>
      <h2 class="mk-h2">Perguntas e respostas</h2>
      <div class="mk-faq">
        <div class="mk-faq-item">
          <button class="mk-faq-q">Quando recebo acesso após a compra?<span class="arrow">▾</span></button>
          <div class="mk-faq-a"><div class="mk-faq-a-inner">O acesso é liberado imediatamente após a confirmação do pagamento, independente da forma escolhida — PIX, transferência ou cartão de crédito.</div></div>
        </div>
        <div class="mk-faq-item">
          <button class="mk-faq-q">O curso é indicado para quem está começando do zero?<span class="arrow">▾</span></button>
          <div class="mk-faq-a"><div class="mk-faq-a-inner">Sim. O preparatório atende desde iniciantes até candidatos avançados. As aulas são organizadas de forma progressiva com base nos padrões da FCC.</div></div>
        </div>
        <div class="mk-faq-item">
          <button class="mk-faq-q">Posso assistir as aulas quantas vezes quiser?<span class="arrow">▾</span></button>
          <div class="mk-faq-a"><div class="mk-faq-a-inner">Sim. Durante todo o período de acesso você pode rever qualquer aula sem limite de visualizações.</div></div>
        </div>
        <div class="mk-faq-item">
          <button class="mk-faq-q">Quais formas de pagamento são aceitas?<span class="arrow">▾</span></button>
          <div class="mk-faq-a"><div class="mk-faq-a-inner">PIX, transferência bancária e cartão de crédito em até 12 parcelas. Use o cupom <strong style="color:var(--gold-3)">Cris15</strong> no checkout para garantir seu desconto exclusivo.</div></div>
        </div>
        <div class="mk-faq-item">
          <button class="mk-faq-q">O preparatório cobre SD PMBA e CFO PMBA?<span class="arrow">▾</span></button>
          <div class="mk-faq-a"><div class="mk-faq-a-inner">Sim. O curso cobre os dois cargos com conteúdo organizado por edital, focado no que realmente cai na prova da FCC para ambos.</div></div>
        </div>
      </div>
    </div>

  </div><!-- /mk-wrap -->

  <!-- FINAL CTA -->
  <div class="mk-final">
    <h2>PRONTA PARA A<br><em>MISSÃO?</em></h2>
    <p>Garanta agora o acesso ao Preparatório PMBA – Manual do Mike e use o cupom exclusivo
    <strong style="color:var(--gold-3)">Cris15</strong> para o desconto no checkout.</p>
    <a class="mk-btn-gold" href="https://pay.cakto.com.br/33krayz?affiliate=s7XUk8bn" target="_blank" rel="noopener">
      GARANTIR MINHA APROVAÇÃO →
    </a>
    <div class="mk-coupon-chip">
      <small>Cupom exclusivo Missão Farda</small>
      <strong>Cris15</strong>
      <span>↑ Copie e cole no checkout</span>
    </div>
  </div>

  </div><!-- /mike -->

  <footer class="mk-foot">
    <strong>MISSÃO FARDA — CRIS ANDRADE</strong>
    <a href="/">← Voltar à plataforma</a>
  </footer>

  <script>
    document.querySelectorAll('.mk-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.mk-faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.mk-faq-item.open').forEach(el => el.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  </script>

</body>
</html>`;
}

function renderPlanoPage(dados, plano) {
  const agendaHtml = plano.agenda
    .map(
      (semana) => `
    <section class="week-card">
      <div class="week-head">
        <div>
          <span>Semana ${semana.numero}</span>
          <strong>${escapeHtml(semana.foco)}</strong>
        </div>
        <small>${semana.materiasDaSemana
          .slice(0, 4)
          .map(escapeHtml)
          .join(" • ")}</small>
      </div>
      <div class="days-grid">
        ${semana.dias
          .map(
            (dia) => `
          <article class="day-card">
            <h4>${escapeHtml(dia.dia)}</h4>
            <p class="day-focus">${dia.materiasDoDia
              .map((m) => `<span>${escapeHtml(m)}</span>`)
              .join("")}</p>
            <ul class="pomodoro-list">
              ${dia.blocos
                .map((bloco) =>
                  bloco.tipo === "pausa"
                    ? `
                <li class="break-line"><b>${escapeHtml(bloco.titulo)}</b> — ${escapeHtml(
                        bloco.tempo
                      )}: ${escapeHtml(bloco.assunto)}</li>
              `
                    : `
                <li>
                  <b>${escapeHtml(bloco.titulo)}</b> <em>${escapeHtml(bloco.tempo)}</em><br>
                  <span>${escapeHtml(bloco.materia)}</span> — ${escapeHtml(bloco.assunto)}<br>
                  <small>Missão: ${escapeHtml(bloco.tarefa)}${
                        bloco.categoria ? " • " + escapeHtml(bloco.categoria) : ""
                      }</small>
                </li>
              `
                )
                .join("")}
            </ul>
          </article>
        `
          )
          .join("")}
      </div>
    </section>
  `
    )
    .join("");

  const maxPeso = Math.max(...Object.values(plano.edital.pesos));

  const distribuicao = plano.prioridades
    .map((m) => {
      const peso = plano.edital.pesos[m] || 5;
      const pct = Math.min(100, Math.round((peso / maxPeso) * 100));
      return `<div class="bar-row"><span>${escapeHtml(m)}</span><div><i style="width:${pct}%"></i></div><b>${peso}</b></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plano gerado — Missão Farda</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="result-page">
  ${renderTopbar()}
  <div style="display:flex;justify-content:flex-end;padding:8px 36px 0;">
    <button onclick="window.print()" class="btn small">Salvar PDF</button>
  </div>

  <main class="result-wrap">
    <section class="pdf-cover glass">
      <p class="eyebrow">Missão Farda — Cris Andrade</p>
      <h1>Plano de Estudos Personalizado</h1>
      <div class="pdf-meta-grid">
        <div><span>Aluna</span><strong>${escapeHtml(dados.nome || "Não informado")}</strong></div>
        <div><span>Concurso</span><strong>${escapeHtml(plano.edital.nome)}</strong></div>
        <div><span>Data da prova</span><strong>${escapeHtml(dados.dataProva || "-")}</strong></div>
        <div><span>Dias restantes</span><strong>${plano.diasRestantes ?? "-"}</strong></div>
        <div><span>Carga semanal</span><strong>${plano.cargaSemanal}h</strong></div>
        <div><span>Pomodoros totais</span><strong>${plano.totalPomodoros}</strong></div>
        <div><span>Modelo</span><strong>25min foco + 5min pausa</strong></div>
      </div>
    </section>

    <section class="result-hero glass">
      <div>
        <p class="eyebrow">Plano gerado para ${escapeHtml(dados.nome || "aluna")}</p>
        <h1>${escapeHtml(plano.intensidade)} — ${escapeHtml(plano.edital.nome)}</h1>
        <p>${escapeHtml(plano.edital.subtitulo)} • ${plano.diasRestantes ?? "-"} dias até a prova • ${plano.cargaSemanal}h por semana • ${plano.totalPomodoros} Pomodoros planejados</p>
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
        <ol>${plano.prioridades.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ol>
      </div>
      <div class="glass panel">
        <h2>Revisões</h2>
        <ul>${plano.revisoes.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </div>
      <div class="glass panel">
        <h2>Alertas táticos</h2>
        <ul>${plano.alertas.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="glass panel diagnosis-box">
      <h2>Diagnóstico da estratégia</h2>
      <div class="diagnosis-grid">
        <div><span>Nível informado</span><strong>${escapeHtml(dados.nivel || "Não informado")}</strong></div>
        <div><span>Dificuldades priorizadas</span><strong>${normalizeArray(dados.dificuldades)
          .map(escapeHtml)
          .join(" • ") || "Nenhuma informada"}</strong></div>
        <div><span>Facilidades em manutenção</span><strong>${normalizeArray(dados.facilidades)
          .map(escapeHtml)
          .join(" • ") || "Nenhuma informada"}</strong></div>
      </div>
      <p>
        O cronograma distribui os assuntos de maior dificuldade com mais frequência e mantém as matérias dominadas em ciclos de revisão para evitar esquecimento.
      </p>
    </section>

    <section class="glass panel edital-box">
      <h2>Resumo do edital selecionado</h2>
      <div class="edital-summary">
        <div><span>Tipo</span><strong>${escapeHtml(plano.edital.tipo)}</strong></div>
        <div><span>Duração</span><strong>${escapeHtml(plano.edital.duracao)}</strong></div>
        <div><span>Estratégia</span><strong>${escapeHtml(plano.edital.notaAlerta)}</strong></div>
      </div>
      <ul class="two-col-list">${plano.edital.prova.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>

    <section class="result-grid two-one">
      <div class="glass panel">
        <h2>Distribuição por peso</h2>
        <div class="bars">${distribuicao}</div>
      </div>
      <div class="glass panel">
        <h2>Técnica Pomodoro usada</h2>
        <p>
          O sistema usa ciclos de <strong>25 minutos de foco + 5 minutos de pausa</strong>.
          A distribuição considera o nível atual, as dificuldades marcadas e o peso das disciplinas no edital.
          Cada bloco alterna teoria, questões e revisão conforme a necessidade do aluno.
        </p>
      </div>
    </section>

    <section class="glass panel subjects">
      <h2>Assuntos do edital usados no plano</h2>
      <div class="subject-list">
        ${Object.entries(plano.edital.materias)
          .map(
            ([materia, assuntos]) => `
          <details>
            <summary>${escapeHtml(materia)} <span>${assuntos.length} assuntos</span></summary>
            <p>${assuntos.map(escapeHtml).join(" • ")}</p>
          </details>
        `
          )
          .join("")}
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
</body>
</html>`;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/curso", (req, res) => {
  res.send(renderCursoPage());
});

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "missao-farda" });
});

app.get("/leads", (req, res) => {
  res.json(readLeads());
});

app.post("/salvar-lead", (req, res) => {
  const dados = normalizeLeadBody(req.body);
  const errors = validateLead(dados);

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: "Corrija os campos obrigatórios.",
      errors,
    });
  }

  try {
    const record = saveLead(dados, req);

    return res.json({
      success: true,
      message: "Dados enviados com sucesso!",
      id: record.id,
    });
  } catch (err) {
    console.error("Erro ao salvar lead:", err);
    return res.status(500).json({
      success: false,
      message: "Não foi possível salvar os dados agora.",
    });
  }
});

app.post("/gerar-plano", (req, res) => {
  const dados = normalizeLeadBody(req.body);
  const errors = validateLead(dados);

  if (errors.length) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Erro no envio</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body style="padding:24px;">
        <main class="glass" style="max-width:800px;margin:0 auto;padding:24px;border-radius:24px;">
          <h1>Falha ao gerar o plano</h1>
          <p>Corrija os campos abaixo e tente novamente:</p>
          <ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
          <a class="submit-btn" href="/">Voltar</a>
        </main>
      </body>
      </html>
    `);
  }

  try {
    const plano = gerarPlano(dados);
    const record = saveLead(dados, req, plano);

    const wantsJson =
      (req.headers.accept || "").includes("application/json") || req.query.format === "json";

    if (wantsJson) {
      return res.json({
        success: true,
        message: "Plano recebido com sucesso!",
        leadId: record.id,
        plano,
      });
    }

    return res.send(renderPlanoPage(dados, plano));
  } catch (err) {
    console.error("Erro ao gerar plano:", err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Erro interno</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body style="padding:24px;">
        <main class="glass" style="max-width:800px;margin:0 auto;padding:24px;border-radius:24px;">
          <h1>Erro interno</h1>
          <p>Ocorreu um problema ao processar seu formulário.</p>
          <a class="submit-btn" href="/">Voltar</a>
        </main>
      </body>
      </html>
    `);
  }
});

app.use((req, res) => {
  if (req.accepts("html")) {
    return res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
  return res.status(404).json({ success: false, message: "Rota não encontrada." });
});

// ── Startup assíncrono ────────────────────────────────────────────────────────
(async () => {
  ensureDirectories();

  // 1. Conecta ao MongoDB (se MONGODB_URI definido)
  await connectMongo();

  // 2. Carrega dados persistentes na memória
  _usersCache   = await loadUsersFromStorage();
  _invitesCache = await loadInvitesFromStorage();
  _avisosCache  = await loadAvisosFromStorage();

  // 3. Garante que existe pelo menos um admin
  seedAdminUser();

  // 4. Inicia o servidor
  app.listen(PORT, () => {
    console.log(`Missão Farda rodando em http://localhost:${PORT}`);
  });
})();
