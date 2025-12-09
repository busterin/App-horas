// ==============================
//  Claves en localStorage
// ==============================
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa", // incluye meses
  ENTRIES: "appHoras_registros",
  WORKERS: "appHoras_trabajadores",
  COMPANIES: "appHoras_empresas",
  PROJECT_WORKERS: "appHoras_proyectoTrabajadores" // monognomos asignados a proyectos
};

// Empresas disponibles (por defecto)
const DEFAULT_COMPANIES = [
  "Monognomo",
  "Neozink",
  "Yurmuvi",
  "Picofino",
  "Guardianes",
  "Escuela Energía",
  "General"
];

// Trabajadores (sin iconos, solo nombre)
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

// Proyectos iniciales por empresa *y mes*.
// Estructura: { empresa: { "YYYY-MM": ["Proyecto 1", "Proyecto 2"] } }
const DEFAULT_PROJECTS_BY_COMPANY = {
  Monognomo: {},
  Neozink: {},
  Yurmuvi: {},
  Picofino: {},
  Guardianes: {},
  "Escuela Energía": {},
  General: {}
};

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

function loadProjectsByCompany() {
  return loadFromStorage(
    STORAGE_KEYS.PROJECTS_BY_COMPANY,
    DEFAULT_PROJECTS_BY_COMPANY
  );
}

