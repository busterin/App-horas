// ==============================
//  Claves en localStorage
// ==============================
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa", // compat
  ENTRIES: "appHoras_registros",                       // compat
  WORKERS: "appHoras_trabajadores",
  COMPANIES: "appHoras_empresas",
  PROJECT_WORKERS: "appHoras_proyectoTrabajadores",    // compat
  REMEMBER_LOGIN: "appHoras_recordarLogin",            // recordar login
  WORK_DIVISION: "appHoras_divisionTrabajo",           // (ya no se usa, dejamos por compat)
  VEHICLES: "appHoras_vehiculos"                       // vehículos para división de trabajo
};

// Modo de trabajo en División de trabajo
let wdMode = "add";       // "add" | "edit"
let wdEditingId = null;   // id que se está editando

// ==============================
//  Endpoints (NO CAMBIAR DOMINIO)
// ==============================
const API_BASE_URL = "https://registrohoras.monognomo.com/api.php";
const WORK_DIVISION_API_URL = "https://registrohoras.monognomo.com/work_division_api.php";

let entriesCache = [];           // horas
let projectsByCompanyCache = {}; // proyectos por empresa y mes
let projectWorkersCache = {};    // monognomos asignados a proyectos
let workDivisionCache = [];      // división de trabajo (BD)

// ==============================
//  Empresas, trabajadores, etc.
// ==============================

const DEFAULT_COMPANIES = [
  "Monognomo",
  "Neozink",
  "Yurmuvi",
  "Picofino",
  "Guardianes",
  "Escuela Energía"
];

const DEFAULT_WORKERS = [
  "Alba",
  "Alex",
  "Ana",
  "Andrea",
  "Daniel",
  "David",
  "Estela",
  "Guille",
  "Hugo",
  "Irene",
  "Javi",
  "Laura",
  "Marina",
  "Mario",
  "Marta",
  "Miguel",
  "Nerea",
  "Noelia",
  "Pablo",
  "Raquel",
  "Sergio"
];

// ==============================
//  Helpers storage
// ==============================
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setRememberLogin(value) {
  localStorage.setItem(STORAGE_KEYS.REMEMBER_LOGIN, value ? "1" : "0");
}

function getRememberLogin() {
  return localStorage.getItem(STORAGE_KEYS.REMEMBER_LOGIN) === "1";
}

// ==============================
//  Fecha helpers (ISO week → mes real)
// ==============================
function getFirstDayDateFromWeek(weekValue) {
  if (!weekValue) return null;
  const parts = weekValue.split("-W");
  if (parts.length !== 2) return null;

  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  // ISO week: semana 1 es la que contiene el 4 de enero
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7 (lunes..domingo)
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

  // devolvemos en local (pero calculado en UTC para evitar líos de DST)
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
}

function getMonthKeyFromWeek(weekValue) {
  const d = getFirstDayDateFromWeek(weekValue);
  if (!d) return null;
  const year = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

function monthKeyNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ==============================
//  DOM helpers
// ==============================
function qs(id) {
  return document.getElementById(id);
}

function setStatus(id, text, type = "") {
  const el = qs(id);
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("ok", "error");
  if (type) el.classList.add(type);
}

// ==============================
//  Tabs
// ==============================
function setupTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add("active");

      // refrescos por pestaña
      if (tabId === "tab-all") {
        renderAllTab();
      }
      if (tabId === "tab-manage") {
        renderManageTab();
      }
      if (tabId === "tab-work-division") {
        renderWorkDivisionTab();
      }
    });
  });
}

// ==============================
//  Login
// ==============================
function setupLogin() {
  const loginBtn = qs("loginBtn");
  const passwordInput = qs("passwordInput");
  const toggleBtn = qs("togglePasswordBtn");

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", handleLogin);
  }
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  }

  // Auto login si está recordado
  if (getRememberLogin()) {
    const loginView = qs("loginView");
    const protectedContent = qs("protectedContent");
    if (loginView && protectedContent) {
      loginView.classList.add("hidden");
      protectedContent.classList.remove("hidden");

      fetchEntriesFromServer();
      fetchProjectsConfigFromServer();
      fetchWorkDivisionFromServer();
    }
  }
}

