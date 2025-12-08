// Claves en localStorage
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa",
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

// Proyectos iniciales por empresa (ejemplo; cámbialos por los reales cuando quieras)
const DEFAULT_PROJECTS_BY_COMPANY = {
  Monognomo: ["Mono Proyecto 1", "Mono Proyecto 2"],
  Neozink: ["Neo Proyecto 1", "Neo Proyecto 2"],
  Yurmuvi: ["Yur Proyecto 1"],
  General: [] // General no usa lista de proyectos, se guarda como "General"
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
  return loadFromStorage(STORAGE_KEYS.PROJECTS_BY_COMPANY, DEFAULT_PROJECTS_BY_COMPANY);
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

// mapa manual: nombre del trabajador → base del fichero
// (sin extensión)
const WORKER_IMAGE_BASE_MAP = {
  "Elías": "Elias",
  "Inés": "Inés",
  "María C": "María C",
  "María M": "María M"
  // el resto usará el nombre tal cual
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
//   Cambio de empresa: proyectos
// =====================================

function updateProjectSelectForCompany() {
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const projectWrapper = document.getElementById("projectFieldWrapper");
  const company = companySelect.value;
  const projectsByCompany = loadProjectsByCompany();

  if (!company) {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  if (company === "General") {
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  projectWrapper.classList.remove("hidden");
  projectSelect.disabled = false;

  const projects = projectsByCompany[company] || [];
  fillSelect(projectSelect, projects, { placeholder: "Elige un proyecto" });
}

// =====================================
//   Gestión de proyectos
// =====================================

function handleAddProject() {
  const companySelect = document.getElementById("companySelect");
  const company = companySelect.value;

  if (!company) {
    alert("Primero elige una empresa.");
    return;
  }

  if (company === "General") {
    alert("En la sección General no se añaden proyectos. El proyecto es 'General'.");
    return;
  }

  const name = prompt(`Nombre del nuevo proyecto para ${company}:`);
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const projectsByCompany = loadProjectsByCompany();
  const list = projectsByCompany[company] || [];

  if (list.includes(trimmed)) {
    alert("Ese proyecto ya existe en esa empresa.");
    return;
  }

  list.push(trimmed);
  list.sort((a, b) => a.localeCompare(b, "es"));
  projectsByCompany[company] = list;
  saveProjectsByCompany(projectsByCompany);

  const projectSelect = document.getElementById("projectSelect");
  fillSelect(projectSelect, list, { placeholder: "Elige un proyecto" });
  projectSelect.value = trimmed;
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
  if (!confirm(`¿Seguro que quieres borrar el proyecto "${project}" de "${company}" y todas sus horas asociadas?`)) {
    return;
  }

  let entries = loadEntries();
  entries = entries.filter(e => !(e.company === company && e.project === project));
  saveEntries(entries);

  const projectsByCompany = loadProjectsByCompany();
  if (projectsByCompany[company]) {
    projectsByCompany[company] = projectsByCompany[company].filter(p => p !== project);
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
      thead.innerHTML = "<tr><th>Trabajador</th><th>Semana</th><th>Horas</th><th>Acciones</th></tr>";
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
      deleteProjectBtn.addEventListener("click", () => deleteProject(company, project));
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

  const csvLines = [
    header.join(";"),
    ...rows.map(r => r.join(";"))
  ];
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
  loadProjectsByCompany();

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");

  // Trabajadores
  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });

  // Empresas
  fillSelect(companySelect, COMPANIES, { placeholder: "Elige una empresa" });

  // Proyectos (se rellenan al cambiar la empresa)
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

  const weekInput = document.getElementById("weekInput");
  const filterWeek = document.getElementById("filterWeek");
  weekInput.value = "";
  filterWeek.value = "";

  // Eventos
  companySelect.addEventListener("change", updateProjectSelectForCompany);
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