const statusConfig = [
  { key: "Projetado", color: "#2f7ee8", icon: "▤" },
  { key: "Em desenvolvimento", color: "#f2a900", icon: "▤" },
  { key: "Em revisão", color: "#f26b21", icon: "▤" },
  { key: "Concluído", color: "#13a66b", icon: "▤" },
  { key: "Encaminhado", color: "#7c48c8", icon: "▤" },
  { key: "Aceito", color: "#10a66d", icon: "▤" },
  { key: "Publicado", color: "#169bd5", icon: "▤" },
];

const STORAGE_KEY = "scitrack:articles:v2";
const API_BASE = "http://127.0.0.1:8090/api";

let articles = loadArticles();
let backendOnline = false;

const elements = {
  statsGrid: document.querySelector("#statsGrid"),
  kanbanBoard: document.querySelector("#kanbanBoard"),
  statusFilter: document.querySelector("#statusFilter"),
  studentFilter: document.querySelector("#studentFilter"),
  periodFilter: document.querySelector("#periodFilter"),
  searchInput: document.querySelector("#searchInput"),
  statusDonut: document.querySelector("#statusDonut"),
  totalArticles: document.querySelector("#totalArticles"),
  statusLegend: document.querySelector("#statusLegend"),
  studentBars: document.querySelector("#studentBars"),
  recentTable: document.querySelector("#recentTable"),
  deadlineList: document.querySelector("#deadlineList"),
  alertList: document.querySelector("#alertList"),
  aiSummary: document.querySelector("#aiSummary"),
  notificationBadge: document.querySelector("#notificationBadge"),
  dialog: document.querySelector("#articleDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  form: document.querySelector("#articleForm"),
  formStatus: document.querySelector("#formStatus"),
  deleteArticleButton: document.querySelector("#deleteArticleButton"),
  touchArticleButton: document.querySelector("#touchArticleButton"),
  advanceArticleButton: document.querySelector("#advanceArticleButton"),
};

let currentSection = "dashboard";

init();

async function init() {
  hydrateSelects();
  bindEvents();
  await syncFromBackend();
  updateStudentFilter();
  render();
}

function loadArticles() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored).map(normalizeArticleFromApi);
  } catch {
    return [];
  }
}

function saveArticles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