async function handleLogin() {
  const loginView = document.getElementById("loginView");
  const protectedContent = document.getElementById("protectedContent");
  const passwordInput = document.getElementById("passwordInput");
  const loginMessage = document.getElementById("loginMessage");
  const rememberPassword = document.getElementById("rememberPassword");

  if (!loginView || !protectedContent || !passwordInput || !loginMessage) return;

  const value = passwordInput.value || "";

  try {
    const res = await fetch(`${API_BASE_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: value })
    });

    const data = await res.json();

    if (data && data.success) {
      if (rememberPassword && rememberPassword.checked) {
        setRememberLogin(true);
      } else {
        setRememberLogin(false);
      }

      loginView.classList.add("hidden");
      protectedContent.classList.remove("hidden");
      passwordInput.value = "";
      loginMessage.textContent = "";
      loginMessage.classList.remove("error", "ok");

      fetchEntriesFromServer();
      fetchProjectsConfigFromServer();
      fetchWorkDivisionFromServer();
      return;
    }

    loginMessage.textContent = "Contraseña incorrecta.";
    loginMessage.classList.remove("ok");
    loginMessage.classList.add("error");
    passwordInput.value = "";
    passwordInput.focus();
    setRememberLogin(false);
  } catch (e) {
    console.error(e);
    loginMessage.textContent = "Error de conexión con el servidor.";
    loginMessage.classList.remove("ok");
    loginMessage.classList.add("error");
  }
}

function setupLogout() {
  const logoutBtn = qs("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    setRememberLogin(false);
    const loginView = qs("loginView");
    const protectedContent = qs("protectedContent");
    if (loginView && protectedContent) {
      protectedContent.classList.add("hidden");
      loginView.classList.remove("hidden");
    }
  });
}

// ==============================
//  Selects init (empresas/trabajadores)
// ==============================
function ensureInitialData() {
  let companies = readJSON(STORAGE_KEYS.COMPANIES, null);
  if (!Array.isArray(companies) || companies.length === 0) {
    companies = DEFAULT_COMPANIES.slice();
    writeJSON(STORAGE_KEYS.COMPANIES, companies);
  }

  let workers = readJSON(STORAGE_KEYS.WORKERS, null);
  if (!Array.isArray(workers) || workers.length === 0) {
    workers = DEFAULT_WORKERS.slice();
    writeJSON(STORAGE_KEYS.WORKERS, workers);
  }
}

function fillSelect(selectEl, items, placeholder = "") {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  });
}

// ==============================
//  Registrar horas (tab)
// ==============================
function setupRegisterTab() {
  const weekInput = qs("weekInput");
  const companySelect = qs("companySelect");
  const projectSelect = qs("projectSelect");
  const workerSelect = qs("workerSelect");
  const addEntryBtn = qs("addEntryBtn");
  const saveAllBtn = qs("saveAllBtn");

  const companies = readJSON(STORAGE_KEYS.COMPANIES, DEFAULT_COMPANIES);
  const workers = readJSON(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);

  fillSelect(companySelect, companies, "Selecciona empresa");
  fillSelect(workerSelect, workers, "Selecciona trabajador");
  fillSelect(projectSelect, [], "Selecciona proyecto");

  // Semana por defecto: semana actual (si input week admite)
  if (weekInput && !weekInput.value) {
    // Intento: usar ISO week actual
    weekInput.value = getISOWeekString(new Date());
  }

  // Al cambiar semana o empresa, recargar proyectos
  if (weekInput) weekInput.addEventListener("change", refreshProjectsForRegister);
  if (companySelect) companySelect.addEventListener("change", refreshProjectsForRegister);

  if (addEntryBtn) addEntryBtn.addEventListener("click", addEntry);
  if (saveAllBtn) saveAllBtn.addEventListener("click", saveAllEntriesToServer);

  renderEntriesTable();
}

function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function refreshProjectsForRegister() {
  const weekValue = qs("weekInput")?.value || "";
  const company = qs("companySelect")?.value || "";
  const projectSelect = qs("projectSelect");

  const monthKey = getMonthKeyFromWeek(weekValue);
  const list = (projectsByCompanyCache?.[company]?.[monthKey]) || [];

  fillSelect(projectSelect, list, "Selecciona proyecto");
}

function addEntry() {
  const weekValue = qs("weekInput")?.value || "";
  const company = qs("companySelect")?.value || "";
  const project = qs("projectSelect")?.value || "";
  const worker = qs("workerSelect")?.value || "";
  const hours = parseFloat(qs("hoursInput")?.value || "0");
  const desc = qs("descInput")?.value || "";

  if (!weekValue || !company || !project || !worker || !hours) {
    setStatus("registerStatus", "Completa semana, empresa, proyecto, trabajador y horas.", "error");
    return;
  }

  entriesCache.push({
    week: weekValue,
    company,
    project,
    worker,
    hours,
    desc
  });

  writeJSON(STORAGE_KEYS.ENTRIES, entriesCache);
  qs("hoursInput").value = "";
  qs("descInput").value = "";
  setStatus("registerStatus", "Añadido (sin guardar en servidor).", "ok");
  renderEntriesTable();
}

function renderEntriesTable() {
  const tbody = qs("entriesTable")?.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  entriesCache.forEach((e, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(e.week || "")}</td>
      <td>${escapeHTML(e.company || "")}</td>
      <td>${escapeHTML(e.project || "")}</td>
      <td>${escapeHTML(e.worker || "")}</td>
      <td>${escapeHTML(String(e.hours ?? ""))}</td>
      <td>${escapeHTML(e.desc || "")}</td>
      <td><button class="btn btn-danger" data-del="${idx}">X</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.del, 10);
      entriesCache.splice(idx, 1);
      writeJSON(STORAGE_KEYS.ENTRIES, entriesCache);
      renderEntriesTable();
    });
  });
}

// ==============================
//  Server sync - entries + config
// ==============================
async function fetchEntriesFromServer() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=list_entries`);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.entries)) {
      entriesCache = data.entries.map(x => ({
        week: x.week,
        company: x.company,
        project: x.project,
        worker: x.worker,
        hours: parseFloat(x.hours),
        desc: x.description || ""
      }));
      writeJSON(STORAGE_KEYS.ENTRIES, entriesCache);
      renderEntriesTable();
    } else {
      entriesCache = readJSON(STORAGE_KEYS.ENTRIES, []);
      renderEntriesTable();
    }
  } catch (e) {
    console.error(e);
    entriesCache = readJSON(STORAGE_KEYS.ENTRIES, []);
    renderEntriesTable();
  }
}

