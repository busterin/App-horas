// ==============================
//  Claves en localStorage
// ==============================
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa", // ahora incluye meses
  ENTRIES: "appHoras_registros",
  WORKERS: "appHoras_trabajadores"
};

// Empresas disponibles
const COMPANIES = ["Monognomo", "Neozink", "Yurmuvi", "General"];

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
  General: {} // General no usa proyectos, se guarda como "General"
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

function loadEntries() {
  return loadFromStorage(STORAGE_KEYS.ENTRIES, []);
}

function saveEntries(entries) {
  saveToStorage(STORAGE_KEYS.ENTRIES, entries);
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

// extensiones que vamos a probar, en orden
const WORKER_IMAGE_EXTENSIONS = [".jpeg", ".jpg", ".png"];

// mapa manual: nombre del trabajador → base del fichero (sin extensión)
const WORKER_IMAGE_BASE_MAP = {
  "Elías": "Elias",   // Elias.jpeg
  "Inés": "Ines",     // Ines.jpeg
  "María C": "Mariac",// Mariac.jpeg
  "María M": "Mariam" // Mariam.jpeg
  // el resto usa el nombre tal cual
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
      imgElement.src = "images/default.png"; // fallback si no existe ninguna
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
//   Mes a partir de la semana
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
  return `${year}-${mm}`; // "YYYY-MM"
}

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

function formatMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, monthStr] = monthKey.split("-");
  const month = parseInt(monthStr, 10);
  if (!month || month < 1 || month > 12) return monthKey;
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

// proyectos para empresa+mes
function getProjectsForCompanyAndMonth(company, monthKey) {
  if (!company || !monthKey) return [];
  const map = loadProjectsByCompany();
  const companyData = map[company] || {};
  const list = companyData[monthKey] || [];
  return [...list];
}

// etiqueta de mes del selector de proyectos
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