function saveProjectsByCompany(map) {
  saveToStorage(STORAGE_KEYS.PROJECTS_BY_COMPANY, map);
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

function loadEntries() {
  return loadFromStorage(STORAGE_KEYS.ENTRIES, []);
}

function saveEntries(entries) {
  saveToStorage(STORAGE_KEYS.ENTRIES, entries);
}

// mapa empresa → proyecto → [monognomos]
function loadProjectWorkers() {
  return loadFromStorage(STORAGE_KEYS.PROJECT_WORKERS, {});
}

function saveProjectWorkers(map) {
  saveToStorage(STORAGE_KEYS.PROJECT_WORKERS, map);
}

// =====================================
//   Utilidades de UI generales
// =====================================

function fillSelect(selectEl, items, { placeholder } = {}) {
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
  msgEl.textContent = text;
  msgEl.classList.remove("ok", "error");
  if (text) {
    msgEl.classList.add(type);
  }
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

// primer día (lunes) de la semana
function getFirstDayDateFromWeek(weekValue) {
  if (!weekValue) return null;
  const parts = weekValue.split("-W");
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const day = d.getDay(); // 0 = domingo, 1 = lunes
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// "dd-mm-yy"
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
  const month = parseInt(monthStr, 10);
  if (!month || month < 1 || month > 12) return monthKey;
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

// mes actual "YYYY-MM"
function getCurrentMonthKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

// proyectos para empresa+mes
function getProjectsForCompanyAndMonth(company, monthKey) {
  if (!company || !monthKey) return [];
  const map = loadProjectsByCompany();
  const companyData = map[company] || {};
  const list = companyData[monthKey] || [];
  return [...list];
}

// etiqueta mes en formulario
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
//   Cambio de empresa/semana: proyectos
// =====================================

function refreshCompanySelects(selectedCompany) {
  const companies = loadCompanies();
  const companySelect = document.getElementById("companySelect");
  const filterCompany = document.getElementById("filterCompany");

  if (companySelect) {
    fillSelect(companySelect, companies, {
      placeholder: "Elige una empresa/proyecto prin."
    });

    const addOpt = document.createElement("option");
    addOpt.value = "__new_company__";
    addOpt.textContent = "➕ Añadir empresa nueva...";
    companySelect.appendChild(addOpt);

    if (selectedCompany) {
      companySelect.value = selectedCompany;
    }
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
      opt.textContent = c;
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
    `Indica los monognomos asignados al proyecto "${projectName}" en "${company}".` +
      `\nEscribe los nombres separados por comas.` +
      `\nDisponibles: ${available}` +
      `\n\nEjemplo: Alba, Buster, Sara`,
    currentStr
  );
  if (input === null) {
    return currentWorkers;
  }

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

  const name = prompt(`Nombre del nuevo proyecto para ${company} (mes ${monthKey}):`);
  if (!name) return;
  const projectName = name.trim();
  if (!projectName) return;

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
}

// índice: empresa → proyecto → [meses]
function buildProjectMonthIndex() {
  const map = loadProjectsByCompany();
  const index = {};

  Object.keys(map).forEach(company => {
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

    index[company] = projIndex;
  });

  return index;
}

// EDITAR: nombre + meses + monognomos
function editProjectMonths(company, projectName, currentMonths) {
  // 1) Nuevo nombre
  const nameInput = prompt(
    `Nuevo nombre para el proyecto en "${company}" (deja como está para mantenerlo):`,
    projectName
  );
  if (nameInput === null) return;
  const newProjectName = nameInput.trim() || projectName;

  // 2) Meses
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

  // quitar nombre antiguo (y posible nuevo) de todos los meses
  Object.keys(companyMap).forEach(monthKey => {
    companyMap[monthKey] = (companyMap[monthKey] || []).filter(
      p => p !== projectName && p !== newProjectName
    );
    if (companyMap[monthKey].length === 0) {
      delete companyMap[monthKey];
    }
  });

  // añadir a los nuevos meses con el nuevo nombre
  newMonths.forEach(monthKey => {
    const list = companyMap[monthKey] || [];
    if (!list.includes(newProjectName)) {
      list.push(newProjectName);
      list.sort((a, b) => a.localeCompare(b, "es"));
    }
    companyMap[monthKey] = list;
  });

  saveProjectsByCompany(projectsByCompany);

  // 3) Renombrar entradas de horas
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

  // 4) Monognomos asignados
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

  renderTable();
  if (!document.getElementById("projectsView").classList.contains("hidden")) {
    renderCompanyView();
  }
}

function deleteEntry(id) {
  let entries = loadEntries();
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  renderTable();
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
      `¿Seguro que quieres borrar el proyecto "${project}" de "${company}" y todas sus horas asociadas en todos los meses?`
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

  renderTable();
  renderCompanyView();
  renderManageProjectsView();
  refreshProjectFilterSelect();
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
  renderTable();
  refreshProjectFilterSelect();
}

// =====================================
//   Tabla de "resumen rápido" (siempre oculta)
// =====================================

function renderTable(filter = {}) {
  const tbody = document.getElementById("entriesTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.textContent =
    "Los registros detallados se consultan en la vista agrupada de abajo.";
  tr.appendChild(td);
  tbody.appendChild(tr);
}

// =====================================
//   Vista "Todos los proyectos" (agrupada)
// =====================================

function renderCompanyView(filter = {}) {
  const container = document.getElementById("companyView");
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

  const companies = Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  let globalTotal = 0;

  companies.forEach(company => {
    const block = document.createElement("div");
    block.className = "company-block";

    const h3 = document.createElement("h3");
    h3.textContent = company;
    block.appendChild(h3);

    const projects = Object.keys(grouped[company]).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    let companyTotal = 0;

    projects.forEach(project => {
      const h4 = document.createElement("h4");
      h4.textContent = project;
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
        tdHours.textContent = entry.hours.toString().replace(".", ",");
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

        projectTotal += entry.hours;
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

      // OJO: aquí ya NO aparece "Borrar proyecto completo"
      companyTotal += projectTotal;
    });

    const companyTotalEl = document.createElement("div");
    companyTotalEl.className = "company-total";
    companyTotalEl.textContent =
      "Total horas en " + company + ": " + companyTotal.toString().replace(".", ",");
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
  container.innerHTML = "";

  const index = buildProjectMonthIndex();
  const projectWorkers = loadProjectWorkers();

  const companies = Object.keys(index).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  let hasAny = false;

  companies.forEach(company => {
    const projIndex = index[company];
    const projectNames = Object.keys(projIndex);
    if (projectNames.length === 0) return;

    hasAny = true;

    const block = document.createElement("div");
    block.className = "company-block";

    const h3 = document.createElement("h3");
    h3.textContent = company;
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
    p.textContent = "No hay proyectos definidos todavía.";
    container.appendChild(p);
  }
}

// =====================================
//   Filtro de proyectos (desplegable)
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
    if (e.project) {
      projectsSet.add(e.project);
    }
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

  Array.from(projectsSet)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      filterProject.appendChild(opt);
    });
}

// =====================================
//   Filtros (afectan SOLO a vista agrupada)
// =====================================

function handleFilter() {
  const worker = document.getElementById("filterWorker").value;
  const company = document.getElementById("filterCompany").value;
  const month = document.getElementById("filterMonth").value;
  const project = document.getElementById("filterProject").value;

  const filter = {};
  if (worker) filter.worker = worker;
  if (company) filter.company = company;
  if (month) filter.month = month;
  if (project) filter.project = project;

  renderTable();           // listado siempre en modo mensaje
  renderCompanyView(filter);
}

// =====================================
//   Exportar CSV
// =====================================

function exportToCSV() {
  const entries = loadEntries();
  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
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
      `${e.company};${e.project};${e.worker};${e.week};${hoursStr}`
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
      lines.push(`${company};${project};;${totalStr}`);
    });

  const csvContent = lines.join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "horas_monognomos.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================
//   Exportar PDF
// =====================================

function exportProjectsPDF() {
  switchToProjectsView();
  window.print();
}

// =====================================
//   Tabs
// =====================================

function switchToMainView() {
  document.getElementById("mainView").classList.remove("hidden");
  document.getElementById("projectsView").classList.add("hidden");
  document.getElementById("manageProjectsView").classList.add("hidden");
  document.getElementById("tabMain").classList.add("active");
  document.getElementById("tabProjects").classList.remove("active");
  document.getElementById("tabManageProjects").classList.remove("active");
}

function switchToProjectsView() {
  document.getElementById("mainView").classList.add("hidden");
  document.getElementById("projectsView").classList.remove("hidden");
  document.getElementById("manageProjectsView").classList.add("hidden");
  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.add("active");
  document.getElementById("tabManageProjects").classList.remove("active");

  renderTable();
  renderCompanyView();
}

function switchToManageProjectsView() {
  document.getElementById("mainView").classList.add("hidden");
  document.getElementById("projectsView").classList.add("hidden");
  document.getElementById("manageProjectsView").classList.remove("hidden");
  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.remove("active");
  document.getElementById("tabManageProjects").classList.add("active");
  renderManageProjectsView();
}

// =====================================
//   Login
// =====================================

function handleLogin() {
  const loginView = document.getElementById("loginView");
  const protectedContent = document.getElementById("protectedContent");
  const passwordInput = document.getElementById("passwordInput");
  const loginMessage = document.getElementById("loginMessage");

  const value = passwordInput.value || "";

  if (value === "Mayurni123!") {
    loginView.classList.add("hidden");
    protectedContent.classList.remove("hidden");
    passwordInput.value = "";
    loginMessage.textContent = "";
    loginMessage.classList.remove("error", "ok");
  } else {
    loginMessage.textContent = "Contraseña incorrecta.";
    loginMessage.classList.remove("ok");
    loginMessage.classList.add("error");
    passwordInput.value = "";
    passwordInput.focus();
  }
}

// =====================================
//   Init
// =====================================

function init() {
  // --- Login ---
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");
  if (loginBtn && passwordInput) {
    loginBtn.addEventListener("click", handleLogin);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    });
  }

  // --- App principal ---
  const workers = loadWorkers();
  loadCompanies();
  loadProjectsByCompany();
  loadProjectWorkers();

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");
  const weekInput = document.getElementById("weekInput");
  const filterMonth = document.getElementById("filterMonth");

  fillSelect(workerSelect, workers, { placeholder: "Elige tu monognomo" });

  refreshCompanySelects();

  projectSelect.innerHTML = "";
  projectSelect.disabled = true;

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

  weekInput.value = "";
  if (filterMonth) filterMonth.value = "";

  companySelect.addEventListener("change", handleCompanyChange);
  weekInput.addEventListener("change", updateProjectSelect);
  document.getElementById("addProjectBtn").addEventListener("click", handleAddProject);
  document.getElementById("saveBtn").addEventListener("click", handleSaveHours);
  document.getElementById("filterBtn").addEventListener("click", handleFilter);
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);

  const pdfBtn = document.getElementById("exportPdfBtn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", exportProjectsPDF);
  }

  document.getElementById("tabMain").addEventListener("click", switchToMainView);
  document.getElementById("tabProjects").addEventListener("click", switchToProjectsView);
  document
    .getElementById("tabManageProjects")
    .addEventListener("click", switchToManageProjectsView);

  workerSelect.addEventListener("change", updateWorkerPhoto);
  updateWorkerPhoto();
  updateProjectMonthLabel();

  refreshProjectFilterSelect();

  // listado siempre modo mensaje
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);
