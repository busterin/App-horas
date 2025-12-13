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
let wdEditingId = null;   // id del evento que se está editando

// Filtro de mes en "Gestionar proyectos"
let manageProjectsFilterMonth = "";

// ==============================
//  Backend IONOS (MySQL)
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
  "Escuela Energía",
  "General"
];

const DEFAULT_WORKERS = [
  "Alba",
  "Buster",
  "Castri",
  "Celia",
  "Elías",
  "Genio",
  "Inés",
  "Keila",
  "Laura",
  "Lorena",
  "Maider",
  "María C",
  "María M",
  "Rober",
  "Sandra",
  "Sara",
  "Voby"
];

const DEFAULT_PROJECTS_BY_COMPANY = {
  Monognomo: {},
  Neozink: {},
  Yurmuvi: {},
  Picofino: {},
  Guardianes: {},
  "Escuela Energía": {},
  General: {}
};

// Proyectos permanentes por empresa
const PERMANENT_PROJECTS = {
  Guardianes: [
    "Talleres alumnado",
    "Talleres profes",
    "Mail coles",
    "Llamadas coles",
    "Web",
    "Material didáctico",
    "General"
  ],
  "Escuela Energía": [
    "Talleres Primaria",
    "Mails coles",
    "Llamadas coles",
    "Web",
    "Material didáctico",
    "Informes",
    "General"
  ],
  Yurmuvi: [
    "Salas de escape"
  ],
  Picofino: [
    "Nave PICOFINO"
  ]
};

// Vehículos por defecto
const DEFAULT_VEHICLES = [
  "Furgo Neo",
  "Furgo alquiler",
  "Camión",
  "Furgo Maider"
];

// Orden preferido de empresas en vistas (Ver todos / Gestionar)
const COMPANY_VIEW_ORDER = [
  "Monognomo",
  "Neozink",
  "Yurmuvi",
  "Picofino",
  "Escuela Energía",
  "Guardianes",
  "General"
];

// Nombre visible de las empresas (sin romper los valores internos)
const COMPANY_DISPLAY_NAME_MAP = {
  Guardianes: "Guardianes del Tesoro",
  "Escuela Energía": "Escuela de la Energía"
};

function getCompanyDisplayName(name) {
  return COMPANY_DISPLAY_NAME_MAP[name] || name;
}

function sortCompaniesForView(companies) {
  const knownSet = new Set(COMPANY_VIEW_ORDER);
  const known = [];
  const unknown = [];

  companies.forEach(name => {
    if (knownSet.has(name)) {
      known.push(name);
    } else {
      unknown.push(name);
    }
  });

  known.sort(
    (a, b) =>
      COMPANY_VIEW_ORDER.indexOf(a) - COMPANY_VIEW_ORDER.indexOf(b)
  );

  unknown.sort((a, b) => a.localeCompare(b, "es"));

  const result = [];
  let insertedUnknown = false;

  known.forEach(name => {
    if (name === "General" && !insertedUnknown) {
      unknown.forEach(u => result.push(u));
      insertedUnknown = true;
    }
    result.push(name);
  });

  if (!insertedUnknown) {
    unknown.forEach(u => result.push(u));
  }

  return result;
}

// =====================================
//   Utilidades de almacenamiento
// =====================================

function deepClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : deepClone(fallback);
  } catch (e) {
    console.error("Error leyendo localStorage", e);
    return deepClone(fallback);
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error guardando en localStorage", e);
  }
}

function loadWorkers() {
  return loadFromStorage(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);
}

function saveWorkers(workers) {
  saveToStorage(STORAGE_KEYS.WORKERS, workers);
}

function loadCompanies() {
  return loadFromStorage(STORAGE_KEYS.COMPANIES, DEFAULT_COMPANIES);
}

function saveCompanies(companies) {
  saveToStorage(STORAGE_KEYS.COMPANIES, companies);
}

function loadVehicles() {
  return loadFromStorage(STORAGE_KEYS.VEHICLES, DEFAULT_VEHICLES);
}

function saveVehicles(vehicles) {
  saveToStorage(STORAGE_KEYS.VEHICLES, vehicles);
}

// RECORDAR LOGIN
function isRememberLoginEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_LOGIN) === "1";
  } catch {
    return false;
  }
}

function setRememberLogin(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_LOGIN, "1");
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_LOGIN);
    }
  } catch {
    // ignoramos errores
  }
}

// =====================================
//   Entradas (horas) usando la BD
// =====================================

function loadEntries() {
  return deepClone(entriesCache);
}

function saveEntries(entries) {
  entriesCache = deepClone(entries);
  syncEntriesToServer(entriesCache);
}

async function syncEntriesToServer(entries) {
  try {
    await fetch(`${API_BASE_URL}?action=save_all_entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries })
    });
  } catch (err) {
    console.error("Error sincronizando entradas con el servidor", err);
  }
}

async function fetchEntriesFromServer() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=list_entries`);
    const data = await res.json();
    if (data.success && Array.isArray(data.entries)) {
      entriesCache = data.entries;
    } else {
      entriesCache = [];
    }
  } catch (err) {
    console.error("Error cargando entradas desde el servidor", err);
    entriesCache = [];
  }

  refreshProjectFilterSelect();
  renderCompanyView();
  if (!document.getElementById("manageProjectsView").classList.contains("hidden")) {
    renderManageProjectsView();
  }
  refreshWorkDivisionEventSelect();
}

// =====================================
//   Proyectos/meses y monognomos desde BD
// =====================================

function loadProjectsByCompany() {
  return Object.keys(projectsByCompanyCache).length === 0
    ? deepClone(DEFAULT_PROJECTS_BY_COMPANY)
    : deepClone(projectsByCompanyCache);
}

function saveProjectsByCompany(map) {
  projectsByCompanyCache = deepClone(map);
  syncProjectsConfigToServer(projectsByCompanyCache, projectWorkersCache);
}

function loadProjectWorkers() {
  return deepClone(projectWorkersCache);
}

function saveProjectWorkers(map) {
  projectWorkersCache = deepClone(map);
  syncProjectsConfigToServer(projectsByCompanyCache, projectWorkersCache);
}

async function fetchProjectsConfigFromServer() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=get_projects_config`);
    const data = await res.json();

    if (data.success) {
      const fromServerProjects = data.projectsByCompany || {};
      const fromServerWorkers = data.projectWorkers || {};

      projectsByCompanyCache =
        Object.keys(fromServerProjects).length > 0
          ? deepClone(fromServerProjects)
          : deepClone(DEFAULT_PROJECTS_BY_COMPANY);

      projectWorkersCache = deepClone(fromServerWorkers);
    } else {
      projectsByCompanyCache = deepClone(DEFAULT_PROJECTS_BY_COMPANY);
      projectWorkersCache = {};
    }
  } catch (err) {
    console.error("Error cargando configuración de proyectos", err);
    projectsByCompanyCache = deepClone(DEFAULT_PROJECTS_BY_COMPANY);
    projectWorkersCache = {};
  }

  updateProjectSelect();
  renderManageProjectsView();
  refreshProjectFilterSelect();
  refreshWorkDivisionEventSelect();
}

async function syncProjectsConfigToServer(projectsByCompany, projectWorkers) {
  try {
    await fetch(`${API_BASE_URL}?action=save_projects_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectsByCompany, projectWorkers })
    });
  } catch (err) {
    console.error("Error sincronizando configuración de proyectos", err);
  }
}

// =====================================
//   División de trabajo (BD)
// =====================================

function loadWorkDivision() {
  return deepClone(workDivisionCache);
}

function saveWorkDivision(list) {
  workDivisionCache = deepClone(list);
  syncWorkDivisionToServer(workDivisionCache);
}

async function fetchWorkDivisionFromServer() {
  try {
    const res = await fetch(`${WORK_DIVISION_API_URL}?action=list`);
    const data = await res.json();

    if (data.success && Array.isArray(data.items)) {
      workDivisionCache = data.items;
    } else {
      workDivisionCache = [];
    }
  } catch (err) {
    console.error("Error cargando división de trabajo desde el servidor", err);
    workDivisionCache = [];
  }

  refreshWorkDivisionEventSelect();
  renderWorkDivisionList();
}

