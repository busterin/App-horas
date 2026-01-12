// android-week-fix.js
// Fix SOLO para Android: muestra un calendario real, pero guarda por SEMANAS (YYYY-Www)
// Diseñado para NO tocar el login ni el resto de la app.
// Requiere que el script principal (script.js) cargue primero.
(function () {
  const ua = String(navigator.userAgent || "");
  const isAndroid = /Android|Adr/i.test(ua);
  if (!isAndroid) return;

  // Convierte YYYY-MM-DD -> ISO week YYYY-Www
  function dateToISOWeek(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "").trim())) return "";
    const dLocal = new Date(dateStr + "T00:00:00");
    if (isNaN(dLocal.getTime())) return "";

    // Algoritmo ISO week (usando zona local para minimizar sorpresas)
    const d = new Date(dLocal.getFullYear(), dLocal.getMonth(), dLocal.getDate());
    // Ajustar al jueves de la semana ISO
    const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    d.setDate(d.getDate() - day + 3);

    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const firstDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDay + 3);

    const weekNo = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
    const year = d.getFullYear();
    return `${year}-W${String(weekNo).padStart(2, "0")}`;
  }

  window.addEventListener("load", () => {
    const weekInput = document.getElementById("weekInput");
    if (!weekInput) return;

    // Si por lo que sea ya no es type=week, no intervenimos.
    const type = String(weekInput.getAttribute("type") || weekInput.type || "").toLowerCase();
    if (type !== "week") return;

    // Ocultar el selector nativo (que en Android puede mostrar "Semana 1, Semana 2...")
    weekInput.style.display = "none";

    // Crear input calendario
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.id = "weekInputAndroidCalendar";
    dateInput.style.width = "100%";

    // Insertar justo después del input original
    weekInput.insertAdjacentElement("afterend", dateInput);

    // Si ya hay una semana seleccionada, intentamos mostrar el lunes de esa semana en el calendario
    const current = String(weekInput.value || "").trim();
    const m = current.match(/^(\d{4})-W(\d{2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const week = parseInt(m[2], 10);

      // Monday of ISO week
      const jan4 = new Date(year, 0, 4);
      const jan4Day = (jan4.getDay() + 6) % 7; // Mon=0
      const mondayWeek1 = new Date(year, 0, 4 - jan4Day);
      const monday = new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86400000);

      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, "0");
      const dd = String(monday.getDate()).padStart(2, "0");
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // Al seleccionar un día: lo convertimos a semana ISO y lo guardamos en weekInput
    dateInput.addEventListener("change", () => {
      const isoWeek = dateToISOWeek(dateInput.value);
      if (!isoWeek) return;

      weekInput.value = isoWeek;

      // Disparamos change para que tu app reaccione igual que siempre
      weekInput.dispatchEvent(new Event("change", { bubbles: true }));
      weekInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
})();