async function saveAllEntriesToServer() {
  setStatus("registerStatus", "Guardando...", "");
  try {
    const res = await fetch(`${API_BASE_URL}?action=save_all_entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entriesCache })
    });
    const data = await res.json();
    if (data && data.success) {
      setStatus("registerStatus", "Guardado en servidor ✅", "ok");
      fetchEntriesFromServer();
    } else {
      setStatus("registerStatus", "Error guardando en servidor.", "error");
    }
  } catch (e) {
    console.error(e);
    setStatus("registerStatus", "Error de conexión al guardar.", "error");
  }
}

async function fetchProjectsConfigFromServer() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=get_projects_config`);
    const data = await res.json();

    if (data && data.success) {
      projectsByCompanyCache = data.projects_by_company || {};
      projectWorkersCache = data.project_workers || {};

      writeJSON(STORAGE_KEYS.PROJECTS_BY_COMPANY, projectsByCompanyCache);
      writeJSON(STORAGE_KEYS.PROJECT_WORKERS, projectWorkersCache);

      refreshProjectsForRegister();
      renderManageTab();
      renderAllTab();
    } else {
      projectsByCompanyCache = readJSON(STORAGE_KEYS.PROJECTS_BY_COMPANY, {});
      projectWorkersCache = readJSON(STORAGE_KEYS.PROJECT_WORKERS, {});
    }
  } catch (e) {
    console.error(e);
    projectsByCompanyCache = readJSON(STORAGE_KEYS.PROJECTS_BY_COMPANY, {});
    projectWorkersCache = readJSON(STORAGE_KEYS.PROJECT_WORKERS, {});
  }
}