async function syncFromBackend() {
  try {
    const response = await fetch(`${API_BASE}/articles`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    articles = (await response.json()).map(normalizeArticleFromApi);
    backendOnline = true;
    saveArticles();
  } catch {
    backendOnline = false;
    articles = loadArticles();
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
  backendOnline = true;
  return response.status === 204 ? null : response.json();
}

function normalizeArticleFromApi(article) {
  return {
    ...article,
    status: normalizeLegacyText(article.status),
    course: normalizeLegacyText(article.course),
    level: normalizeLegacyText(article.level),
    area: normalizeLegacyText(article.area),
    type: normalizeLegacyText(article.type),
    nextAction: normalizeLegacyText(article.nextAction || article.next_action || ""),
    venue: normalizeLegacyText(article.venue),
    notes: normalizeLegacyText(article.notes),
    lastUpdate: article.lastUpdate || article.last_update || toInputDate(new Date()),
  };
}

function normalizeLegacyText(value) {
  const replacements = {
    "Em revisÃ£o": "Em revisão",
    "ConcluÃ­do": "Concluído",
    "CiÃªncia da ComputaÃ§Ã£o": "Ciência da Computação",
    "GraduaÃ§Ã£o": "Graduação",
    "CapÃ­tulo": "Capítulo",
  };
  return replacements[value] || value || "";
}

function upsertArticleLocal(article) {
  const normalized = normalizeArticleFromApi(article);
  const exists = articles.some((item) => item.id === normalized.id);
  articles = exists
    ? articles.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...articles];
  saveArticles();
}

function hydrateSelects() {
  statusConfig.forEach((status) => {
    elements.statusFilter.add(new Option(status.key, status.key));
    elements.formStatus.add(new Option(status.key, status.key));
  });
  updateStudentFilter();
}

function updateStudentFilter() {
  const current = elements.studentFilter.value || "todos";
  elements.studentFilter.replaceChildren(new Option("Todos", "todos"));
  getStudents().forEach((student) => elements.studentFilter.add(new Option(student, student)));
  elements.studentFilter.value = getStudents().includes(current) ? current : "todos";
}

function bindEvents() {
  ["input", "change"].forEach((eventName) => {
    elements.searchInput.addEventListener(eventName, render);
    elements.statusFilter.addEventListener(eventName, render);
    elements.studentFilter.addEventListener(eventName, render);
    elements.periodFilter.addEventListener(eventName, render);
  });

  document.querySelector("#newArticleButton").addEventListener("click", () => {
    openArticleDialog();
  });

  document.querySelector("#closeDialogButton").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#cancelDialogButton").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#refreshSummaryButton").addEventListener("click", () => renderAiSummary(filteredArticles()));


  document.querySelector("#expandKanbanButton").addEventListener("click", (event) => {
    document.body.classList.toggle("kanban-expanded");
    event.currentTarget.textContent = document.body.classList.contains("kanban-expanded")
      ? "Voltar ao dashboard"
      : "Ver quadro completo";
  });

  document.querySelector("#exportButton").addEventListener("click", exportCsv);

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.form);
    const id = clean(formData.get("id"));
    const payload = {
      id: id || crypto.randomUUID(),
      title: clean(formData.get("title")),
      student: clean(formData.get("student")),
      course: clean(formData.get("course")),
      level: clean(formData.get("level")),
      area: clean(formData.get("area")),
      type: clean(formData.get("type")),
      status: clean(formData.get("status")),
      nextAction: clean(formData.get("nextAction")),
      deadline: clean(formData.get("deadline")),
      venue: clean(formData.get("venue")),
      notes: clean(formData.get("notes")),
      lastUpdate: toInputDate(new Date()),
    };
    try {
      const saved = id
        ? await apiRequest(`/articles/${id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiRequest("/articles", { method: "POST", body: JSON.stringify(payload) });
      upsertArticleLocal(saved);
    } catch {
      articles = id
        ? articles.map((article) => (article.id === id ? { ...article, ...payload } : article))
        : [payload, ...articles];
      saveArticles();
    }
    updateStudentFilter();
    elements.dialog.close();
    render();
  });

  elements.deleteArticleButton.addEventListener("click", async () => {
    const id = elements.form.elements.id.value;
    if (!id) return;
    try {
      await apiRequest(`/articles/${id}`, { method: "DELETE" });
    } catch {
      backendOnline = false;
    }
    articles = articles.filter((article) => article.id !== id);
    saveArticles();
    updateStudentFilter();
    elements.dialog.close();
    render();
  });

  elements.touchArticleButton.addEventListener("click", async () => {
    const id = elements.form.elements.id.value;
    if (!id) return;
    try {
      const saved = await apiRequest(`/articles/${id}/touch`, { method: "PATCH" });
      upsertArticleLocal(saved);
    } catch {
      articles = articles.map((article) =>
        article.id === id ? { ...article, lastUpdate: toInputDate(new Date()) } : article,
      );
      saveArticles();
    }
    elements.dialog.close();
    render();
  });

  elements.advanceArticleButton.addEventListener("click", () => {
    const current = elements.form.status.value;
    const index = statusConfig.findIndex((status) => status.key === current);
    const next = statusConfig[Math.min(index + 1, statusConfig.length - 1)]?.key;
    elements.form.status.value = next || current;
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      currentSection = item.dataset.section;
      render();
    });
  });
}

function render() {
  const visible = filteredArticles();
  renderSectionChrome();
  renderStats(visible);
  renderKanban(visible);
  renderDonut(visible);
  renderStudentBars(visible);
  renderRecentTable(visible);
  renderDeadlines(visible);
  renderAlerts(visible);
  renderAiSummary(visible);
}

function renderSectionChrome() {
  document.body.dataset.section = currentSection;
  const titles = {
    dashboard: ["SciTrack Alunos", "Acompanhamento da produção científica"],
    artigos: ["Artigos", "Lista operacional com edição, prazos e riscos"],
    kanban: ["Kanban", "Fluxo por status editorial e científico"],
    alunos: ["Alunos", "Produção e carga de acompanhamento por aluno"],
    prazos: ["Prazos", "Entregas, vencimentos e artigos sem atualização"],
    submissoes: ["Submissões", "Controle editorial de encaminhados, aceitos e publicados"],
    relatorios: ["Relatórios", "Indicadores para coordenação e grupo de pesquisa"],
  };
  const [title, subtitle] = titles[currentSection] || titles.dashboard;
  document.querySelector(".topbar h1").textContent = title;
  document.querySelector(".topbar p").textContent = subtitle;
}

function filteredArticles() {
  const query = normalize(elements.searchInput.value);
  const status = elements.statusFilter.value;
  const student = elements.studentFilter.value;
  const period = elements.periodFilter.value;

  return articles.filter((article) => {
    const haystack = normalize(
      [article.title, article.student, article.area, article.nextAction, article.venue, article.notes].join(" "),
    );
    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus = status === "todos" || article.status === status;
    const matchesStudent = student === "todos" || article.student === student;
    const matchesPeriod = period === "todos" || daysUntil(article.deadline) <= Number(period);
    const matchesSection =
      currentSection !== "submissoes" ||
      ["Encaminhado", "Aceito", "Publicado"].includes(article.status);
    return matchesQuery && matchesStatus && matchesStudent && matchesPeriod && matchesSection;
  });
}

function renderStats(scope) {
  const total = scope.length || 1;
  elements.statsGrid.replaceChildren(
    ...statusConfig
      .filter((status) => ["Projetado", "Em desenvolvimento", "Concluído", "Encaminhado", "Aceito", "Publicado"].includes(status.key))
      .map((status) => {
        const count = scope.filter((article) => article.status === status.key).length;
        return html(`
          <article class="stat-card" style="--stat-color: ${status.color}">
            <div class="stat-icon">${status.icon}</div>
            <div>
              <strong>${count}</strong>
              <span>${status.key}</span>
              <small>${Math.round((count / total) * 100)}% do total</small>
            </div>
          </article>
        `);
      }),
  );
}

function renderKanban(scope) {
  elements.kanbanBoard.replaceChildren(
    ...statusConfig.map((status) => {
      const list = scope.filter((article) => article.status === status.key);
      const column = html(`
        <section class="kanban-column" style="--status-color: ${status.color}" data-status="${status.key}">
          <div class="kanban-title">${status.key}<span>${list.length}</span></div>
          <div class="kanban-cards"></div>
        </section>
      `);
      const cards = column.querySelector(".kanban-cards");
      cards.replaceChildren(...list.map(renderArticleCard), renderAddCardButton(status.key));
      column.addEventListener("dragover", (event) => event.preventDefault());
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        updateStatus(id, status.key);
      });
      return column;
    }),
  );
}

function renderArticleCard(article) {
  const status = statusConfig.find((item) => item.key === article.status);
  const card = html(`
    <article class="article-card" draggable="true" data-id="${article.id}">
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.student)}</p>
      <div class="article-meta">
        <span>◷ ${formatDate(article.deadline)}</span>
        <span>${article.venue ? escapeHtml(article.venue) : "Sem alvo"}</span>
      </div>
      <div>
        <span class="status-pill" style="color:${status.color};background:${mixStatusBackground(status.color)}">${article.status}</span>
      </div>
      <div>
        <small>Próxima ação:</small>
        <div class="next-action">${escapeHtml(article.nextAction)}</div>
      </div>
      <div class="card-actions">
        <button type="button" data-action="open">Abrir</button>
        <button type="button" data-action="advance">Avançar</button>
      </div>
    </article>
  `);
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", article.id);
  });
  card.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (action === "advance") {
      advanceArticle(article.id);
      return;
    }
    if (action === "open" || event.target.closest(".article-card")) {
      openArticleDialog(article.id);
    }
  });
  return card;
}

function renderAddCardButton(status) {
  const button = html(`<button class="ghost-button compact full">+ Adicionar cartão</button>`);
  button.addEventListener("click", () => {
    openArticleDialog(null, status);
  });
  return button;
}

function renderDonut(scope) {
  const total = scope.length;
  elements.totalArticles.textContent = total;
  const segments = [];
  let cursor = 0;
  statusConfig.forEach((status) => {
    const count = scope.filter((article) => article.status === status.key).length;
    const size = total ? (count / total) * 100 : 0;
    if (size > 0) segments.push(`${status.color} ${cursor}% ${cursor + size}%`);
    cursor += size;
  });
  elements.statusDonut.style.background = segments.length ? `conic-gradient(${segments.join(", ")})` : "#e8eef7";
  elements.statusLegend.replaceChildren(
    ...statusConfig.map((status) => {
      const count = scope.filter((article) => article.status === status.key).length;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return html(`
        <li>
          <label><span class="dot" style="--dot-color:${status.color}"></span>${status.key}</label>
          <span>${count} (${pct}%)</span>
        </li>
      `);
    }),
  );
}

function renderStudentBars(scope) {
  const counts = groupCount(scope.filter((article) => article.status !== "Publicado"), "student");
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...sorted.map(([, count]) => count), 1);
  elements.studentBars.replaceChildren(
    ...sorted.map(([student, count]) =>
      html(`
        <div class="bar-item">
          <span>${escapeHtml(student)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
          <strong>${count}</strong>
        </div>
      `),
    ),
  );
}

function renderRecentTable(scope) {
  const rows = [...scope]
    .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate))
    .slice(0, 8)
    .map((article) => {
      const status = statusConfig.find((item) => item.key === article.status);
      const risk = riskFor(article);
      return html(`
        <tr>
          <td>${escapeHtml(article.title)}</td>
          <td>${escapeHtml(article.student)}</td>
          <td><span class="status-pill" style="color:${status.color};background:${mixStatusBackground(status.color)}">${article.status}</span></td>
          <td>${escapeHtml(article.nextAction)}</td>
          <td>${formatDate(article.deadline)}</td>
          <td><span class="risk-badge ${risk.className}">${risk.label}</span></td>
          <td><button class="table-action" data-id="${article.id}">Editar</button></td>
        </tr>
      `);
    });
  elements.recentTable.replaceChildren(...rows);
  elements.recentTable.querySelectorAll(".table-action").forEach((button) => {
    button.addEventListener("click", () => openArticleDialog(button.dataset.id));
  });
}

function renderDeadlines(scope) {
  const list = [...scope].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 7);
  elements.deadlineList.replaceChildren(
    ...list.map((article) => {
      const days = daysUntil(article.deadline);
      const color = days < 0 ? "var(--red)" : days <= 7 ? "var(--orange)" : "var(--green)";
      return html(`
        <div class="deadline-item" style="--deadline-color:${color}">
          <div>
            <strong>${escapeHtml(article.title)}</strong>
            <span>${escapeHtml(article.student)}</span>
          </div>
          <div class="deadline-date">${formatDate(article.deadline)}</div>
        </div>
      `);
    }),
  );
}

function renderAlerts(scope) {
  const overdue = scope.filter((article) => daysUntil(article.deadline) < 0).length;
  const stale30 = scope.filter((article) => daysSince(article.lastUpdate) >= 30 && daysSince(article.lastUpdate) < 60).length;
  const stale60 = scope.filter((article) => daysSince(article.lastUpdate) >= 60).length;
  const next7 = scope.filter((article) => daysUntil(article.deadline) >= 0 && daysUntil(article.deadline) <= 7).length;
  const alerts = [
    ["Artigos atrasados", "Requerem ação imediata", overdue, "var(--red)"],
    ["Sem atualização há 30 dias", "Verifique o andamento", stale30, "var(--amber)"],
    ["Sem atualização há 60 dias", "Risco crítico de abandono", stale60, "var(--orange)"],
    ["Prazos próximos", "Vencem em até 7 dias", next7, "var(--blue)"],
  ];
  elements.notificationBadge.textContent = overdue + stale30 + stale60 + next7;
  elements.alertList.replaceChildren(
    ...alerts.map(([title, subtitle, count, color]) =>
      html(`
        <div class="alert-item" style="--alert-color:${color}">
          <div>
            <strong>${title}</strong>
            <span>${subtitle}</span>
          </div>
          <div class="alert-count">${count}</div>
        </div>
      `),
    ),
  );
}

function renderAiSummary(scope) {
  const stale = scope.filter((article) => daysSince(article.lastUpdate) >= 30);
  const missingVenue = scope.filter((article) => ["Concluído", "Encaminhado"].includes(article.status) && !article.venue);
  const next = [...scope].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
  const strongest = statusConfig
    .map((status) => [status.key, scope.filter((article) => article.status === status.key).length])
    .sort((a, b) => b[1] - a[1])[0];

  elements.aiSummary.textContent =
    scope.length === 0
      ? "Nenhum artigo corresponde aos filtros atuais. Ajuste a busca para gerar uma síntese operacional."
      : `A maior concentração está em "${strongest[0]}" (${strongest[1]} artigo${strongest[1] === 1 ? "" : "s"}). ${stale.length} artigo${stale.length === 1 ? "" : "s"} precisam de atualização e ${missingVenue.length} já deveriam ter periódico ou evento alvo definido. A próxima ação crítica é "${next.nextAction}" no artigo "${next.title}", com prazo em ${formatDate(next.deadline)}.`;
}

async function updateStatus(id, status) {
  try {
    const saved = await apiRequest(`/articles/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    upsertArticleLocal(saved);
  } catch {
    articles = articles.map((article) =>
      article.id === id ? { ...article, status, lastUpdate: toInputDate(new Date()) } : article,
    );
    saveArticles();
  }
  render();
}