async function syncWorkDivisionToServer(list) {
  try {
    await fetch(`${WORK_DIVISION_API_URL}?action=save_all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: list })
    });
  } catch (err) {
    console.error("Error sincronizando división de trabajo con el servidor", err);
  }
}

function getMonthKeyFromDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // YYYY-MM
}

// =====================================
//   Utilidades de UI generales
// =====================================

function fillSelect(selectEl, items, { placeholder } = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    opt.disabled = true;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  });
}

function showMessage(text, type = "ok") {
  const msgEl = document.getElementById("message");
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.classList.remove("ok", "error");
  if (text) {
    msgEl.classList.add(type);
  }
}

// =====================================
//   Colores para empresas y proyectos
// =====================================

function stringToHslColor(str, s = 65, l = 85) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getCompanyColor(company) {
  if (company === "Monognomo") return "#fff9c4"; // amarillo claro
  if (company === "Yurmuvi") return "#ffcdd2";   // rojo claro
  return stringToHslColor(`company-${company}`, 70, 85);
}

function getProjectColor(project) {
  return stringToHslColor(`project-${project}`, 60, 88);
}

// =====================================
//   Fotos de trabajadores
// =====================================

const WORKER_IMAGE_EXTENSIONS = [".jpeg", ".jpg", ".png"];

const WORKER_IMAGE_BASE_MAP = {
  "Elías": "Elias",
  "Inés": "Ines",
  "María C": "Mariac",
  "María M": "Mariam"
};

function getWorkerImageBase(workerName) {
  return WORKER_IMAGE_BASE_MAP[workerName] || workerName;
}

function getPossibleImagePaths(workerName) {
  const base = getWorkerImageBase(workerName);
  return WORKER_IMAGE_EXTENSIONS.map(ext => `images/${base}${ext}`);
}

function loadWorkerImage(imgElement, workerName) {
  const paths = getPossibleImagePaths(workerName);
  let index = 0;

  function tryNext() {
    if (index >= paths.length) {
      imgElement.src = "images/default.png";
      return;
    }
    const path = paths[index++];
    imgElement.onerror = tryNext;
    imgElement.src = path;
  }

  tryNext();
}

function updateWorkerPhoto() {
  const select = document.getElementById("workerSelect");
  const wrapper = document.querySelector(".worker-photo-wrapper");
  const img = document.getElementById("workerPhoto");

  if (!select || !wrapper || !img) return;

  const worker = select.value;
  if (!worker) {
    wrapper.style.display = "none";
    img.src = "";
    img.alt = "Foto del trabajador seleccionado";
    return;
  }

  wrapper.style.display = "block";
  loadWorkerImage(img, worker);
  img.alt = "Foto de " + worker;
}

function createWorkerCell(workerName) {
  const td = document.createElement("td");
  td.className = "worker-cell";

  const img = document.createElement("img");
  img.className = "worker-avatar";
  loadWorkerImage(img, workerName);

  const span = document.createElement("span");
  span.textContent = workerName;

  td.appendChild(img);
  td.appendChild(span);
  return td;
}

// =====================================
//   Semana → mes y primer día visible
// =====================================

function getMonthKeyFromWeek(weekValue) {
  if (!weekValue) return null;
  const parts = weekValue.split("-W");
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const month = d.getMonth() + 1;
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function getFirstDayDateFromWeek(weekValue) {
  if (!weekValue) return null;
  const parts = weekValue.split("-W");
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekDisplay(weekValue) {
  const d = getFirstDayDateFromWeek(weekValue);
  if (!d) return weekValue;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function formatMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, monthStr] = monthKey.split("-");
  if (monthStr === "00") return "Todos los meses";
  const month = parseInt(monthStr, 10);
  if (!month || month < 1 || month > 12) return monthKey;
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

function getCurrentMonthKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

// proyectos para empresa+mes (incluye permanentes)
function getProjectsForCompanyAndMonth(company, monthKey) {
  if (!company || !monthKey) return [];
  const map = loadProjectsByCompany();
  const companyData = map[company] || {};
  const baseList = companyData[monthKey] || [];
  let result = Array.isArray(baseList) ? [...baseList] : [];

  const permanent = PERMANENT_PROJECTS[company] || [];
  permanent.forEach(p => {
    if (!result.includes(p)) result.push(p);
  });

  result.sort((a, b) => a.localeCompare(b, "es"));
  return result;
}

function updateProjectMonthLabel() {
  const labelEl = document.getElementById("projectMonthLabel");
  const companySelect = document.getElementById("companySelect");
  const weekInput = document.getElementById("weekInput");
  if (!labelEl || !companySelect || !weekInput) return;

  const company = companySelect.value;
  const week = weekInput.value;
  const monthKey = getMonthKeyFromWeek(week);

  if (!week || !monthKey) {
    labelEl.textContent = "Selecciona una semana para cargar los proyectos del mes.";
    return;
  }

  if (!company || company === "General") {
    labelEl.textContent =
      "Selecciona empresa para ver los proyectos de " + formatMonthKey(monthKey) + ".";
    return;
  }

  labelEl.textContent = "Proyectos de " + formatMonthKey(monthKey);
}

// =====================================
//   SINERGIA: nombres globales de proyecto/evento
// =====================================

function getAllGlobalEventNames() {
  const names = new Set();

  const projectsByCompany = loadProjectsByCompany();
  Object.keys(projectsByCompany).forEach(company => {
    const companyRaw = projectsByCompany[company];
    if (Array.isArray(companyRaw)) {
      companyRaw.forEach(p => names.add(p));
    } else if (companyRaw && typeof companyRaw === "object") {
      Object.values(companyRaw).forEach(list => {
        if (typeof list === "string") {
          names.add(list);
        } else if (Array.isArray(list)) {
          list.forEach(p => names.add(p));
        }
      });
    }
  });

  Object.keys(PERMANENT_PROJECTS).forEach(company => {
    PERMANENT_PROJECTS[company].forEach(p => names.add(p));
  });

  const wdList = loadWorkDivision();
  wdList.forEach(item => {
    if (item.eventName) names.add(item.eventName);
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
}

function nameExistsInGlobalEvents(name) {
  if (!name) return false;
  const target = name.toLowerCase();
  const all = getAllGlobalEventNames();
  return all.some(n => (n || "").toLowerCase() === target);
}

function refreshWorkDivisionEventSelect(selectedName) {
  const select = document.getElementById("wdEventSelect");
  if (!select) return;

  const allNames = getAllGlobalEventNames();

  // Filtramos los proyectos permanentes: no deben aparecer en División de trabajo
  const permanentSet = new Set();
  Object.values(PERMANENT_PROJECTS).forEach(list => {
    list.forEach(p => permanentSet.add(p));
  });

  const events = allNames.filter(name => !permanentSet.has(name));

  select.innerHTML = "";

  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  placeholderOpt.textContent = "Elige un evento";
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  select.appendChild(placeholderOpt);

  events.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (selectedName) {
    const found = Array.from(select.options).find(o => o.value === selectedName);
    if (found) {
      found.selected = true;
      placeholderOpt.selected = false;
    }
  }
}

// =====================================
//   Helpers para NUEVOS monognomos y vehículos
// =====================================

function ensureWorkerInSelect(select, workerName) {
  if (!select) return;
  const exists = Array.from(select.options).some(o => o.value === workerName);
  if (exists) return;

  const opt = document.createElement("option");
  opt.value = workerName;
  opt.textContent = workerName;

  const beforeNew = Array.from(select.options).find(
    o => o.value === "__new_worker__"
  );
  if (beforeNew) {
    select.insertBefore(opt, beforeNew);
  } else {
    select.appendChild(opt);
  }
}

function addWorkerToAllSelects(workerName) {
  const ids = [
    "workerSelect",
    "filterWorker",
    "wdTeamSetup",
    "wdTeamDismantle",
    "wdFilterWorker",
    "wdCoordProject",
    "wdCoordProd"
  ];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    ensureWorkerInSelect(sel, workerName);
  });
}

function handleNewWorker(selectEl) {
  const name = prompt("Nombre del nuevo monognomo:");
  if (!name) {
    selectEl.value = "";
    return;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    selectEl.value = "";
    return;
  }

  let workers = loadWorkers();
  if (!workers.includes(trimmed)) {
    workers.push(trimmed);
    workers.sort((a, b) => a.localeCompare(b, "es"));
    saveWorkers(workers);
  }

  addWorkerToAllSelects(trimmed);
  selectEl.value = trimmed;
}

function ensureVehicleInSelect(select, vehicleName) {
  if (!select) return;
  const exists = Array.from(select.options).some(o => o.value === vehicleName);
  if (exists) return;

  const opt = document.createElement("option");
  opt.value = vehicleName;
  opt.textContent = vehicleName;

  const beforeNew = Array.from(select.options).find(
    o => o.value === "__new_vehicle__"
  );
  if (beforeNew) {
    select.insertBefore(opt, beforeNew);
  } else {
    select.appendChild(opt);
  }
}

function addVehicleToAllSelects(vehicleName) {
  const ids = ["wdSetupVehicle", "wdDismantleVehicle"];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    ensureVehicleInSelect(sel, vehicleName);
  });
}

function handleNewVehicle(selectEl) {
  const name = prompt("Nombre del nuevo vehículo:");
  if (!name) {
    selectEl.value = "";
    return;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    selectEl.value = "";
    return;
  }

  let vehicles = loadVehicles();
  if (!vehicles.includes(trimmed)) {
    vehicles.push(trimmed);
    vehicles.sort((a, b) => a.localeCompare(b, "es"));
    saveVehicles(vehicles);
  }

  addVehicleToAllSelects(trimmed);
  selectEl.value = trimmed;
}

// =====================================
//   Cambio de empresa/semana: proyectos
// =====================================

function refreshCompanySelects(selectedCompany) {
  const companies = loadCompanies();
  const companySelect = document.getElementById("companySelect");
  const filterCompany = document.getElementById("filterCompany");

  if (companySelect) {
    companySelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige una empresa/proyecto prin.";
    placeholder.disabled = true;
    placeholder.selected = true;
    companySelect.appendChild(placeholder);

    companies.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = getCompanyDisplayName(c);
      companySelect.appendChild(opt);
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_company__";
    addOpt.textContent = "➕ Añadir empresa nueva...";
    companySelect.appendChild(addOpt);

    if (selectedCompany) companySelect.value = selectedCompany;
  }

  if (filterCompany) {
    filterCompany.innerHTML = "";
    const allCompaniesOpt = document.createElement("option");
    allCompaniesOpt.value = "";
    allCompaniesOpt.textContent = "Todas";
    filterCompany.appendChild(allCompaniesOpt);

    companies.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = getCompanyDisplayName(c);
      filterCompany.appendChild(opt);
    });
  }
}

function handleCompanyChange() {
  const companySelect = document.getElementById("companySelect");
  if (!companySelect) return;

  const value = companySelect.value;

  if (value === "__new_company__") {
    const name = prompt("Nombre de la nueva empresa/proyecto principal:");
    if (!name) {
      companySelect.value = "";
      updateProjectSelect();
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      companySelect.value = "";
      updateProjectSelect();
      return;
    }

    let companies = loadCompanies();
    if (!companies.includes(trimmed)) {
      companies.push(trimmed);
      saveCompanies(companies);
    }

    const projectsByCompany = loadProjectsByCompany();
    if (!projectsByCompany[trimmed]) {
      projectsByCompany[trimmed] = {};
      saveProjectsByCompany(projectsByCompany);
    }

    refreshCompanySelects(trimmed);
  }

  updateProjectSelect();
}

function updateProjectSelect() {
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const projectWrapper = document.getElementById("projectFieldWrapper");
  const weekInput = document.getElementById("weekInput");

  if (!companySelect || !projectSelect || !projectWrapper || !weekInput) return;

  const company = companySelect.value;
  const week = weekInput.value;
  const monthKey = getMonthKeyFromWeek(week);

  updateProjectMonthLabel();

  if (!company || company === "General" || company === "__new_company__") {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  if (!week || !monthKey) {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  projectWrapper.classList.remove("hidden");
  projectSelect.disabled = false;

  const projects = getProjectsForCompanyAndMonth(company, monthKey);
  fillSelect(projectSelect, projects, { placeholder: "Elige un proyecto" });
}

// =====================================
//   Gestión de proyectos (meses + monognomos + nombre)
// =====================================

function promptProjectWorkers(company, projectName, currentWorkers = []) {
  const allWorkers = loadWorkers();
  const currentStr = currentWorkers.join(", ");
  const available = allWorkers.join(", ");

  const input = prompt(
    `Indica los monognomos asignados al proyecto "${projectName}" en "${getCompanyDisplayName(company)}".` +
      `\nEscribe los nombres separados por comas.` +
      `\nDisponibles: ${available}` +
      `\n\nEjemplo: Alba, Buster, Sara`,
    currentStr
  );
  if (input === null) return currentWorkers;

  const result = [];
  input
    .split(",")
    .map(n => n.trim())
    .filter(n => n)
    .forEach(n => {
      if (allWorkers.includes(n) && !result.includes(n)) {
        result.push(n);
      }
    });

  return result;
}

function handleAddProject() {
  const companySelect = document.getElementById("companySelect");
  const weekInput = document.getElementById("weekInput");
  if (!companySelect || !weekInput) return;

  const company = companySelect.value;
  const week = weekInput.value;
  const monthKey = getMonthKeyFromWeek(week);

  if (!company) {
    alert("Primero elige una empresa.");
    return;
  }

  if (company === "General") {
    alert("En la sección General no se añaden proyectos. El proyecto es 'General'.");
    return;
  }

  if (!week || !monthKey) {
    alert("Primero elige la semana. El proyecto se asociará al mes de esa semana.");
    return;
  }

  const name = prompt(
    `Nombre del nuevo proyecto para ${getCompanyDisplayName(company)} (mes ${monthKey}):`
  );
  if (!name) return;
  const projectName = name.trim();
  if (!projectName) return;

  if (nameExistsInGlobalEvents(projectName)) {
    alert(
      "Ya existe un proyecto o evento con ese nombre. " +
      "Usa el existente o escoge otro nombre para evitar duplicados."
    );
    return;
  }

  const extra = prompt(
    "Indica otros meses (formato YYYY-MM) separados por comas si quieres que también aparezca en ellos.\nEjemplo: 2025-04,2025-05\n\nDéjalo vacío si solo debe aparecer en " +
      monthKey
  );

  const monthKeys = [monthKey];

  if (extra) {
    extra
      .split(",")
      .map(m => m.trim())
      .filter(m => m)
      .forEach(m => {
        if (/^\d{4}-\d{2}$/.test(m) && !monthKeys.includes(m)) {
          monthKeys.push(m);
        }
      });
  }

  const projectsByCompany = loadProjectsByCompany();
  if (!projectsByCompany[company]) {
    projectsByCompany[company] = {};
  }
  const companyMap = projectsByCompany[company];

  monthKeys.forEach(mKey => {
    const list = companyMap[mKey] || [];
    if (!list.includes(projectName)) {
      list.push(projectName);
      list.sort((a, b) => a.localeCompare(b, "es"));
    }
    companyMap[mKey] = list;
  });

  saveProjectsByCompany(projectsByCompany);

  let projectWorkers = loadProjectWorkers();
  if (!projectWorkers[company]) projectWorkers[company] = {};
  const newWorkers = promptProjectWorkers(company, projectName, []);
  projectWorkers[company][projectName] = newWorkers;
  saveProjectWorkers(projectWorkers);

  updateProjectSelect();
  const projectSelect = document.getElementById("projectSelect");
  if (projectSelect && projectSelect.options.length > 0) {
    projectSelect.value = projectName;
  }

  refreshProjectFilterSelect();
  refreshWorkDivisionEventSelect(projectName);
}

// índice: empresa → proyecto → [meses]
function buildProjectMonthIndex() {
  const map = loadProjectsByCompany();
  const index = {};

  const companiesSet = new Set([
    ...Object.keys(map),
    ...Object.keys(PERMANENT_PROJECTS)
  ]);

  companiesSet.forEach(company => {
    const companyRaw = map[company];
    const projIndex = {};

    if (Array.isArray(companyRaw)) {
      const legacyMonth = "0000-00";
      companyRaw.forEach(projectName => {
        if (!projIndex[projectName]) {
          projIndex[projectName] = [];
        }
        if (!projIndex[projectName].includes(legacyMonth)) {
          projIndex[projectName].push(legacyMonth);
        }
      });
    } else if (companyRaw && typeof companyRaw === "object") {
      Object.keys(companyRaw).forEach(monthKey => {
        let list = companyRaw[monthKey];

        if (typeof list === "string") {
          list = [list];
        }

        if (!Array.isArray(list)) return;

        list.forEach(projectName => {
          if (!projIndex[projectName]) {
            projIndex[projectName] = [];
          }
          if (!projIndex[projectName].includes(monthKey)) {
            projIndex[projectName].push(monthKey);
          }
        });
      });
    }

    const permanents = PERMANENT_PROJECTS[company] || [];
    permanents.forEach(projectName => {
      if (!projIndex[projectName]) {
        projIndex[projectName] = [];
      }
      if (!projIndex[projectName].includes("0000-00")) {
        projIndex[projectName].push("0000-00");
      }
    });

    index[company] = projIndex;
  });

  return index;
}

// EDITAR: nombre + meses + monognomos
function editProjectMonths(company, projectName, currentMonths) {
  const nameInput = prompt(
    `Nuevo nombre para el proyecto en "${getCompanyDisplayName(company)}" (deja como está para mantenerlo):`,
    projectName
  );
  if (nameInput === null) return;
  const newProjectName = nameInput.trim() || projectName;

  if (newProjectName !== projectName && nameExistsInGlobalEvents(newProjectName)) {
    alert(
      "Ya existe un proyecto o evento con ese nombre. " +
      "Usa otro nombre diferente para evitar duplicados."
    );
    return;
  }

  const currentStr = currentMonths.join(", ");
  const monthsInput = prompt(
    `Indica los meses (formato YYYY-MM) separados por comas para el proyecto "${newProjectName}".\nEjemplo: 2025-03,2025-04\n\nDeja vacío para eliminarlo de todos los meses.`,
    currentStr
  );
  if (monthsInput === null) return;

  const newMonths = [];
  if (monthsInput.trim() !== "") {
    monthsInput
      .split(",")
      .map(m => m.trim())
      .filter(m => m)
      .forEach(m => {
        if (/^\d{4}-\d{2}$/.test(m) && !newMonths.includes(m)) {
          newMonths.push(m);
        }
      });
  }

  const projectsByCompany = loadProjectsByCompany();
  if (!projectsByCompany[company]) {
    projectsByCompany[company] = {};
  }
  const companyMap = projectsByCompany[company];

  Object.keys(companyMap).forEach(monthKey => {
    companyMap[monthKey] = (companyMap[monthKey] || []).filter(
      p => p !== projectName && p !== newProjectName
    );
    if (companyMap[monthKey].length === 0) {
      delete companyMap[monthKey];
    }
  });

  newMonths.forEach(monthKey => {
    const list = companyMap[monthKey] || [];
    if (!list.includes(newProjectName)) {
      list.push(newProjectName);
      list.sort((a, b) => a.localeCompare(b, "es"));
    }
    companyMap[monthKey] = list;
  });

  saveProjectsByCompany(projectsByCompany);

  if (newProjectName !== projectName) {
    let entries = loadEntries();
    let modified = false;
    entries.forEach(e => {
      if (e.company === company && e.project === projectName) {
        e.project = newProjectName;
        modified = true;
      }
    });
    if (modified) {
      saveEntries(entries);
    }
  }

  let projectWorkers = loadProjectWorkers();
  if (!projectWorkers[company]) projectWorkers[company] = {};
  const currentWorkers = projectWorkers[company][projectName] || [];
  const updatedWorkers = promptProjectWorkers(
    company,
    newProjectName,
    currentWorkers
  );
  projectWorkers[company][newProjectName] = updatedWorkers;
  if (newProjectName !== projectName) {
    delete projectWorkers[company][projectName];
  }

  if (
    newMonths.length === 0 &&
    (!projectWorkers[company][newProjectName] ||
      projectWorkers[company][newProjectName].length === 0)
  ) {
    delete projectWorkers[company][newProjectName];
  }
  if (Object.keys(projectWorkers[company]).length === 0) {
    delete projectWorkers[company];
  }

  saveProjectWorkers(projectWorkers);

  renderManageProjectsView();
  updateProjectSelect();
  refreshProjectFilterSelect();
  refreshWorkDivisionEventSelect();
}

// =====================================
//   Edición y borrado de registros
// =====================================

function updateEntryHours(id, newHours) {
  const entries = loadEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  entry.hours = newHours;
  saveEntries(entries);

  if (!document.getElementById("projectsView").classList.contains("hidden")) {
    renderCompanyView();
  }
}

function deleteEntry(id) {
  let entries = loadEntries();
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  if (!document.getElementById("projectsView").classList.contains("hidden")) {
    renderCompanyView();
  }
}

function handleEditClick(id) {
  const entries = loadEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  const current = entry.hours.toString().replace(".", ",");
  const result = prompt("Introduce las nuevas horas:", current);
  if (result === null) return;
  const normalized = result.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value) || value < 0) {
    alert("Valor de horas no válido.");
    return;
  }
  updateEntryHours(id, value);
}

function handleDeleteClick(id) {
  if (!confirm("¿Seguro que quieres borrar este registro de horas?")) return;
  deleteEntry(id);
}

// borrar proyecto completo + sus entradas
function deleteProject(company, project) {
  if (
    !confirm(
      `¿Seguro que quieres borrar el proyecto "${project}" de "${getCompanyDisplayName(company)}" y todas sus horas asociadas en todos los meses?`
    )
  ) {
    return;
  }

  let entries = loadEntries();
  entries = entries.filter(e => !(e.company === company && e.project === project));
  saveEntries(entries);

  const projectsByCompany = loadProjectsByCompany();
  if (projectsByCompany[company]) {
    const companyMap = projectsByCompany[company];
    Object.keys(companyMap).forEach(monthKey => {
      companyMap[monthKey] = (companyMap[monthKey] || []).filter(
        p => p !== project
      );
      if (companyMap[monthKey].length === 0) {
        delete companyMap[monthKey];
      }
    });
    saveProjectsByCompany(projectsByCompany);
  }

  let projectWorkers = loadProjectWorkers();
  if (projectWorkers[company]) {
    delete projectWorkers[company][project];
    if (Object.keys(projectWorkers[company]).length === 0) {
      delete projectWorkers[company];
    }
    saveProjectWorkers(projectWorkers);
  }

  renderCompanyView();
  renderManageProjectsView();
  refreshProjectFilterSelect();
  refreshWorkDivisionEventSelect();
}

// =====================================
//   Guardar horas
// =====================================

function handleSaveHours() {
  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const weekInput = document.getElementById("weekInput");
  const hoursInput = document.getElementById("hoursInput");

  if (!workerSelect || !companySelect || !weekInput || !hoursInput) return;

  const worker = workerSelect.value;
  const company = companySelect.value;
  const week = weekInput.value;
  const rawHours = (hoursInput.value || "").toString().replace(",", ".");
  const hours = parseFloat(rawHours);

  if (!worker || !company || !week || isNaN(hours)) {
    showMessage("Faltan datos o las horas no son válidas.", "error");
    return;
  }

  if (hours < 0) {
    showMessage("Las horas no pueden ser negativas.", "error");
    return;
  }

  let project;
  if (company === "General") {
    project = "General";
  } else {
    if (!projectSelect) {
      showMessage("Selecciona un proyecto.", "error");
      return;
    }
    project = projectSelect.value;
    if (!project) {
      showMessage("Selecciona un proyecto.", "error");
      return;
    }
  }

  const entries = loadEntries();
  const newEntry = {
    id: Date.now(),
    worker,
    company,
    project,
    week,
    hours
  };
  entries.push(newEntry);
  saveEntries(entries);

  showMessage("Horas guardadas correctamente.", "ok");

  hoursInput.value = "";
  refreshProjectFilterSelect();
}

// =====================================
//   Vista "Todos los proyectos"
// =====================================

function renderCompanyView(filter = {}) {
  const container = document.getElementById("companyView");
  if (!container) return;

  const entries = loadEntries();
  container.innerHTML = "";

  const effectiveFilter = { ...filter };
  if (!effectiveFilter.month || effectiveFilter.month === "") {
    effectiveFilter.month = getCurrentMonthKey();
  }

  const filteredEntries = entries.filter(e => {
    if (effectiveFilter.worker && e.worker !== effectiveFilter.worker) return false;
    if (effectiveFilter.company && e.company !== effectiveFilter.company) return false;
    if (effectiveFilter.project && e.project !== effectiveFilter.project) return false;
    if (effectiveFilter.month) {
      const entryMonth = getMonthKeyFromWeek(e.week);
      if (entryMonth !== effectiveFilter.month) return false;
    }
    return true;
  });

  if (filteredEntries.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No hay registros para el mes seleccionado.";
    container.appendChild(p);
    return;
  }

  const grouped = {};
  filteredEntries.forEach(e => {
    if (!grouped[e.company]) grouped[e.company] = {};
    if (!grouped[e.company][e.project]) grouped[e.company][e.project] = [];
    grouped[e.company][e.project].push(e);
  });

  const companies = sortCompaniesForView(Object.keys(grouped));

  let globalTotal = 0;

  companies.forEach(company => {
    const block = document.createElement("div");
    block.className = "company-block";

    const companyColor = getCompanyColor(company);
    block.style.borderColor = companyColor;

    const h3 = document.createElement("h3");
    h3.textContent = getCompanyDisplayName(company);
    h3.style.backgroundColor = companyColor;
    h3.style.color = "#111827";
    block.appendChild(h3);

    const projects = Object.keys(grouped[company]).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    let companyTotal = 0;

    projects.forEach(project => {
      const h4 = document.createElement("h4");
      h4.textContent = project;
      const projectColor = getProjectColor(project);
      h4.style.backgroundColor = projectColor;
      h4.style.color = "#111827";
      block.appendChild(h4);

      const table = document.createElement("table");
      const thead = document.createElement("thead");
      thead.innerHTML =
        "<tr><th>Trabajador</th><th>Semana</th><th>Horas</th><th>Acciones</th></tr>";
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      let projectTotal = 0;

      grouped[company][project].forEach(entry => {
        const tr = document.createElement("tr");
        tr.dataset.id = entry.id;

        const tdWorker = createWorkerCell(entry.worker);
        tr.appendChild(tdWorker);

        const tdWeek = document.createElement("td");
        tdWeek.textContent = formatWeekDisplay(entry.week);
        tr.appendChild(tdWeek);

        const tdHours = document.createElement("td");
        tdHours.textContent = String(entry.hours).replace(".", ",");
        tr.appendChild(tdHours);

        const tdActions = document.createElement("td");
        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit";
        editBtn.textContent = "✏️";
        editBtn.title = "Editar horas";
        editBtn.addEventListener("click", () => handleEditClick(entry.id));

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn delete";
        deleteBtn.textContent = "🗑️";
        deleteBtn.title = "Borrar registro";
        deleteBtn.addEventListener("click", () => handleDeleteClick(entry.id));

        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);

        const h = Number(entry.hours) || 0;
        projectTotal += h;
      });

      const trTotal = document.createElement("tr");
      trTotal.className = "total-row";

      const tdLabel = document.createElement("td");
      tdLabel.colSpan = 3;
      tdLabel.textContent = "Total proyecto";
      const tdTotal = document.createElement("td");
      tdTotal.textContent = projectTotal.toString().replace(".", ",");
      trTotal.appendChild(tdLabel);
      trTotal.appendChild(tdTotal);
      tbody.appendChild(trTotal);

      table.appendChild(tbody);
      block.appendChild(table);

      companyTotal += projectTotal;
    });

    const companyTotalEl = document.createElement("div");
    companyTotalEl.className = "company-total";
    companyTotalEl.textContent =
      "Total horas en " + getCompanyDisplayName(company) + ": " + companyTotal.toString().replace(".", ",");
    block.appendChild(companyTotalEl);

    container.appendChild(block);

    globalTotal += companyTotal;
  });

  const globalTotalEl = document.createElement("div");
  globalTotalEl.className = "global-total";
  globalTotalEl.textContent =
    "Total general de horas: " + globalTotal.toString().replace(".", ",");
  container.appendChild(globalTotalEl);
}

// =====================================
//   Vista "Gestionar proyectos"
// =====================================

function renderManageProjectsView() {
  const container = document.getElementById("manageProjectsContainer");
  if (!container) return;

  container.innerHTML = "";

  const index = buildProjectMonthIndex();
  const projectWorkers = loadProjectWorkers();

  const companies = sortCompaniesForView(Object.keys(index));

  let hasAny = false;
  const filterMonthKey = manageProjectsFilterMonth;

  companies.forEach(company => {
    const projIndex = index[company];

    const projectNames = Object.keys(projIndex).filter(projectName => {
      const months = projIndex[projectName] || [];

      if (!filterMonthKey) return true;

      return months.includes(filterMonthKey) || months.includes("0000-00");
    });

    if (projectNames.length === 0) return;

    hasAny = true;

    const block = document.createElement("div");
    block.className = "company-block";

    const h3 = document.createElement("h3");
    h3.textContent = getCompanyDisplayName(company);
    h3.style.backgroundColor = getCompanyColor(company);
    h3.style.color = "#111827";
    block.appendChild(h3);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Proyecto</th><th>Meses</th><th>Monognomos asignados</th><th>Acciones</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    projectNames
      .sort((a, b) => a.localeCompare(b, "es"))
      .forEach(projectName => {
        const tr = document.createElement("tr");

        const tdProject = document.createElement("td");
        tdProject.textContent = projectName;
        tdProject.style.backgroundColor = getProjectColor(projectName);
        tdProject.style.color = "#111827";
        tr.appendChild(tdProject);

        const tdMonths = document.createElement("td");
        const months = projIndex[projectName] || [];
        const pretty = months
          .slice()
          .sort()
          .map(m => formatMonthKey(m))
          .join(", ");
        tdMonths.textContent = pretty || "—";
        tr.appendChild(tdMonths);

        const tdWorkers = document.createElement("td");
        const workersForProject =
          (projectWorkers[company] &&
            projectWorkers[company][projectName]) ||
          [];
        tdWorkers.textContent =
          workersForProject.length > 0
            ? workersForProject.join(", ")
            : "—";
        tr.appendChild(tdWorkers);

        const tdActions = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit";
        editBtn.textContent = "✏️ Editar";
        editBtn.title = "Editar nombre, meses y monognomos del proyecto";
        editBtn.addEventListener("click", () =>
          editProjectMonths(company, projectName, months)
        );

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn delete";
        deleteBtn.textContent = "🗑️ Borrar";
        deleteBtn.title = "Borrar proyecto de todos los meses";
        deleteBtn.addEventListener("click", () =>
          deleteProject(company, projectName)
        );

        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });

    table.appendChild(tbody);
    block.appendChild(table);

    container.appendChild(block);
  });

  if (!hasAny) {
    const p = document.createElement("p");
    if (filterMonthKey) {
      p.textContent = `No hay proyectos para el mes ${filterMonthKey}.`;
    } else {
      p.textContent = "No hay proyectos definidos todavía.";
    }
    container.appendChild(p);
  }
}

// =====================================
//   Filtros (vista proyectos)
// =====================================

function refreshProjectFilterSelect() {
  const filterProject = document.getElementById("filterProject");
  if (!filterProject) return;

  filterProject.innerHTML = "";

  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Todos";
  filterProject.appendChild(allOpt);

  const projectsSet = new Set();

  const entries = loadEntries();
  entries.forEach(e => {
    if (e.project) projectsSet.add(e.project);
  });

  const projectsByCompany = loadProjectsByCompany();
  Object.keys(projectsByCompany).forEach(company => {
    const companyRaw = projectsByCompany[company];
    if (Array.isArray(companyRaw)) {
      companyRaw.forEach(p => projectsSet.add(p));
    } else if (companyRaw && typeof companyRaw === "object") {
      Object.values(companyRaw).forEach(list => {
        if (typeof list === "string") {
          projectsSet.add(list);
        } else if (Array.isArray(list)) {
          list.forEach(p => projectsSet.add(p));
        }
      });
    }
  });

  Object.keys(PERMANENT_PROJECTS).forEach(company => {
    PERMANENT_PROJECTS[company].forEach(p => projectsSet.add(p));
  });

  Array.from(projectsSet)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      filterProject.appendChild(opt);
    });
}

function handleFilter() {
  const workerEl = document.getElementById("filterWorker");
  const companyEl = document.getElementById("filterCompany");
  const monthEl = document.getElementById("filterMonth");
  const projectEl = document.getElementById("filterProject");

  const worker = workerEl ? workerEl.value : "";
  const company = companyEl ? companyEl.value : "";
  const month = monthEl ? monthEl.value : "";
  const project = projectEl ? projectEl.value : "";

  const filter = {};
  if (worker) filter.worker = worker;
  if (company) filter.company = company;
  if (month) filter.month = month;
  if (project) filter.project = project;

  renderCompanyView(filter);
}

// =====================================
//   Exportar CSV (todo o por mes)
// =====================================

function exportToCSV() {
  let entries = loadEntries();
  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const monthInput = prompt(
    "Introduce un mes en formato YYYY-MM para exportar solo ese mes (por ejemplo 2025-03).\nDéjalo vacío para exportar todas las horas."
  );

  let monthFilter = "";
  if (monthInput !== null) {
    const trimmed = monthInput.trim();
    if (trimmed) {
      if (!/^\d{4}-\d{2}$/.test(trimmed)) {
        alert("Formato de mes no válido. Debe ser YYYY-MM, por ejemplo 2025-03.");
        return;
      }
      monthFilter = trimmed;
    }
  }

  if (monthFilter) {
    entries = entries.filter(e => getMonthKeyFromWeek(e.week) === monthFilter);
    if (entries.length === 0) {
      alert("No hay datos para ese mes.");
      return;
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const byCompany = a.company.localeCompare(b.company, "es");
    if (byCompany !== 0) return byCompany;

    const byProject = a.project.localeCompare(b.project, "es");
    if (byProject !== 0) return byProject;

    const byWorker = a.worker.localeCompare(b.worker, "es");
    if (byWorker !== 0) return byWorker;

    return a.week.localeCompare(b.week, "es");
  });

  const lines = [];
  lines.push("Empresa;Proyecto;Monognomo;Semana;Horas");

  sorted.forEach(e => {
    const hours = e.hours ?? 0;
    const hoursStr = String(hours).replace(".", ",");
    lines.push(
      `${getCompanyDisplayName(e.company)};${e.project};${e.worker};${e.week};${hoursStr}`
    );
  });

  const groupedTotals = {};
  sorted.forEach(e => {
    const key = `${e.company}|||${e.project}`;
    const hours = Number(e.hours ?? 0) || 0;
    groupedTotals[key] = (groupedTotals[key] || 0) + hours;
  });

  lines.push("");
  lines.push("Totales por empresa y proyecto");
  lines.push("Empresa;Proyecto;;Total horas");

  Object.keys(groupedTotals)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(key => {
      const [company, project] = key.split("|||");
      const total = groupedTotals[key];
      const totalStr = String(total).replace(".", ",");
      lines.push(`${getCompanyDisplayName(company)};${project};;${totalStr}`);
    });

  const csvContent = lines.join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = monthFilter
    ? `horas_monognomos_${monthFilter}.csv`
    : "horas_monognomos.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================
//   Exportar PDF (filtrando por mes)
// =====================================

function exportProjectsPDF() {
  const monthInput = prompt(
    "Introduce un mes en formato YYYY-MM para exportar solo ese mes (por ejemplo 2025-03).\n" +
      "Déjalo vacío para exportar el mes actual."
  );

  let monthFilter = "";
  if (monthInput !== null) {
    const trimmed = monthInput.trim();
    if (trimmed) {
      if (!/^\d{4}-\d{2}$/.test(trimmed)) {
        alert("Formato de mes no válido. Debe ser YYYY-MM, por ejemplo 2025-03.");
        return;
      }
      monthFilter = trimmed;
    }
  }

  switchToProjectsView();

  if (monthFilter) {
    renderCompanyView({ month: monthFilter });
  } else {
    renderCompanyView({});
  }

  window.print();
}

// =====================================
//   Exportar División de trabajo (CSV / PDF)
// =====================================

function getFilteredWorkDivisionForExport() {
  const monthInput = document.getElementById("wdFilterMonth");
  const workerFilterEl = document.getElementById("wdFilterWorker");

  let monthKey = "";
  if (monthInput && monthInput.value) {
    monthKey = monthInput.value;
  }
  if (!monthKey) {
    monthKey = getCurrentMonthKey();
  }

  const workerFilter = workerFilterEl ? workerFilterEl.value : "";

  const all = loadWorkDivision();
  const filtered = all.filter(item => {
    const itemMonth = getMonthKeyFromDate(item.eventDate);
    if (itemMonth !== monthKey) return false;

    if (workerFilter) {
      const lf = workerFilter.toLowerCase();

      const coordProjectMatch =
        typeof item.coordProject === "string" &&
        item.coordProject.toLowerCase() === lf;

      const coordProdMatch =
        typeof item.coordProd === "string" &&
        item.coordProd.toLowerCase() === lf;

      const teamSetupMatch =
        Array.isArray(item.teamSetup) &&
        item.teamSetup.some(name => (name || "").toLowerCase() === lf);

      const teamDismantleMatch =
        Array.isArray(item.teamDismantle) &&
        item.teamDismantle.some(name => (name || "").toLowerCase() === lf);

      if (!(coordProjectMatch || coordProdMatch || teamSetupMatch || teamDismantleMatch)) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => {
    const da = a.eventDate || "";
    const db = b.eventDate || "";
    if (da !== db) return da.localeCompare(db);
    return (a.eventName || "").localeCompare(b.eventName || "", "es");
  });

  return filtered;
}

function exportWorkDivisionCSV() {
  const list = getFilteredWorkDivisionForExport();
  if (list.length === 0) {
    alert("No hay eventos para exportar con los filtros seleccionados.");
    return;
  }

  const lines = [];
  lines.push([
    "Evento",
    "Lugar",
    "Fecha evento",
    "Coordinador proyecto",
    "Coordinador producción",
    "Equipo montaje",
    "Fecha montaje",
    "Vehículo montaje",
    "Equipo desmontaje",
    "Fecha desmontaje",
    "Vehículo desmontaje",
    "Noches fuera"
  ].join(";"));

  list.forEach(item => {
    const teamSetupStr = Array.isArray(item.teamSetup)
      ? item.teamSetup.join(", ")
      : "";
    const teamDismantleStr = Array.isArray(item.teamDismantle)
      ? item.teamDismantle.join(", ")
      : "";
    const nightsValue =
      typeof item.nights === "number"
        ? item.nights.toString()
        : (item.nights || "");

    lines.push([
      item.eventName || "",
      item.place || "",
      item.eventDate || "",
      item.coordProject || "",
      item.coordProd || "",
      teamSetupStr,
      item.setupDate || "",
      item.setupVehicle || "",
      teamDismantleStr,
      item.dismantleDate || "",
      item.dismantleVehicle || "",
      nightsValue
    ].join(";"));
  });

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const monthInput = document.getElementById("wdFilterMonth");
  const monthKey = monthInput && monthInput.value ? monthInput.value : getCurrentMonthKey();
  a.download = `division_trabajo_${monthKey}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportWorkDivisionPDF() {
  switchToWorkDivisionView();
  window.print();
}

// =====================================
//   División de trabajo: helpers formulario
// =====================================

function getSelectedValues(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions).map(opt => opt.value);
}

function showWorkDivisionMessage(text, type = "ok") {
  const msgEl = document.getElementById("wdMessage");
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.classList.remove("ok", "error");
  if (text) {
    msgEl.classList.add(type);
  }
}

function clearWorkDivisionForm() {
  const placeEl = document.getElementById("wdPlace");
  const eventDateEl = document.getElementById("wdEventDate");
  const coordProjEl = document.getElementById("wdCoordProject");
  const coordProdEl = document.getElementById("wdCoordProd");
  const teamSetupEl = document.getElementById("wdTeamSetup");
  const setupDateEl = document.getElementById("wdSetupDate");
  const setupVehEl = document.getElementById("wdSetupVehicle");
  const teamDismantleEl = document.getElementById("wdTeamDismantle");
  const dismantleDateEl = document.getElementById("wdDismantleDate");
  const dismantleVehEl = document.getElementById("wdDismantleVehicle");
  const nightsEl = document.getElementById("wdNights");

  if (placeEl) placeEl.value = "";
  if (eventDateEl) eventDateEl.value = "";
  if (coordProjEl) coordProjEl.value = "";
  if (coordProdEl) coordProdEl.value = "";
  if (teamSetupEl) Array.from(teamSetupEl.options).forEach(o => (o.selected = false));
  if (setupDateEl) setupDateEl.value = "";
  if (setupVehEl) setupVehEl.value = "";
  if (teamDismantleEl) Array.from(teamDismantleEl.options).forEach(o => (o.selected = false));
  if (dismantleDateEl) dismantleDateEl.value = "";
  if (dismantleVehEl) dismantleVehEl.value = "";
  if (nightsEl) nightsEl.value = "";
}

function fillWorkDivisionFormFromItem(item) {
  const eventSelect = document.getElementById("wdEventSelect");
  const placeEl = document.getElementById("wdPlace");
  const eventDateEl = document.getElementById("wdEventDate");
  const coordProjEl = document.getElementById("wdCoordProject");
  const coordProdEl = document.getElementById("wdCoordProd");
  const teamSetupEl = document.getElementById("wdTeamSetup");
  const setupDateEl = document.getElementById("wdSetupDate");
  const setupVehEl = document.getElementById("wdSetupVehicle");
  const teamDismantleEl = document.getElementById("wdTeamDismantle");
  const dismantleDateEl = document.getElementById("wdDismantleDate");
  const dismantleVehEl = document.getElementById("wdDismantleVehicle");
  const nightsEl = document.getElementById("wdNights");

  if (eventSelect) {
    const opt = Array.from(eventSelect.options).find(o => o.value === item.eventName);
    if (opt) eventSelect.value = item.eventName;
  }

  if (placeEl) placeEl.value = item.place || "";
  if (eventDateEl) eventDateEl.value = item.eventDate || "";
  if (coordProjEl) coordProjEl.value = item.coordProject || "";
  if (coordProdEl) coordProdEl.value = item.coordProd || "";

  if (teamSetupEl) {
    Array.from(teamSetupEl.options).forEach(o => {
      o.selected = Array.isArray(item.teamSetup) && item.teamSetup.includes(o.value);
    });
  }

  if (setupDateEl) setupDateEl.value = item.setupDate || "";
  if (setupVehEl) setupVehEl.value = item.setupVehicle || "";

  if (teamDismantleEl) {
    Array.from(teamDismantleEl.options).forEach(o => {
      o.selected =
        Array.isArray(item.teamDismantle) && item.teamDismantle.includes(o.value);
    });
  }

  if (dismantleDateEl) dismantleDateEl.value = item.dismantleDate || "";
  if (dismantleVehEl) dismantleVehEl.value = item.dismantleVehicle || "";
  if (nightsEl) {
    nightsEl.value =
      typeof item.nights === "number"
        ? item.nights.toString()
        : (item.nights || "");
  }
}

// NUEVO: iniciar edición desde un evento concreto
function startEditEvent(id) {
  const wdFormCard = document.getElementById("wdFormCard");
  const msgEl = document.getElementById("wdMessage");
  const wdEventSelect = document.getElementById("wdEventSelect");

  const list = loadWorkDivision();
  const item = list.find(it => it.id === id);
  if (!item) {
    showWorkDivisionMessage("No se ha encontrado ese evento.", "error");
    return;
  }

  wdMode = "edit";
  wdEditingId = id;

  if (wdFormCard) wdFormCard.classList.remove("hidden");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.classList.remove("ok", "error");
  }

  if (wdEventSelect) {
    refreshWorkDivisionEventSelect(item.eventName);
  }

  fillWorkDivisionFormFromItem(item);
}

function enterAddEventMode() {
  wdMode = "add";
  wdEditingId = null;

  const wdFormCard = document.getElementById("wdFormCard");
  const msgEl = document.getElementById("wdMessage");
  const wdEventSelect = document.getElementById("wdEventSelect");

  if (wdFormCard) wdFormCard.classList.remove("hidden");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.classList.remove("ok", "error");
  }

  clearWorkDivisionForm();

  if (wdEventSelect) {
    if (wdEventSelect.options.length > 0) {
      wdEventSelect.selectedIndex = 0;
    }
  }
}