async function saveProjectsConfigToServer() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=save_projects_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projects_by_company: projectsByCompanyCache,
        project_workers: projectWorkersCache
      })
    });

    const data = await res.json();
    return !!(data && data.success);
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ==============================
//  Ver todos los proyectos (tab)
// ==============================
function setupAllTab() {
  const month = qs("monthFilterAll");
  const company = qs("companyFilterAll");
  const project = qs("projectFilterAll");
  const worker = qs("workerFilterAll");
  const apply = qs("applyFiltersBtn");

  const companies = readJSON(STORAGE_KEYS.COMPANIES, DEFAULT_COMPANIES);
  const workers = readJSON(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);

  if (month && !month.value) month.value = monthKeyNow();
  fillSelect(company, ["", ...companies], "");
  fillSelect(worker, ["", ...workers], "");
  fillSelect(project, [""], "");

  if (month) month.addEventListener("change", refreshProjectsForAllFilters);
  if (company) company.addEventListener("change", refreshProjectsForAllFilters);
  if (apply) apply.addEventListener("click", renderAllTab);

  refreshProjectsForAllFilters();
  renderAllTab();
}

function refreshProjectsForAllFilters() {
  const monthKey = qs("monthFilterAll")?.value || "";
  const company = qs("companyFilterAll")?.value || "";
  const projectSelect = qs("projectFilterAll");

  const list = (projectsByCompanyCache?.[company]?.[monthKey]) || [];
  fillSelect(projectSelect, ["", ...list], "");
}