function advanceArticle(id) {
  const article = articles.find((item) => item.id === id);
  if (!article) return;
  const index = statusConfig.findIndex((status) => status.key === article.status);
  const next = statusConfig[Math.min(index + 1, statusConfig.length - 1)]?.key || article.status;
  updateStatus(id, next);
}

function openArticleDialog(id, presetStatus = "Projetado") {
  const article = articles.find((item) => item.id === id);
  elements.form.reset();
  elements.dialogTitle.textContent = article ? "Editar artigo" : "Novo artigo";
  elements.deleteArticleButton.classList.toggle("hidden", !article);
  elements.touchArticleButton.classList.toggle("hidden", !article);
  elements.advanceArticleButton.classList.toggle("hidden", !article);

  elements.form.elements.id.value = article?.id || "";
  elements.form.title.value = article?.title || "";
  elements.form.student.value = article?.student || "";
  elements.form.course.value = article?.course || "Ciência da Computação";
  elements.form.level.value = article?.level || "Mestrado";
  elements.form.area.value = article?.area || "";
  elements.form.type.value = article?.type || "Artigo";
  elements.form.status.value = article?.status || presetStatus;
  elements.form.deadline.value = article?.deadline || toInputDate(addDays(new Date(), 14));
  elements.form.venue.value = article?.venue || "";
  elements.form.nextAction.value = article?.nextAction || "";
  elements.form.notes.value = article?.notes || "";
  elements.dialog.showModal();
}

