// --- UTILIDADES LOCALSTORAGE ---------------------------------

const STORAGE_KEYS = {
  EMPRESAS: "appHoras_empresas",
  PROYECTOS: "appHoras_proyectos",
  HORAS: "appHoras_registrosHoras",
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- DATOS EN MEMORIA ----------------------------------------

let empresas = [];
let proyectos = [];
let registrosHoras = [];

// Meses legibles
const MESES = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

// --- INICIALIZACIÓN ------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Cargar datos iniciales
  empresas = loadFromStorage(STORAGE_KEYS.EMPRESAS, []);
  proyectos = loadFromStorage(STORAGE_KEYS.PROYECTOS, []);
  registrosHoras = loadFromStorage(STORAGE_KEYS.HORAS, []);

  if (empresas.length === 0) {
    empresas = [
      { id: "e1", nombre: "Picofino" },
      { id: "e2", nombre: "Guardianes" },
      { id: "e3", nombre: "Escuela Energía" },
    ];
    saveToStorage(STORAGE_KEYS.EMPRESAS, empresas);
  }

  initTabs();
  initMesSelectors();
  renderSelectEmpresas();
  renderSelectMesesProyecto();
  renderProyectosEnTablas();
  renderRegistrosHoras();

  initFormProyecto();
  initFormHoras();
  initExportButtons();
});

// --- TABS -----------------------------------------------------

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(targetId).classList.add("active");
    });
  });
}

// --- SELECTS DE MESES -----------------------------------------

function initMesSelectors() {
  const selectMesHoras = document.getElementById("select-mes-horas");
  const filtroMesProyectos = document.getElementById("filtro-mes-proyectos");

  MESES.forEach((m) => {
    const opt1 = document.createElement("option");
    opt1.value = m.value;
    opt1.textContent = m.label;
    selectMesHoras.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = m.value;
    opt2.textContent = m.label;
    filtroMesProyectos.appendChild(opt2);
  });

  // Cuando cambia mes o semana, filtrar proyectos en registro de horas
  selectMesHoras.addEventListener("change", actualizarProyectosParaHoras);
  document
    .getElementById("select-semana-horas")
    .addEventListener("change", actualizarProyectosParaHoras);

  filtroMesProyectos.addEventListener("change", renderProyectosEnTablas);
}

// --- SELECT EMPRESAS ------------------------------------------

function renderSelectEmpresas() {
  const selectEmpresa = document.getElementById("select-empresa");
  selectEmpresa.innerHTML = "";

  empresas.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.nombre;
    selectEmpresa.appendChild(opt);
  });

  const optNueva = document.createElement("option");
  optNueva.value = "nueva";
  optNueva.textContent = "Añadir nueva empresa…";
  selectEmpresa.appendChild(optNueva);

  selectEmpresa.addEventListener("change", (e) => {
    if (e.target.value === "nueva") {
      const nombre = prompt("Nombre de la nueva empresa/proyecto principal:");
      if (nombre && nombre.trim()) {
        const id = "e" + Date.now();
        empresas.push({ id, nombre: nombre.trim() });
        saveToStorage(STORAGE_KEYS.EMPRESAS, empresas);
        renderSelectEmpresas();
        // volver a seleccionar la nueva
        document.getElementById("select-empresa").value = id;
      } else {
        // volver al primero si no se añade nada
        document.getElementById("select-empresa").selectedIndex = 0;
      }
    }
  });
}

// --- SELECT MESES MULTI PARA PROYECTO -------------------------

function renderSelectMesesProyecto() {
  const select = document.getElementById("select-meses-proyecto");
  select.innerHTML = "";

  MESES.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    select.appendChild(opt);
  });
}

// --- FORM PROYECTO --------------------------------------------

