// Claves en localStorage
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa",
  ENTRIES: "appHoras_registros",
  WORKERS: "appHoras_trabajadores"
};

// Empresas disponibles
const COMPANIES = ["Monognomo", "Neozink", "Yurmuvi", "General"];

// Trabajadores iniciales (cámbialos por los vuestros reales)
const DEFAULT_WORKERS = [
  "Ana",
  "Carlos",
  "Lucía",
  "Marcos"
];

// Proyectos iniciales por empresa (ejemplos, aquí puedes meter los reales)
const DEFAULT_PROJECTS_BY_COMPANY = {
  Monognomo: ["Mono Proyecto 1", "Mono Proyecto 2"],
  Neozink: ["Neo Proyecto 1", "Neo Proyecto 2"],
  Yurmuvi: ["Yur Proyecto 1"],
  General: [] // General no usa lista de proyectos, se guarda como "General"
};

// ---------- Utilidades de almacenamiento ----------

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch (e) {
    console.error("Error leyendo localStorage", e);
    // Devolvemos una copia del fallback para no mutarlo
    return structuredClone(fallback);
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

// ---------- Utilidades de UI ----------

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

// --- Cambio de empresa: actualizar proyectos ---

function updateProjectSelectForCompany() {
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const projectWrapper = document.getElementById("projectFieldWrapper");
  const company = companySelect.value;
  const projectsByCompany = loadProjectsByCompany();

  if (!company) {
    // Sin empresa seleccionada: ocultamos proyectos
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  if (company === "General") {
    // General: no se seleccionan proyectos
    projectWrapper.classList.add("hidden");
    projectSelect.disabled = true;
    projectSelect.innerHTML = "";
    return;
  }

  // Empresa normal
  projectWrapper.classList.remove("hidden");
  projectSelect.disabled = false;

  const projects = projectsByCompany[company] || [];
  fillSelect(projectSelect, projects, { placeholder: "Elige un proyecto" });
}

// ---------- Gestión de proyectos ----------

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

// ---------- Guardar horas ----------

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

  // Limpiar horas
  hoursInput.value = "";
  // Actualizar tabla
  renderTable();
}

// ---------- Tabla de resumen ----------

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
    td.colSpan = 5;
    td.textContent = "No hay registros.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(entry => {
    const tr = document.createElement("tr");

    const tdWorker = document.createElement("td");
    tdWorker.textContent = entry.worker;
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

    tbody.appendChild(tr);
  });
}

// ---------- Filtros ----------

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

// ---------- Exportar a CSV (Excel) ----------

function exportToCSV() {
  const entries = loadEntries();
  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Cabecera
  const header = ["Trabajador", "Empresa", "Proyecto", "Semana", "Horas"];

  const rows = entries.map(e => [
    e.worker,
    e.company,
    e.project,
    e.week,
    e.hours
  ]);

  // CSV con ; como separador (suele ir bien en configuración española)
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

// ---------- Inicialización general ----------

function init() {
  const workers = loadWorkers();
  const projectsByCompany = loadProjectsByCompany();

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");

  // Trabajadores
  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });

  // Empresas
  fillSelect(companySelect, COMPANIES, { placeholder: "Elige una empresa" });

  // Proyectos iniciales: se ajustan al cambiar la empresa
  projectSelect.innerHTML = "";
  projectSelect.disabled = true;

  // Filtro de trabajador: opción "Todos"
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

  // Filtro de empresa: opción "Todas"
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

  // Semana por defecto: lo dejamos vacío (el usuario elige)
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

  // Pintar tabla inicial
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);