function renderAllTab() {
  const tbody = qs("allTable")?.querySelector("tbody");
  if (!tbody) return;

  const monthKey = qs("monthFilterAll")?.value || "";
  const companyFilter = qs("companyFilterAll")?.value || "";
  const projectFilter = qs("projectFilterAll")?.value || "";
  const workerFilter = qs("workerFilterAll")?.value || "";

  const filtered = entriesCache.filter(e => {
    if (monthKey) {
      const mk = getMonthKeyFromWeek(e.week);
      if (mk !== monthKey) return false;
    }
    if (companyFilter && e.company !== companyFilter) return false;
    if (projectFilter && e.project !== projectFilter) return false;
    if (workerFilter && e.worker !== workerFilter) return false;
    return true;
  });

  tbody.innerHTML = "";
  filtered.forEach(e => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(e.week || "")}</td>
      <td>${escapeHTML(e.company || "")}</td>
      <td>${escapeHTML(e.project || "")}</td>
      <td>${escapeHTML(e.worker || "")}</td>
      <td>${escapeHTML(String(e.hours ?? ""))}</td>
      <td>${escapeHTML(e.desc || "")}</td>
    `;
    tbody.appendChild(tr);
  });

  setStatus("allStatus", `${filtered.length} registros`, "");
}

// ==============================
//  Gestionar proyectos (tab)
// ==============================
function setupManageTab() {
  const monthInput = qs("manageMonthInput");
  const companySelect = qs("manageCompanySelect");
  const companies = readJSON(STORAGE_KEYS.COMPANIES, DEFAULT_COMPANIES);

  if (monthInput && !monthInput.value) monthInput.value = monthKeyNow();
  fillSelect(companySelect, companies, "Selecciona empresa");

  const addProjectBtn = qs("addProjectBtn");
  if (addProjectBtn) addProjectBtn.addEventListener("click", addProject);

  renderManageTab();
}

function renderManageTab() {
  const tbody = qs("manageProjectsTable")?.querySelector("tbody");
  if (!tbody) return;

  const monthKey = qs("manageMonthInput")?.value || "";
  const company = qs("manageCompanySelect")?.value || "";

  tbody.innerHTML = "";

  if (!monthKey || !company) {
    setStatus("manageStatus", "Selecciona mes y empresa.", "");
    return;
  }

  const list = (projectsByCompanyCache?.[company]?.[monthKey]) || [];
  list.forEach(projectName => {
    const assigned = (projectWorkersCache?.[company]?.[monthKey]?.[projectName]) || [];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(monthKey)}</td>
      <td>${escapeHTML(company)}</td>
      <td>${escapeHTML(projectName)}</td>
      <td>${escapeHTML(assigned.join(", "))}</td>
      <td>
        <button class="btn btn-secondary" data-edit="${encodeURIComponent(projectName)}">Editar</button>
        <button class="btn btn-danger" data-del="${encodeURIComponent(projectName)}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const projectName = decodeURIComponent(btn.dataset.del);
      await deleteProject(monthKey, company, projectName);
    });
  });

  tbody.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const projectName = decodeURIComponent(btn.dataset.edit);
      openEditProjectModal(monthKey, company, projectName);
    });
  });

  setStatus("manageStatus", `${list.length} proyectos en ${company} (${monthKey})`, "");
}

async function addProject() {
  const monthKey = qs("manageMonthInput")?.value || "";
  const company = qs("manageCompanySelect")?.value || "";
  const name = (qs("newProjectNameInput")?.value || "").trim();

  if (!monthKey || !company || !name) {
    setStatus("manageStatus", "Completa mes, empresa y nombre.", "error");
    return;
  }

  if (!projectsByCompanyCache[company]) projectsByCompanyCache[company] = {};
  if (!projectsByCompanyCache[company][monthKey]) projectsByCompanyCache[company][monthKey] = [];

  if (projectsByCompanyCache[company][monthKey].includes(name)) {
    setStatus("manageStatus", "Ese proyecto ya existe.", "error");
    return;
  }

  projectsByCompanyCache[company][monthKey].push(name);
  projectsByCompanyCache[company][monthKey].sort((a,b)=>a.localeCompare(b));

  // Inicializar trabajadores asignados
  if (!projectWorkersCache[company]) projectWorkersCache[company] = {};
  if (!projectWorkersCache[company][monthKey]) projectWorkersCache[company][monthKey] = {};
  if (!projectWorkersCache[company][monthKey][name]) projectWorkersCache[company][monthKey][name] = [];

  const ok = await saveProjectsConfigToServer();
  if (ok) {
    qs("newProjectNameInput").value = "";
    setStatus("manageStatus", "Proyecto añadido ✅", "ok");
    fetchProjectsConfigFromServer();
  } else {
    setStatus("manageStatus", "Error guardando configuración.", "error");
  }
}

async function deleteProject(monthKey, company, projectName) {
  if (!confirm(`Eliminar "${projectName}" de ${company} (${monthKey})?`)) return;

  const list = projectsByCompanyCache?.[company]?.[monthKey] || [];
  projectsByCompanyCache[company][monthKey] = list.filter(p => p !== projectName);

  // quitar asignaciones
  if (projectWorkersCache?.[company]?.[monthKey]?.[projectName]) {
    delete projectWorkersCache[company][monthKey][projectName];
  }

  const ok = await saveProjectsConfigToServer();
  if (ok) {
    setStatus("manageStatus", "Eliminado ✅", "ok");
    fetchProjectsConfigFromServer();
  } else {
    setStatus("manageStatus", "Error eliminando.", "error");
  }
}

// Modal simple con prompt (mantener simple)
function openEditProjectModal(monthKey, company, projectName) {
  const workers = readJSON(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);
  const current = (projectWorkersCache?.[company]?.[monthKey]?.[projectName]) || [];
  const next = prompt(
    `Trabajadores asignados a "${projectName}" (separa por comas):\nDisponibles: ${workers.join(", ")}`,
    current.join(", ")
  );

  if (next === null) return;

  const list = next
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  if (!projectWorkersCache[company]) projectWorkersCache[company] = {};
  if (!projectWorkersCache[company][monthKey]) projectWorkersCache[company][monthKey] = {};
  projectWorkersCache[company][monthKey][projectName] = list;

  saveProjectsConfigToServer().then(ok => {
    if (ok) {
      setStatus("manageStatus", "Actualizado ✅", "ok");
      fetchProjectsConfigFromServer();
    } else {
      setStatus("manageStatus", "Error actualizando.", "error");
    }
  });
}

// ==============================
//  División de trabajo (tab)
// ==============================
function setupWorkDivisionTab() {
  // vehiculos
  if (!readJSON(STORAGE_KEYS.VEHICLES, null)) {
    writeJSON(STORAGE_KEYS.VEHICLES, ["Furgoneta 1"]);
  }

  const addVehicleBtn = qs("addVehicleBtn");
  const saveVehiclesBtn = qs("wdSaveVehiclesBtn");
  const wdAddBtn = qs("wdAddBtn");

  if (addVehicleBtn) addVehicleBtn.addEventListener("click", addVehicle);
  if (saveVehiclesBtn) saveVehiclesBtn.addEventListener("click", saveVehicles);
  if (wdAddBtn) wdAddBtn.addEventListener("click", addWorkDivisionRow);

  const workers = readJSON(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);
  fillSelect(qs("wdWorker"), workers, "Selecciona trabajador");

  // fecha por defecto hoy
  const wdDate = qs("wdDate");
  if (wdDate && !wdDate.value) wdDate.valueAsDate = new Date();

  renderVehiclesUI();
  renderWorkDivisionTab();
}

function renderVehiclesUI() {
  const vehicles = readJSON(STORAGE_KEYS.VEHICLES, []);
  fillSelect(qs("wdVehicle"), vehicles, "Selecciona vehículo");

  const list = qs("vehiclesList");
  if (!list) return;
  list.innerHTML = "";

  vehicles.forEach((v, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `
      ${escapeHTML(v)}
      <button type="button" data-idx="${idx}" title="Eliminar">✕</button>
    `;
    list.appendChild(chip);
  });

  list.querySelectorAll("button[data-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const vehicles2 = readJSON(STORAGE_KEYS.VEHICLES, []);
      vehicles2.splice(idx, 1);
      writeJSON(STORAGE_KEYS.VEHICLES, vehicles2);
      renderVehiclesUI();
    });
  });
}

function addVehicle() {
  const input = qs("newVehicleInput");
  const name = (input?.value || "").trim();
  if (!name) return;

  const vehicles = readJSON(STORAGE_KEYS.VEHICLES, []);
  if (vehicles.includes(name)) {
    setStatus("wdStatus", "Ese vehículo ya existe.", "error");
    return;
  }
  vehicles.push(name);
  writeJSON(STORAGE_KEYS.VEHICLES, vehicles);
  input.value = "";
  setStatus("wdStatus", "Vehículo añadido (recuerda guardar).", "ok");
  renderVehiclesUI();
}

async function saveVehicles() {
  setStatus("wdStatus", "Guardando vehículos...", "");
  try {
    const vehicles = readJSON(STORAGE_KEYS.VEHICLES, []);
    const res = await fetch(`${WORK_DIVISION_API_URL}?action=save_vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicles })
    });
    const data = await res.json();
    if (data && data.success) {
      setStatus("wdStatus", "Vehículos guardados ✅", "ok");
      fetchWorkDivisionFromServer();
    } else {
      setStatus("wdStatus", "Error guardando vehículos.", "error");
    }
  } catch (e) {
    console.error(e);
    setStatus("wdStatus", "Error de conexión.", "error");
  }
}