function initFormProyecto() {
  const form = document.getElementById("form-proyecto");
  const btnLimpiar = document.getElementById("btn-limpiar-form");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const idOculto = document.getElementById("proyecto-id").value;
    const nombre = document.getElementById("input-nombre-proyecto").value.trim();
    const empresaId = document.getElementById("select-empresa").value;
    const mesesSelect = document.getElementById("select-meses-proyecto");

    const mesesSeleccionados = Array.from(mesesSelect.selectedOptions).map(
      (opt) => opt.value
    );

    if (!nombre || !empresaId || mesesSeleccionados.length === 0) {
      alert("Rellena nombre, empresa y al menos un mes.");
      return;
    }

    if (idOculto) {
      // Editar
      const idx = proyectos.findIndex((p) => p.id === idOculto);
      if (idx >= 0) {
        proyectos[idx].nombre = nombre;
        proyectos[idx].empresaId = empresaId;
        proyectos[idx].meses = mesesSeleccionados;
      }
    } else {
      // Crear
      const id = "p" + Date.now();
      proyectos.push({
        id,
        nombre,
        empresaId,
        meses: mesesSeleccionados,
      });
    }

    saveToStorage(STORAGE_KEYS.PROYECTOS, proyectos);
    limpiarFormProyecto();
    renderProyectosEnTablas();
    actualizarProyectosParaHoras();
  });

  btnLimpiar.addEventListener("click", limpiarFormProyecto);
}

function limpiarFormProyecto() {
  document.getElementById("proyecto-id").value = "";
  document.getElementById("input-nombre-proyecto").value = "";
  const selectEmpresa = document.getElementById("select-empresa");
  if (selectEmpresa.options.length) selectEmpresa.selectedIndex = 0;
  const mesesSelect = document.getElementById("select-meses-proyecto");
  Array.from(mesesSelect.options).forEach((opt) => (opt.selected = false));
}

// --- TABLAS PROYECTOS -----------------------------------------

function renderProyectosEnTablas() {
  const filtroMes = document.getElementById("filtro-mes-proyectos").value;
  const tbodyVer = document.querySelector("#tabla-proyectos tbody");
  const tbodyGestion = document.querySelector("#tabla-gestion-proyectos tbody");

  tbodyVer.innerHTML = "";
  tbodyGestion.innerHTML = "";

  const proyectosFiltrados =
    filtroMes === "todos"
      ? proyectos
      : proyectos.filter((p) => p.meses.includes(filtroMes));

  proyectosFiltrados.forEach((p) => {
    const empresa = empresas.find((e) => e.id === p.empresaId);
    const nombreEmpresa = empresa ? empresa.nombre : "–";

    const mesesTexto = p.meses
      .map((m) => MESES.find((mm) => mm.value === m)?.label || m)
      .join(", ");

    // Fila en "Ver todos los proyectos"
    const trVer = document.createElement("tr");
    trVer.innerHTML = `
      <td>${nombreEmpresa}</td>
      <td>${p.nombre}</td>
      <td>${mesesTexto}</td>
    `;
    tbodyVer.appendChild(trVer);

    // Fila en "Gestionar proyectos"
    const trGest = document.createElement("tr");
    trGest.innerHTML = `
      <td>${nombreEmpresa}</td>
      <td>${p.nombre}</td>
      <td>${mesesTexto}</td>
      <td>
        <button class="btn-secondary btn-sm" data-accion="editar" data-id="${p.id}">Editar</button>
        <button class="btn-ghost btn-sm" data-accion="borrar" data-id="${p.id}">Borrar</button>
      </td>
    `;
    tbodyGestion.appendChild(trGest);
  });

  // Acciones editar/borrar
  tbodyGestion.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accion = btn.dataset.accion;
      const id = btn.dataset.id;
      if (accion === "editar") {
        editarProyecto(id);
      } else if (accion === "borrar") {
        borrarProyecto(id);
      }
    });
  });
}

function editarProyecto(id) {
  const proyecto = proyectos.find((p) => p.id === id);
  if (!proyecto) return;

  document.getElementById("proyecto-id").value = proyecto.id;
  document.getElementById("input-nombre-proyecto").value = proyecto.nombre;
  document.getElementById("select-empresa").value = proyecto.empresaId;

  const mesesSelect = document.getElementById("select-meses-proyecto");
  Array.from(mesesSelect.options).forEach((opt) => {
    opt.selected = proyecto.meses.includes(opt.value);
  });

  // Cambiar a pestaña gestionar proyectos por si no está
  document.querySelectorAll(".tab-button").forEach((b) => {
    if (b.dataset.tab === "gestionar-proyectos") b.click();
  });
}