function updateProjectSelect() {
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const projectWrapper = document.getElementById("projectFieldWrapper");
  const weekInput = document.getElementById("weekInput");

  const company = companySelect.value;
  const week = weekInput.value;
  const monthKey = getMonthKeyFromWeek(week);

  updateProjectMonthLabel();

  if (!company || company === "General") {
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
//   Gestión de proyectos (por meses)
// =====================================

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

  updateProjectSelect();
  const projectSelect = document.getElementById("projectSelect");
  if (projectSelect && projectSelect.options.length > 0) {
    projectSelect.value = projectName;
  }
}

// construir índice: empresa → proyecto → [meses]
// Soporta formato nuevo (por meses) y antiguo (array plano)
function buildProjectMonthIndex() {
  const map = loadProjectsByCompany();
  const index = {};

  Object.keys(map).forEach(company => {
    const companyRaw = map[company];
    const projIndex = {};

    if (Array.isArray(companyRaw)) {
      // FORMATO ANTIGUO: ["Proyecto 1", "Proyecto 2", ...]
      const legacyMonth = "0000-00"; // marcador para proyectos sin mes
      companyRaw.forEach(projectName => {
        if (!projIndex[projectName]) {
          projIndex[projectName] = [];
        }
        if (!projIndex[projectName].includes(legacyMonth)) {
          projIndex[projectName].push(legacyMonth);
        }
      });
    } else if (companyRaw && typeof companyRaw === "object") {
      // FORMATO NUEVO: { "YYYY-MM": ["Proyecto 1", "Proyecto 2"] }
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

// editar meses de un proyecto
function editProjectMonths(company, projectName, currentMonths) {
  const currentStr = currentMonths.join(", ");
  const input = prompt(
    `Indica los meses (formato YYYY-MM) separados por comas para el proyecto "${projectName}".\nEjemplo: 2025-03,2025-04\n\nDeja vacío para eliminarlo de todos los meses.`,
    currentStr
  );
  if (input === null) return;

  const newMonths = [];
  if (input.trim() !== "") {
    input
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

  // quitar el proyecto de todos los meses actuales
  Object.keys(companyMap).forEach(monthKey => {
    companyMap[monthKey] = (companyMap[monthKey] || []).filter(
      p => p !== projectName
    );
    if (companyMap[monthKey].length === 0) {
      delete companyMap[monthKey];
    }
  });

  // añadir a los nuevos meses
  newMonths.forEach(monthKey => {
    const list = companyMap[monthKey] || [];
    if (!list.includes(projectName)) {
      list.push(projectName);
      list.sort((a, b) => a.localeCompare(b, "es"));
    }
    companyMap[monthKey] = list;
  });

  saveProjectsByCompany(projectsByCompany);

  renderManageProjectsView();
  updateProjectSelect();
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

// borrar proyecto completo + sus entradas (en todos los meses)
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

  renderTable();
  renderCompanyView();
  renderManageProjectsView();
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
}

// =====================================
//   Tabla de resumen rápido
// =====================================

function renderTable(filter = {}) {
  const tbody = document.getElementById("entriesTableBody");
  const entries = loadEntries();

  const filtered = entries.filter(e => {
    if (filter.worker && e.worker !== filter.worker) return false;
    if (filter.company && e.company !== filter.company) return false;
    if (filter.week && e.week !== filter.week) return false;
    return true;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No hay registros.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(entry => {
    const tr = document.createElement("tr");
    tr.dataset.id = entry.id;

    const tdWorker = createWorkerCell(entry.worker);
    tr.appendChild(tdWorker);

    const tdCompany = document.createElement("td");
    tdCompany.textContent = entry.company;
    tr.appendChild(tdCompany);

    const tdProject = document.createElement("td");
    tdProject.textContent = entry.project;
    tr.appendChild(tdProject);

    const tdWeek = document.createElement("td");
    tdWeek.textContent = entry.week;
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
  });
}

// =====================================
//   Vista "Todos los proyectos"
// =====================================

function renderCompanyView() {
  const container = document.getElementById("companyView");
  const entries = loadEntries();

  container.innerHTML = "";

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No hay registros todavía.";
    container.appendChild(p);
    return;
  }

  const grouped = {};
  entries.forEach(e => {
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
        tdWeek.textContent = entry.week;
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

      const projectActions = document.createElement("div");
      projectActions.className = "project-actions";
      const deleteProjectBtn = document.createElement("button");
      deleteProjectBtn.className = "icon-btn delete";
      deleteProjectBtn.textContent = "🗑️ Borrar proyecto completo";
      deleteProjectBtn.addEventListener("click", () =>
        deleteProject(company, project)
      );
      projectActions.appendChild(deleteProjectBtn);
      block.appendChild(projectActions);

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
      "<tr><th>Proyecto</th><th>Meses</th><th>Acciones</th></tr>";
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

        const tdActions = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit";
        editBtn.textContent = "✏️ Meses";
        editBtn.title = "Editar meses del proyecto";
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
//   Filtros
// =====================================

function handleFilter() {
  const worker = document.getElementById("filterWorker").value;
  const company = document.getElementById("filterCompany").value;
  const week = document.getElementById("filterWeek").value;

  const filter = {};
  if (worker) filter.worker = worker;
  if (company) filter.company = company;
  if (week) filter.week = week;

  renderTable(filter);
}

// =====================================
//   Exportar CSV (agrupado como "Ver todos los proyectos")
// =====================================

function exportToCSV() {
  const entries = loadEntries();
  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Agrupamos igual que en "Ver todos los proyectos"
  const grouped = {};
  entries.forEach(e => {
    if (!grouped[e.company]) grouped[e.company] = {};
    if (!grouped[e.company][e.project]) grouped[e.company][e.project] = [];
    grouped[e.company][e.project].push(e);
  });

  const companies = Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  const lines = [];
  let globalTotal = 0;

  companies.forEach(company => {
    lines.push(`Empresa: ${company}`);
    let companyTotal = 0;

    const projects = Object.keys(grouped[company]).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    projects.forEach(project => {
      lines.push(`Proyecto: ${project}`);
      lines.push("Trabajador;Semana;Horas");

      let projectTotal = 0;

      grouped[company][project].forEach(e => {
        const hours = e.hours ?? 0;
        projectTotal += Number(hours) || 0;
        const hoursStr = String(hours).replace(".", ",");
        lines.push(`${e.worker};${e.week};${hoursStr}`);
      });

      const projectTotalStr = String(projectTotal).replace(".", ",");
      lines.push(`Total proyecto;;${projectTotalStr}`);
      lines.push(""); // línea en blanco entre proyectos

      companyTotal += projectTotal;
    });

    const companyTotalStr = String(companyTotal).replace(".", ",");
    lines.push(`Total empresa;;${companyTotalStr}`);
    lines.push(""); // línea en blanco entre empresas

    globalTotal += companyTotal;
  });

  const globalTotalStr = String(globalTotal).replace(".", ",");
  lines.push(`Total general;;${globalTotalStr}`);

  const csvContent = lines.join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "horas_empresa_agrupadas.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
//   Init
// =====================================

function init() {
  const workers = loadWorkers();
  loadProjectsByCompany();

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");
  const weekInput = document.getElementById("weekInput");
  const filterWeek = document.getElementById("filterWeek");

  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });
  fillSelect(companySelect, COMPANIES, { placeholder: "Elige una empresa" });

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

  filterCompany.innerHTML = "";
  const allCompaniesOpt = document.createElement("option");
  allCompaniesOpt.value = "";
  allCompaniesOpt.textContent = "Todas";
  filterCompany.appendChild(allCompaniesOpt);
  COMPANIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    filterCompany.appendChild(opt);
  });

  weekInput.value = "";
  filterWeek.value = "";

  companySelect.addEventListener("change", updateProjectSelect);
  weekInput.addEventListener("change", updateProjectSelect);
  document.getElementById("addProjectBtn").addEventListener("click", handleAddProject);
  document.getElementById("saveBtn").addEventListener("click", handleSaveHours);
  document.getElementById("filterBtn").addEventListener("click", handleFilter);
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);

  document.getElementById("tabMain").addEventListener("click", switchToMainView);
  document.getElementById("tabProjects").addEventListener("click", switchToProjectsView);
  document
    .getElementById("tabManageProjects")
    .addEventListener("click", switchToManageProjectsView);

  workerSelect.addEventListener("change", updateWorkerPhoto);
  updateWorkerPhoto();
  updateProjectMonthLabel();

  renderTable();
}

document.addEventListener("DOMContentLoaded", init);