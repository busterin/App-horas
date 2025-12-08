// Claves en localStorage
const STORAGE_KEYS = {
  PROJECTS: "appHoras_proyectos",
  ENTRIES: "appHoras_registros",
  WORKERS: "appHoras_trabajadores" // opcional si quieres hacerlo editable en el futuro
};

// Trabajadores iniciales (puedes cambiar esta lista)
const DEFAULT_WORKERS = [
  "Ana",
  "Carlos",
  "Lucía",
  "Marcos"
];

// Proyectos iniciales (puedes poner aquí los nombres que ya estáis usando)
const DEFAULT_PROJECTS = [
  "Proyecto A",
  "Proyecto B"
];

// ---------- Utilidades de almacenamiento ----------

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Error leyendo localStorage", e);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error guardando en localStorage", e);
  }
}

function loadProjects() {
  return loadFromStorage(STORAGE_KEYS.PROJECTS, DEFAULT_PROJECTS);
}

function saveProjects(projects) {
  saveToStorage(STORAGE_KEYS.PROJECTS, projects);
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

// ---------- Inicialización de selects ----------

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

// Mostrar mensajes
function showMessage(text, type = "ok") {
  const msgEl = document.getElementById("message");
  msgEl.textContent = text;
  msgEl.classList.remove("ok", "error");
  if (text) {
    msgEl.classList.add(type);
  }
}

// ---------- Gestión de proyectos ----------

function handleAddProject() {
  const name = prompt("Nombre del nuevo proyecto:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  let projects = loadProjects();
  if (projects.includes(trimmed)) {
    alert("Ese proyecto ya existe.");
    return;
  }
  projects.push(trimmed);
  projects.sort((a, b) => a.localeCompare(b, "es"));
  saveProjects(projects);

  const projectSelect = document.getElementById("projectSelect");
  fillSelect(projectSelect, projects, { placeholder: "Elige un proyecto" });
  projectSelect.value = trimmed;
}

// ---------- Guardar horas ----------

function handleSaveHours() {
  const workerSelect = document.getElementById("workerSelect");
  const projectSelect = document.getElementById("projectSelect");
  const weekInput = document.getElementById("weekInput");
  const hoursInput = document.getElementById("hoursInput");

  const worker = workerSelect.value;
  const project = projectSelect.value;
  const week = weekInput.value;
  const hours = parseFloat(hoursInput.value.replace(",", "."));

  if (!worker || !project || !week || isNaN(hours)) {
    showMessage("Faltan datos o las horas no son válidas.", "error");
    return;
  }

  if (hours < 0) {
    showMessage("Las horas no pueden ser negativas.", "error");
    return;
  }

  const entries = loadEntries();
  const newEntry = {
    id: Date.now(),
    worker,
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
    if (filter.week && e.week !== filter.week) return false;
    return true;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
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
  const week = document.getElementById("filterWeek").value;

  const filter = {};
  if (worker) filter.worker = worker;
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
  const header = ["Trabajador", "Proyecto", "Semana", "Horas"];

  const rows = entries.map(e => [
    e.worker,
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
  const projects = loadProjects();

  const workerSelect = document.getElementById("workerSelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");

  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });
  fillSelect(projectSelect, projects, { placeholder: "Elige un proyecto" });

  // Filtro de trabajador: opción "Todos"
  filterWorker.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Todos";
  filterWorker.appendChild(allOpt);
  workers.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    filterWorker.appendChild(opt);
  });

  // Por defecto, poner la semana actual
  const weekInput = document.getElementById("weekInput");
  const filterWeek = document.getElementById("filterWeek");
  const now = new Date();
  const year = now.getFullYear();
  // Esto no calcula perfectamente la ISO-week, pero sirve como aproximación sencilla
  const weekStr = `${year}-W`;
  weekInput.value = "";
  filterWeek.value = "";

  // Eventos
  document.getElementById("addProjectBtn").addEventListener("click", handleAddProject);
  document.getElementById("saveBtn").addEventListener("click", handleSaveHours);
  document.getElementById("filterBtn").addEventListener("click", handleFilter);
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);

  // Pintar tabla inicial
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);
