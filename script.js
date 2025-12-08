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
// ⚠️ Respeta lo que tú ya tienes en /images
const WORKER_IMAGE_BASE_MAP = {
  "Elías": "Elias",   // Elias.jpeg
  "Inés": "Ines",     // Ines.jpeg
  "María C": "Mariac",// Mariac.jpeg
  "María M": "Mariam" // Mariam.jpeg
  // el resto usa el nombre tal cual
};

// devuelve el "base name" del archivo para ese trabajador
function getWorkerImageBase(workerName) {
  return WORKER_IMAGE_BASE_MAP[workerName] || workerName;
}

// Construye un array de rutas posibles para un trabajador
function getPossibleImagePaths(workerName) {
  const base = getWorkerImageBase(workerName);
  return WORKER_IMAGE_EXTENSIONS.map(ext => `images/${base}${ext}`);
}

// Carga una imagen probando una ruta tras otra
function loadWorkerImage(imgElement, workerName) {
  const paths = getPossibleImagePaths(workerName);
  let index = 0;

  function tryNext() {
    if (index >= paths.length) {
      imgElement.src = "images/default.png"; // fallback si no existe ninguna
      return;
    }
    const path = paths[index++];
    imgElement.onerror = tryNext;   // si falla, prueba la siguiente extensión
    imgElement.src = path;          // intenta cargar
  }

  tryNext();
}

// Actualiza la foto del formulario al elegir trabajador
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

// crea una celda <td> con foto + nombre para las tablas
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

// Convierte el valor del input type="week" (YYYY-Www) a "YYYY-MM" (mes aproximado)
function getMonthKeyFromWeek(weekValue) {
  if (!weekValue) return null;
  const parts = weekValue.split("-W");
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  // aproximación: primer día del año + (week-1)*7 días
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const month = d.getMonth() + 1; // 0-11 -> 1-12
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`; // ej: "2025-03"
}

// Devuelve proyectos para una empresa y un mes concreto
function getProjectsForCompanyAndMonth(company, monthKey) {
  if (!company || !monthKey) return [];
  const map = loadProjectsByCompany();
  const companyData = map[company] || {};
  const list = companyData[monthKey] || [];
  // clon para no modificar el original
  return [...list];
}

// =====================================
//   Cambio de empresa / semana: proyectos
// =====================================

function updateProjectSelect() {
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const projectWrapper = document.getElementById("projectFieldWrapper");
  const weekInput = document.getElementById("weekInput");

  const company = companySelect.value;
  const week = weekInput.value;
  const monthKey = getMonthKeyFromWeek(week);

  // Si no hay empresa o es General, ocultamos proyectos
  if (!company || company === "General") {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  // Si no hay semana, también ocultamos proyectos (hay que escoger semana antes)
  if (!week || !monthKey) {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  // Empresa normal + mes definido
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

  // Preguntar por otros meses opcionales (YYYY-MM,YYYY-MM,...)
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
        // validar formato básico YYYY-MM
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

  // Recargar select de proyectos para el mes actual
  updateProjectSelect();
  const projectSelect = document.getElementById("projectSelect");
  if (projectSelect && projectSelect.options.length > 0) {
    projectSelect.value = projectName;
  }
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

  // Borrar entradas
  let entries = loadEntries();
  entries = entries.filter(e => !(e.company === company && e.project === project));
  saveEntries(entries);

  // Borrar proyecto de todos los meses de esa empresa
  const projectsByCompany = loadProjectsByCompany();
  if (projectsByCompany[company]) {
    const companyMap = projectsByCompany[company];
    Object.keys(companyMap).forEach(monthKey => {
      companyMap[monthKey] = companyMap[monthKey].filter(p => p !== project);
      if (companyMap[monthKey].length === 0) {
        delete companyMap[monthKey];
      }
    });
    saveProjectsByCompany(projectsByCompany);
  }

  renderTable();
  renderCompanyView();
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

    // Trabajador con foto
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

        // Trabajador con foto
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

      // Fila total proyecto
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

      // Botón borrar proyecto completo
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
//   Exportar CSV
// =====================================

function exportToCSV() {
  const entries = loadEntries();
  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const header = ["Trabajador", "Empresa", "Proyecto", "Semana", "Horas"];

  const rows = entries.map(e => [
    e.worker,
    e.company,
    e.project,
    e.week,
    e.hours
  ]);

  const csvLines = [header.join(";"), ...rows.map(r => r.join(";"))];
  const csvContent = csvLines.join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "horas_empresa.csv";
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
  document.getElementById("tabMain").classList.add("active");
  document.getElementById("tabProjects").classList.remove("active");
}

function switchToProjectsView() {
  document.getElementById("mainView").classList.add("hidden");
  document.getElementById("projectsView").classList.remove("hidden");
  document.getElementById("tabMain").classList.remove("active");
  document.getElementById("tabProjects").classList.add("active");
  renderCompanyView();
}

// =====================================
//   Init
// =====================================

function init() {
  const workers = loadWorkers();
  loadProjectsByCompany(); // inicializar por si acaso

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");
  const weekInput = document.getElementById("weekInput");
  const filterWeek = document.getElementById("filterWeek");

  // Trabajadores
  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });

  // Empresas
  fillSelect(companySelect, COMPANIES, { placeholder: "Elige una empresa" });

  // Proyectos: se rellenan en función de empresa + semana
  projectSelect.innerHTML = "";
  projectSelect.disabled = true;

  // Filtro trabajadores
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

  // Filtro empresas
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

  // Eventos
  companySelect.addEventListener("change", updateProjectSelect);
  weekInput.addEventListener("change", updateProjectSelect);
  document.getElementById("addProjectBtn").addEventListener("click", handleAddProject);
  document.getElementById("saveBtn").addEventListener("click", handleSaveHours);
  document.getElementById("filterBtn").addEventListener("click", handleFilter);
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);

  document.getElementById("tabMain").addEventListener("click", switchToMainView);
  document.getElementById("tabProjects").addEventListener("click", switchToProjectsView);

  // foto de trabajador en el formulario
  workerSelect.addEventListener("change", updateWorkerPhoto);
  updateWorkerPhoto(); // estado inicial

  renderTable();
}

document.addEventListener("DOMContentLoaded", init);