function enterEditEventMode() {
  wdMode = "edit";
  wdEditingId = null;

  const wdFormCard = document.getElementById("wdFormCard");
  const msgEl = document.getElementById("wdMessage");
  const wdEventSelect = document.getElementById("wdEventSelect");

  if (wdFormCard) wdFormCard.classList.remove("hidden");
  if (msgEl) {
    msgEl.textContent = "Para editar un evento, despliega el evento en la lista y pulsa en '✏️ Editar evento'.";
    msgEl.classList.remove("ok");
    msgEl.classList.add("error");
  }

  clearWorkDivisionForm();

  if (wdEventSelect) {
    if (wdEventSelect.options.length > 0) {
      wdEventSelect.selectedIndex = 0;
    }
  }
}

// =====================================
//   División de trabajo: guardar/listar
// =====================================

function handleSaveWorkDivision() {
  const eventSelect = document.getElementById("wdEventSelect");
  const placeEl = document.getElementById("wdPlace");
  const eventDateEl = document.getElementById("wdEventDate");
  const coordProjEl = document.getElementById("wdCoordProject");
  const coordProdEl = document.getElementById("wdCoordProd");
  const teamSetupEl = document.getElementById("wdTeamSetup");
  const setupDateEl = document.getElementById("wdSetupDate");
  const setupVehEl = document.getElementById("wdSetupVehicle");
  const teamDismantleEl = document.getElementById("wdTeamDismantle");
  const dismantleDateEl = document.getElementById("wdDismantleDate");
  const dismantleVehEl = document.getElementById("wdDismantleVehicle");
  const nightsEl = document.getElementById("wdNights");

  if (!eventSelect || !eventDateEl) return;

  let eventName = eventSelect.value;
  const place = (placeEl && placeEl.value || "").trim();
  const eventDate = eventDateEl.value || "";
  const coordProject = coordProjEl ? coordProjEl.value : "";
  const coordProd = coordProdEl ? coordProdEl.value : "";
  const teamSetup = getSelectedValues(teamSetupEl);
  const setupDate = setupDateEl ? setupDateEl.value : "";
  const setupVehicle = setupVehEl ? setupVehEl.value : "";
  const teamDismantle = getSelectedValues(teamDismantleEl);
  const dismantleDate = dismantleDateEl ? dismantleDateEl.value : "";
  const dismantleVehicle = dismantleVehEl ? dismantleVehEl.value : "";
  const nights = nightsEl ? (nightsEl.value || "").trim() : "";

  if (!eventName || !eventDate) {
    showWorkDivisionMessage("Falta el nombre del evento o la fecha del evento.", "error");
    return;
  }

  const list = loadWorkDivision();

  if (wdMode === "edit" && wdEditingId !== null) {
    const idx = list.findIndex(item => item.id === wdEditingId);
    if (idx === -1) {
      showWorkDivisionMessage(
        "No se ha encontrado el evento a editar (puede que se haya borrado).",
        "error"
      );
      return;
    }

    const updated = {
      ...list[idx],
      eventName,
      place,
      eventDate,
      coordProject,
      coordProd,
      teamSetup,
      setupDate,
      setupVehicle,
      teamDismantle,
      dismantleDate,
      dismantleVehicle,
      nights
    };

    list[idx] = updated;
    saveWorkDivision(list);
    showWorkDivisionMessage("Evento actualizado correctamente.", "ok");

    wdMode = "add";
    wdEditingId = null;
  } else {
    const newItem = {
      id: Date.now(),
      eventName,
      place,
      eventDate,
      coordProject,
      coordProd,
      teamSetup,
      setupDate,
      setupVehicle,
      teamDismantle,
      dismantleDate,
      dismantleVehicle,
      nights
    };

    list.push(newItem);
    saveWorkDivision(list);

    showWorkDivisionMessage("División de trabajo guardada correctamente.", "ok");
  }

  clearWorkDivisionForm();

  refreshWorkDivisionEventSelect(eventName);
  renderWorkDivisionList();
}

