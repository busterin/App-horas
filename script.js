// Claves en localStorage
const STORAGE_KEYS = {
  PROJECTS_BY_COMPANY: "appHoras_proyectosPorEmpresa",
  ENTRIES: "appHoras_registros",
  WORKERS: "appHoras_trabajadores"
};

// Empresas disponibles
const COMPANIES = ["Monognomo", "Neozink", "Yurmuvi", "General"];

// Trabajadores iniciales con iconos
const DEFAULT_WORKERS = [
  "Alba 🐣",
  "Buster 🤖",
  "Castri 🦊",
  "Celia 🌻",
  "Elías 🎧",
  "Genio 🧠",
  "Inés 🐱",
  "Keila 🐬",
  "Laura 🍀",
  "Lorena 🌙",
  "Maider 🔆",
  "María C 🌸",
  "María M ⭐",
  "Rober 🐺",
  "Sandra 🔮",
  "Sara 🐼",
  "Voby 🚀"
];

// Proyectos iniciales por empresa (de momento de ejemplo)
const DEFAULT_PROJECTS_BY_COMPANY = {
  Monognomo: ["Mono Proyecto 1", "Mono Proyecto 2"],
  Neozink: ["Neo Proyecto 1", "Neo Proyecto 2"],
  Yurmuvi: ["Yur Proyecto 1"],
  General: [] // General no usa lista de proyectos, se guarda como "General"
};

// ---------- Utilidades de almacenamiento ----------

function deepClone(value) {
  // Por si algún navegador no soporta structuredClone
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

  hoursInput.value = "";
  renderTable();
}

// ---------- Tabla de resumen plano ----------

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

// ---------- Vista agrupada por empresas (con totales) ----------

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

  // Agrupar por empresa y proyecto
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
      thead.innerHTML = "<tr><th>Trabajador</th><th>Semana</th><th>Horas</th></tr>";
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      let projectTotal = 0;

      grouped[company][project].forEach(entry => {
        const tr = document.createElement("tr");

        const tdWorker = document.createElement("td");
        tdWorker.textContent = entry.worker;
        const tdWeek = document.createElement("td");
        tdWeek.textContent = entry.week;
        const tdHours = document.createElement("td");
        tdHours.textContent = entry.hours.toString().replace(".", ",");

        tr.appendChild(tdWorker);
        tr.appendChild(tdWeek);
        tr.appendChild(tdHours);
        tbody.appendChild(tr);

        projectTotal += entry.hours;
      });

      // Fila de total por proyecto
      const trTotal = document.createElement("tr");
      trTotal.className = "total-row";

      const tdLabel = document.createElement("td");
      tdLabel.colSpan = 2;
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

    // Total por empresa
    const companyTotalEl = document.createElement("div");
    companyTotalEl.className = "company-total";
    companyTotalEl.textContent =
      "Total horas en " + company + ": " + companyTotal.toString().replace(".", ",");
    block.appendChild(companyTotalEl);

    container.appendChild(block);

    globalTotal += companyTotal;
  });

  // Total global
  const globalTotalEl = document.createElement("div");
  globalTotalEl.className = "global-total";
  globalTotalEl.textContent =
    "Total general de horas: " + globalTotal.toString().replace(".", ",");
  container.appendChild(globalTotalEl);
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

// ---------- Inicialización general ----------

function init() {
  const workers = loadWorkers();
  loadProjectsByCompany(); // por si hay que inicializar

  const workerSelect = document.getElementById("workerSelect");
  const companySelect = document.getElementById("companySelect");
  const projectSelect = document.getElementById("projectSelect");
  const filterWorker = document.getElementById("filterWorker");
  const filterCompany = document.getElementById("filterCompany");

  // Trabajadores
  fillSelect(workerSelect, workers, { placeholder: "Elige un trabajador" });

  // Empresas
  fillSelect(companySelect, COMPANIES, { placeholder: "Elige una empresa" });

  // Proyectos: se rellenan al cambiar la empresa
  projectSelect.innerHTML = "";
  projectSelect.disabled = true;

  // Filtro de trabajador
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

  // Filtro de empresa
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

  companySelect.addEventListener("change", updateProjectSelectForCompany);
  document.getElementById("addProjectBtn").addEventListener("click", handleAddProject);
  document.getElementById("saveBtn").addEventListener("click", handleSaveHours);
  document.getElementById("filterBtn").addEventListener("click", handleFilter);
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);
  document.getElementById("groupByCompanyBtn").addEventListener("click", renderCompanyView);

  renderTable();
}

document.addEventListener("DOMContentLoaded", init);