async function addWorkDivisionRow() {
  const date = qs("wdDate")?.value || "";
  const vehicle = qs("wdVehicle")?.value || "";
  const worker = qs("wdWorker")?.value || "";
  const hours = parseFloat(qs("wdHours")?.value || "0");
  const task = qs("wdTask")?.value || "";

  if (!date || !vehicle || !worker || !hours) {
    setStatus("wdStatus", "Completa fecha, vehículo, trabajador y horas.", "error");
    return;
  }

  try {
    const action = (wdMode === "edit") ? "update_entry" : "add_entry";
    const payload = {
      date, vehicle, worker, hours, task
    };
    if (wdMode === "edit") payload.id = wdEditingId;

    const res = await fetch(`${WORK_DIVISION_API_URL}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data && data.success) {
      setStatus("wdStatus", wdMode === "edit" ? "Actualizado ✅" : "Añadido ✅", "ok");
      wdMode = "add";
      wdEditingId = null;
      qs("wdAddBtn").textContent = "Añadir";
      qs("wdHours").value = "";
      qs("wdTask").value = "";
      fetchWorkDivisionFromServer();
    } else {
      setStatus("wdStatus", "Error guardando en BD.", "error");
    }
  } catch (e) {
    console.error(e);
    setStatus("wdStatus", "Error de conexión.", "error");
  }
}

async function fetchWorkDivisionFromServer() {
  try {
    const res = await fetch(`${WORK_DIVISION_API_URL}?action=list_entries`);
    const data = await res.json();
    if (data && data.success) {
      workDivisionCache = data.entries || [];
      renderWorkDivisionTab();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderWorkDivisionTab() {
  const tbody = qs("wdTable")?.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  workDivisionCache.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(row.date || "")}</td>
      <td>${escapeHTML(row.vehicle || "")}</td>
      <td>${escapeHTML(row.worker || "")}</td>
      <td>${escapeHTML(String(row.hours ?? ""))}</td>
      <td>${escapeHTML(row.task || "")}</td>
      <td>
        <button class="btn btn-secondary" data-edit="${row.id}">Editar</button>
        <button class="btn btn-danger" data-del="${row.id}">X</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteWorkDivisionRow(btn.dataset.del));
  });
  tbody.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEditWorkDivisionRow(btn.dataset.edit));
  });
}

async function deleteWorkDivisionRow(id) {
  if (!confirm("¿Eliminar este registro?")) return;
  try {
    const res = await fetch(`${WORK_DIVISION_API_URL}?action=delete_entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data && data.success) {
      setStatus("wdStatus", "Eliminado ✅", "ok");
      fetchWorkDivisionFromServer();
    } else {
      setStatus("wdStatus", "Error eliminando.", "error");
    }
  } catch (e) {
    console.error(e);
    setStatus("wdStatus", "Error de conexión.", "error");
  }
}

function startEditWorkDivisionRow(id) {
  const row = workDivisionCache.find(x => String(x.id) === String(id));
  if (!row) return;

  wdMode = "edit";
  wdEditingId = row.id;
  qs("wdAddBtn").textContent = "Guardar cambios";

  qs("wdDate").value = row.date || "";
  qs("wdVehicle").value = row.vehicle || "";
  qs("wdWorker").value = row.worker || "";
  qs("wdHours").value = row.hours ?? "";
  qs("wdTask").value = row.task || "";
}

// ==============================
//  Escape
// ==============================
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

// ==============================
//  INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  ensureInitialData();
  setupTabs();
  setupLogin();
  setupLogout();

  // caches iniciales locales
  entriesCache = readJSON(STORAGE_KEYS.ENTRIES, []);
  projectsByCompanyCache = readJSON(STORAGE_KEYS.PROJECTS_BY_COMPANY, {});
  projectWorkersCache = readJSON(STORAGE_KEYS.PROJECT_WORKERS, {});

  setupRegisterTab();
  setupAllTab();
  setupManageTab();
  setupWorkDivisionTab();

  // si no está recordado, queda en login
});