function deleteWorkDivisionItem(id) {
  let list = loadWorkDivision();
  list = list.filter(item => item.id !== id);

  if (id === wdEditingId) {
    wdEditingId = null;
    wdMode = "add";
  }

  saveWorkDivision(list);
  refreshWorkDivisionEventSelect();
  renderWorkDivisionList();
}

function renderWorkDivisionList(explicitMonth) {
  const container = document.getElementById("wdListContainer");
  const monthInput = document.getElementById("wdFilterMonth");
  const workerFilterEl = document.getElementById("wdFilterWorker");
  if (!container) return;

  let monthKey = explicitMonth || "";
  if (!monthKey && monthInput && monthInput.value) {
    monthKey = monthInput.value;
  }
  if (!monthKey) {
    monthKey = getCurrentMonthKey();
    if (monthInput && !monthInput.value) {
      monthInput.value = monthKey;
    }
  }

  const workerFilter = workerFilterEl ? workerFilterEl.value : "";

  const all = loadWorkDivision();
  const filtered = all.filter(item => {
    const itemMonth = getMonthKeyFromDate(item.eventDate);
    if (itemMonth !== monthKey) return false;

    if (workerFilter) {
      const lf = workerFilter.toLowerCase();

      const coordProjectMatch =
        typeof item.coordProject === "string" &&
        item.coordProject.toLowerCase() === lf;

      const coordProdMatch =
        typeof item.coordProd === "string" &&
        item.coordProd.toLowerCase() === lf;

      const teamSetupMatch =
        Array.isArray(item.teamSetup) &&
        item.teamSetup.some(name => (name || "").toLowerCase() === lf);

      const teamDismantleMatch =
        Array.isArray(item.teamDismantle) &&
        item.teamDismantle.some(name => (name || "").toLowerCase() === lf);

      if (!(coordProjectMatch || coordProdMatch || teamSetupMatch || teamDismantleMatch)) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => {
    const da = a.eventDate || "";
    const db = b.eventDate || "";
    if (da !== db) return da.localeCompare(db);
    return (a.eventName || "").localeCompare(b.eventName || "", "es");
  });

  container.innerHTML = "";

  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No hay eventos para este mes.";
    container.appendChild(p);
    return;
  }

  filtered.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.className = "wd-item";
    wrapper.dataset.id = item.id;

    const header = document.createElement("div");
    header.className = "wd-item-header";

    const title = document.createElement("div");
    title.className = "wd-item-title";
    title.textContent = item.eventName;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "6px";

    const date = document.createElement("div");
    date.className = "wd-item-date";
    date.textContent = item.eventDate || "";

    const toggle = document.createElement("div");
    toggle.className = "wd-item-toggle";
    toggle.textContent = "▼";

    right.appendChild(date);
    right.appendChild(toggle);

    header.appendChild(title);
    header.appendChild(right);

    wrapper.appendChild(header);

    const details = document.createElement("div");
    details.className = "wd-item-details";

    function addDetail(label, value) {
      if (!value) return;
      const row = document.createElement("div");
      row.className = "wd-detail-row";

      const spanLabel = document.createElement("span");
      spanLabel.className = "wd-detail-label";
      spanLabel.textContent = label + ":";

      const spanValue = document.createElement("span");
      spanValue.textContent = value;

      row.appendChild(spanLabel);
      row.appendChild(spanValue);
      details.appendChild(row);
    }

    addDetail("Lugar", item.place);
    addDetail("Coordinador proyecto", item.coordProject);
    addDetail("Coordinador producción", item.coordProd);
    addDetail("Equipo montaje", (item.teamSetup || []).join(", "));
    addDetail("Fecha montaje", item.setupDate);
    addDetail("Vehículo montaje", item.setupVehicle);
    addDetail("Equipo desmontaje", (item.teamDismantle || []).join(", "));
    addDetail("Fecha desmontaje", item.dismantleDate);
    addDetail("Vehículo desmontaje", item.dismantleVehicle);

    const nightsValue =
      typeof item.nights === "number"
        ? item.nights.toString()
        : (item.nights || "");
    addDetail("Noches fuera", nightsValue);

    const actions = document.createElement("div");
    actions.className = "wd-item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit";
    editBtn.textContent = "✏️ Editar evento";
    editBtn.addEventListener("click", e => {
      e.stopPropagation();
      startEditEvent(item.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn delete";
    deleteBtn.textContent = "🗑️ Borrar evento";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (confirm("¿Seguro que quieres borrar este evento?")) {
        deleteWorkDivisionItem(item.id);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    details.appendChild(actions);

    wrapper.appendChild(details);

    header.addEventListener("click", () => {
      const isOpen = wrapper.classList.contains("open");
      if (isOpen) {
        wrapper.classList.remove("open");
        toggle.textContent = "▼";
      } else {
        wrapper.classList.add("open");
        toggle.textContent = "▲";
      }
    });

    container.appendChild(wrapper);
  });
}

// =====================================
//   Tabs
// =====================================

function switchToMainView() {
  const mainView = document.getElementById("mainView");
  const projectsView = document.getElementById("projectsView");
  const manageView = document.getElementById("manageProjectsView");
  const workDivisionView = document.getElementById("workDivisionView");
  if (!mainView || !projectsView || !manageView) return;

  mainView.classList.remove("hidden");
  projectsView.classList.add("hidden");
  manageView.classList.add("hidden");
  if (workDivisionView) workDivisionView.classList.add("hidden");

  document.getElementById("tabMain").classList.add("active");
  document.getElementById("tabProjects").classList.remove("active");
  document.getElementById("tabManageProjects").classList.remove("active");
  const tabWorkDivision = document.getElementById("tabWorkDivision");
  if (tabWorkDivision) tabWorkDivision.classList.remove("active");
}

function switchToProjectsView() {
  const mainView = document.getElementById("mainView");
  const projectsView = document.getElementById("projectsView");
  const manageView = document.getElementById("manageProjectsView");
  const workDivisionView = document.getElementById("workDivisionView");
  if (!mainView || !projectsView || !manageView) return;

  mainView.classList.add("hidden");
  projectsView.classList.remove("hidden");
  manageView.classList.add("hidden");
  if (workDivisionView) workDivisionView.classList.add("hidden");

  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.add("active");
  document.getElementById("tabManageProjects").classList.remove("active");
  const tabWorkDivision = document.getElementById("tabWorkDivision");
  if (tabWorkDivision) tabWorkDivision.classList.remove("active");

  renderCompanyView();
}

function switchToManageProjectsView() {
  const mainView = document.getElementById("mainView");
  const projectsView = document.getElementById("projectsView");
  const manageView = document.getElementById("manageProjectsView");
  const workDivisionView = document.getElementById("workDivisionView");
  if (!mainView || !projectsView || !manageView) return;

  mainView.classList.add("hidden");
  projectsView.classList.add("hidden");
  manageView.classList.remove("hidden");
  if (workDivisionView) workDivisionView.classList.add("hidden");

  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.remove("active");
  document.getElementById("tabManageProjects").classList.add("active");
  const tabWorkDivision = document.getElementById("tabWorkDivision");
  if (tabWorkDivision) tabWorkDivision.classList.remove("active");

  const monthInput = document.getElementById("manageProjectsMonth");
  if (monthInput && !monthInput.value && !manageProjectsFilterMonth) {
    const currentMonth = getCurrentMonthKey();
    manageProjectsFilterMonth = currentMonth;
    monthInput.value = currentMonth;
  }

  renderManageProjectsView();
}

function switchToWorkDivisionView() {
  const mainView = document.getElementById("mainView");
  const projectsView = document.getElementById("projectsView");
  const manageView = document.getElementById("manageProjectsView");
  const workDivisionView = document.getElementById("workDivisionView");
  const wdFormCard = document.getElementById("wdFormCard");
  if (!mainView || !projectsView || !manageView || !workDivisionView) return;

  mainView.classList.add("hidden");
  projectsView.classList.add("hidden");
  manageView.classList.add("hidden");
  workDivisionView.classList.remove("hidden");

  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.remove("active");
  document.getElementById("tabManageProjects").classList.remove("active");
  const tabWorkDivision = document.getElementById("tabWorkDivision");
  if (tabWorkDivision) tabWorkDivision.classList.add("active");

  if (wdFormCard) wdFormCard.classList.add("hidden");

  renderWorkDivisionList();
}

// =====================================
//   Login
// =====================================

function handleLogin() {
  const loginView = document.getElementById("loginView");
  const protectedContent = document.getElementById("protectedContent");
  const passwordInput = document.getElementById("passwordInput");
  const loginMessage = document.getElementById("loginMessage");
  const rememberPassword = document.getElementById("rememberPassword");

  if (!loginView || !protectedContent || !passwordInput || !loginMessage) return;

  const value = passwordInput.value || "";

  // Validación en servidor (api.php?action=login)
  fetch(`${API_BASE_URL}?action=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: value })
  })
    .then(r => r.json())
    .then(data => {
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
      } else {
        loginMessage.textContent = "Contraseña incorrecta.";
        loginMessage.classList.remove("ok");
        loginMessage.classList.add("error");
        passwordInput.value = "";
        passwordInput.focus();
        setRememberLogin(false);
      }
    })
    .catch(err => {
      console.error(err);
      loginMessage.textContent = "Error de conexión con el servidor.";
      loginMessage.classList.remove("ok");
      loginMessage.classList.add("error");
    });
}

// =====================================
//   Init
// =====================================

function init() {
  // --- Login ---
  const loginView = document.getElementById("loginView");
  const protectedContent = document.getElementById("protectedContent");
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");

  if (loginView && protectedContent) {
    if (isRememberLoginEnabled()) {
      loginView.classList.add("hidden");
      protectedContent.classList.remove("hidden");
      fetchEntriesFromServer();
      fetchProjectsConfigFromServer();
      fetchWorkDivisionFromServer();
    } else {
      loginView.classList.remove("hidden");
      protectedContent.classList.add("hidden");
    }
  }

  if (loginBtn && passwordInput) {
    loginBtn.addEventListener("click", handleLogin);
    passwordInput.addEventListener("keydown", e => {
      if (e.key === "Enter") handleLogin();
    });
  }

  // --- App principal ---
  const workers = loadWorkers();
  const vehicles = loadVehicles();
  loadCompanies();

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const weekInput = document.getElementById("weekInput");
  const filterMonth = document.getElementById("filterMonth");

  fillSelect(workerSelect, workers, { placeholder: "Elige tu monognomo" });

  refreshCompanySelects();

  if (projectSelect) {
    projectSelect.innerHTML = "";
    projectSelect.disabled = true;
  }

  if (filterWorker) {
    filterWorker.innerHTML = "";
    const allWorkersOpt = document.createElement("option");
    allWorkersOpt.value = "";
    allWorkersOpt.textContent = "Todos";
    filterWorker.appendChild(allWorkersOpt);
    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      filterWorker.appendChild(opt);
    });
  }

  if (weekInput) weekInput.value = "";
  // Por defecto, en "Ver todos los proyectos" mostramos el mes actual
  if (filterMonth) filterMonth.value = getCurrentMonthKey();

  const wdTeamSetup = document.getElementById("wdTeamSetup");
  const wdTeamDismantle = document.getElementById("wdTeamDismantle");
  if (wdTeamSetup) {
    wdTeamSetup.innerHTML = "";
    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      wdTeamSetup.appendChild(opt);
    });
  }
  if (wdTeamDismantle) {
    wdTeamDismantle.innerHTML = "";
    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      wdTeamDismantle.appendChild(opt);
    });
  }

  const wdFilterWorker = document.getElementById("wdFilterWorker");
  if (wdFilterWorker) {
    wdFilterWorker.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "Todos";
    wdFilterWorker.appendChild(allOpt);
    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      wdFilterWorker.appendChild(opt);
    });
    wdFilterWorker.addEventListener("change", () => renderWorkDivisionList());
  }

  const wdCoordProject = document.getElementById("wdCoordProject");
  if (wdCoordProject) {
    wdCoordProject.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige coordinador";
    placeholder.disabled = true;
    placeholder.selected = true;
    wdCoordProject.appendChild(placeholder);

    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      wdCoordProject.appendChild(opt);
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_worker__";
    addOpt.textContent = "➕ Añadir monognomo...";
    wdCoordProject.appendChild(addOpt);

    wdCoordProject.addEventListener("change", () => {
      if (wdCoordProject.value === "__new_worker__") {
        handleNewWorker(wdCoordProject);
      }
    });
  }

  const wdCoordProd = document.getElementById("wdCoordProd");
  if (wdCoordProd) {
    wdCoordProd.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige coordinador";
    placeholder.disabled = true;
    placeholder.selected = true;
    wdCoordProd.appendChild(placeholder);

    workers.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      wdCoordProd.appendChild(opt);
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_worker__";
    addOpt.textContent = "➕ Añadir monognomo...";
    wdCoordProd.appendChild(addOpt);

    wdCoordProd.addEventListener("change", () => {
      if (wdCoordProd.value === "__new_worker__") {
        handleNewWorker(wdCoordProd);
      }
    });
  }

  const wdSetupVehicle = document.getElementById("wdSetupVehicle");
  if (wdSetupVehicle) {
    wdSetupVehicle.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige vehículo";
    placeholder.disabled = true;
    placeholder.selected = true;
    wdSetupVehicle.appendChild(placeholder);

    vehicles.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      wdSetupVehicle.appendChild(opt);
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_vehicle__";
    addOpt.textContent = "➕ Añadir vehículo...";
    wdSetupVehicle.appendChild(addOpt);

    wdSetupVehicle.addEventListener("change", () => {
      if (wdSetupVehicle.value === "__new_vehicle__") {
        handleNewVehicle(wdSetupVehicle);
      }
    });
  }

  const wdDismantleVehicle = document.getElementById("wdDismantleVehicle");
  if (wdDismantleVehicle) {
    wdDismantleVehicle.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige vehículo";
    placeholder.disabled = true;
    placeholder.selected = true;
    wdDismantleVehicle.appendChild(placeholder);

    vehicles.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      wdDismantleVehicle.appendChild(opt);
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_vehicle__";
    addOpt.textContent = "➕ Añadir vehículo...";
    wdDismantleVehicle.appendChild(addOpt);

    wdDismantleVehicle.addEventListener("change", () => {
      if (wdDismantleVehicle.value === "__new_vehicle__") {
        handleNewVehicle(wdDismantleVehicle);
      }
    });
  }

  refreshWorkDivisionEventSelect();

  const wdEventSelect = document.getElementById("wdEventSelect");
  if (wdEventSelect) {
    // solo lista eventos existentes (no crea nuevos)
  }

  if (companySelect) {
    companySelect.addEventListener("change", handleCompanyChange);
  }
  if (weekInput) {
    weekInput.addEventListener("change", updateProjectSelect);
  }

  const addProjectBtn = document.getElementById("addProjectBtn");
  if (addProjectBtn) addProjectBtn.addEventListener("click", handleAddProject);

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.addEventListener("click", handleSaveHours);

  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn) filterBtn.addEventListener("click", handleFilter);

  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportToCSV);

  const pdfBtn = document.getElementById("exportPdfBtn");
  if (pdfBtn) pdfBtn.addEventListener("click", exportProjectsPDF);

  const tabMain = document.getElementById("tabMain");
  const tabProjects = document.getElementById("tabProjects");
  const tabManage = document.getElementById("tabManageProjects");
  const tabWorkDivision = document.getElementById("tabWorkDivision");
  if (tabMain) tabMain.addEventListener("click", switchToMainView);
  if (tabProjects) tabProjects.addEventListener("click", switchToProjectsView);
  if (tabManage) tabManage.addEventListener("click", switchToManageProjectsView);
  if (tabWorkDivision) tabWorkDivision.addEventListener("click", switchToWorkDivisionView);

  if (workerSelect) {
    workerSelect.addEventListener("change", updateWorkerPhoto);
  }
  updateWorkerPhoto();
  updateProjectMonthLabel();

  const wdSaveBtn = document.getElementById("wdSaveBtn");
  if (wdSaveBtn) wdSaveBtn.addEventListener("click", handleSaveWorkDivision);

  const wdFilterBtn = document.getElementById("wdFilterBtn");
  if (wdFilterBtn) wdFilterBtn.addEventListener("click", () => renderWorkDivisionList());

  const wdShowFormBtn = document.getElementById("wdShowFormBtn");
  const wdFormCard = document.getElementById("wdFormCard");

  if (wdShowFormBtn && wdFormCard) {
    wdShowFormBtn.addEventListener("click", () => {
      if (wdFormCard.classList.contains("hidden")) {
        enterAddEventMode();
      } else {
        wdFormCard.classList.add("hidden");
      }
    });
  }

  const wdExportCsvBtn = document.getElementById("wdExportCsvBtn");
  if (wdExportCsvBtn) wdExportCsvBtn.addEventListener("click", exportWorkDivisionCSV);

  const wdExportPdfBtn = document.getElementById("wdExportPdfBtn");
  if (wdExportPdfBtn) wdExportPdfBtn.addEventListener("click", exportWorkDivisionPDF);

  const manageMonthInput = document.getElementById("manageProjectsMonth");
  const manageMonthBtn = document.getElementById("manageProjectsMonthBtn");
  const manageMonthClearBtn = document.getElementById("manageProjectsMonthClearBtn");

  if (manageMonthInput) {
    manageMonthInput.value = manageProjectsFilterMonth || "";
  }

  if (manageMonthBtn) {
    manageMonthBtn.addEventListener("click", () => {
      manageProjectsFilterMonth = manageMonthInput ? (manageMonthInput.value || "") : "";
      renderManageProjectsView();
    });
  }

  if (manageMonthClearBtn) {
    manageMonthClearBtn.addEventListener("click", () => {
      manageProjectsFilterMonth = "";
      if (manageMonthInput) manageMonthInput.value = "";
      renderManageProjectsView();
    });
  }

  refreshProjectFilterSelect();
  renderWorkDivisionList();
}

document.addEventListener("DOMContentLoaded", init);