function borrarProyecto(id) {
  if (!confirm("¿Seguro que quieres borrar este proyecto?")) return;
  proyectos = proyectos.filter((p) => p.id !== id);
  saveToStorage(STORAGE_KEYS.PROYECTOS, proyectos);
  renderProyectosEnTablas();
  actualizarProyectosParaHoras();
}

// --- REGISTRAR HORAS -----------------------------------------

function initFormHoras() {
  const form = document.getElementById("form-horas");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fecha = document.getElementById("input-fecha").value;
    const mes = document.getElementById("select-mes-horas").value;
    const semana = document.getElementById("select-semana-horas").value;
    const proyectoId = document.getElementById("select-proyecto-horas").value;
    const horas = parseFloat(document.getElementById("input-horas").value);
    const descripcion = document
      .getElementById("input-descripcion")
      .value.trim();

    if (!fecha || !mes || !semana || !proyectoId || isNaN(horas)) {
      alert("Rellena fecha, mes, semana, proyecto y horas.");
      return;
    }

    const registro = {
      id: "h" + Date.now(),
      fecha,
      mes,
      semana,
      proyectoId,
      horas,
      descripcion,
    };

    registrosHoras.push(registro);
    saveToStorage(STORAGE_KEYS.HORAS, registrosHoras);

    form.reset();
    // Mensaje rápido
    alert("Horas guardadas.");
    renderRegistrosHoras();
  });
}

function actualizarProyectosParaHoras() {
  const mesSeleccionado = document.getElementById("select-mes-horas").value;
  const semanaSeleccionada =
    document.getElementById("select-semana-horas").value; // por si luego queremos usarla

  const selectProyectos = document.getElementById("select-proyecto-horas");
  selectProyectos.innerHTML = "";

  if (!mesSeleccionado || !semanaSeleccionada) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = "Selecciona primero mes y semana";
    selectProyectos.appendChild(opt);
    return;
  }

  const proyectosMes = proyectos.filter((p) =>
    p.meses.includes(mesSeleccionado)
  );

  if (proyectosMes.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = "No hay proyectos para ese mes";
    selectProyectos.appendChild(opt);
    return;
  }

  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.disabled = true;
  optDefault.selected = true;
  optDefault.textContent = "Selecciona un proyecto";
  selectProyectos.appendChild(optDefault);

  proyectosMes.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    const empresa = empresas.find((e) => e.id === p.empresaId);
    const nombreEmpresa = empresa ? empresa.nombre : "";
    opt.textContent = nombreEmpresa
      ? `${nombreEmpresa} – ${p.nombre}`
      : p.nombre;
    selectProyectos.appendChild(opt);
  });
}

// --- TABLA REGISTROS HORAS -----------------------------------

function renderRegistrosHoras() {
  const tbody = document.querySelector("#tabla-horas tbody");
  tbody.innerHTML = "";

  // Ordenar del más reciente al más antiguo
  const copia = [...registrosHoras].sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );

  copia.slice(0, 50).forEach((r) => {
    const proyecto = proyectos.find((p) => p.id === r.proyectoId);
    const empresa = proyecto
      ? empresas.find((e) => e.id === proyecto.empresaId)
      : null;

    const nombreProyecto = proyecto ? proyecto.nombre : "–";
    const nombreEmpresa = empresa ? empresa.nombre : "–";
    const mesLabel =
      MESES.find((m) => m.value === r.mes)?.label || `Mes ${r.mes}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.fecha}</td>
      <td>${mesLabel}</td>
      <td>${r.semana}</td>
      <td>${nombreEmpresa}</td>
      <td>${nombreProyecto}</td>
      <td>${r.horas}</td>
      <td>${r.descripcion || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- EXPORTAR EXCEL / PDF ------------------------------------

function initExportButtons() {
  document
    .getElementById("btn-export-excel")
    .addEventListener("click", exportarExcelProyectos);
  document
    .getElementById("btn-export-pdf")
    .addEventListener("click", exportarPdfProyectos);
}

function exportarExcelProyectos() {
  const tabla = document.getElementById("tabla-proyectos");
  const html = tabla.outerHTML.replace(/ /g, "%20");

  const a = document.createElement("a");
  a.href = "data:application/vnd.ms-excel," + html;
  a.download = "proyectos.xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportarPdfProyectos() {
  // Usamos window.print() con @media print para sacar solo la tabla
  window.print();
}