function exportCsv() {
  const header = ["Titulo", "Aluno", "Curso", "Nivel", "Area", "Tipo", "Status", "Proxima acao", "Prazo", "Periodico alvo"];
  const rows = filteredArticles().map((article) =>
    [article.title, article.student, article.course, article.level, article.area, article.type, article.status, article.nextAction, article.deadline, article.venue]
      .map((value) => `"${String(value || "").replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "scitrack-artigos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function riskFor(article) {
  const until = daysUntil(article.deadline);
  const stale = daysSince(article.lastUpdate);
  if (until < 0 || stale >= 60) return { label: "Crítico", className: "risk-high" };
  if (until <= 7 || stale >= 30) return { label: "Atenção", className: "risk-medium" };
  return { label: "Regular", className: "risk-low" };
}

function groupCount(scope, key) {
  return scope.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function getStudents() {
  return [...new Set(articles.map((article) => article.student))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function daysUntil(date) {
  return Math.ceil((startOfDay(new Date(date)) - startOfDay(new Date())) / 86400000);
}

function daysSince(date) {
  return Math.floor((startOfDay(new Date()) - startOfDay(new Date(date))) / 86400000);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(date));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mixStatusBackground(color) {
  return `${color}22`;
}

function html(template) {
  const wrapper = document.createElement("template");
  wrapper.innerHTML = template.trim();
  return wrapper.content.firstElementChild;
}

