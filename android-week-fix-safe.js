// android-week-fix-safe.js
// SOLO Android: reemplaza visualmente CUALQUIER <input type="week"> (que muestra "Semana 1, Semana 2...")
// por un calendario real. Internamente GUARDA POR SEMANAS (YYYY-Www) en el input original.
// Diseñado para NO tocar login, NO tocar APIs, y NO romper la app aunque falle.
(function () {
  try {
    var ua = String(navigator.userAgent || "");
    if (!/Android|Adr/i.test(ua)) return;

    function pad2(n) { return (n < 10 ? "0" : "") + n; }

    function dateToISOWeek(dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "").trim())) return "";
      var d0 = new Date(dateStr + "T00:00:00");
      if (isNaN(d0.getTime())) return "";

      var d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
      var day = (d.getDay() + 6) % 7; // Mon=0
      d.setDate(d.getDate() - day + 3); // Thursday

      var firstThu = new Date(d.getFullYear(), 0, 4);
      var firstDay = (firstThu.getDay() + 6) % 7;
      firstThu.setDate(firstThu.getDate() - firstDay + 3);

      var weekNo = 1 + Math.round((d.getTime() - firstThu.getTime()) / 604800000);
      var year = d.getFullYear();
      return year + "-W" + String(weekNo).padStart(2, "0");
    }

    function isoWeekToMonday(isoWeek) {
      var m = String(isoWeek || "").trim().match(/^(\d{4})-W(\d{1,2})$/);
      if (!m) return null;
      var year = parseInt(m[1], 10);
      var week = parseInt(m[2], 10);

      var jan4 = new Date(year, 0, 4);
      var jan4Day = (jan4.getDay() + 6) % 7; // Mon=0
      var mondayWeek1 = new Date(year, 0, 4 - jan4Day);
      return new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86400000);
    }

    function dispatchInputEvents(el) {
      try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch(e) {}
      try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch(e) {}
    }

    function enhanceWeekInput(weekInput) {
      try {
        if (!weekInput) return;
        if (weekInput.dataset && weekInput.dataset.androidWeekEnhanced === "1") return;

        var type = String(weekInput.getAttribute("type") || weekInput.type || "").toLowerCase();
        if (type !== "week") return;

        // Marcar antes para evitar loops
        if (weekInput.dataset) weekInput.dataset.androidWeekEnhanced = "1";

        // Ocultar el week nativo
        weekInput.style.display = "none";

        // Si ya existe un calendario junto a este week, no duplicar
        var existing = weekInput.nextElementSibling;
        if (existing && existing.classList && existing.classList.contains("android-week-calendar")) return;

        // Insertar input calendario justo después
        var cal = document.createElement("input");
        cal.type = "date";
        cal.className = "android-week-calendar";
        cal.style.width = "100%";

        // Mantener layout (si el week está dentro de un flex/label, mejor no envolver)
        weekInput.insertAdjacentElement("afterend", cal);

        // Inicializar calendario con lunes de la semana actual si hay valor
        var current = String(weekInput.value || "").trim();
        if (/^\d{4}-W\d{1,2}$/.test(current)) {
          var mon = isoWeekToMonday(current);
          if (mon) {
            cal.value = mon.getFullYear() + "-" + pad2(mon.getMonth() + 1) + "-" + pad2(mon.getDate());
          }
        }

        // Al cambiar fecha: guardar semana ISO en el input original
        function commit() {
          var iso = dateToISOWeek(cal.value);
          if (!iso) return;
          weekInput.value = iso;
          dispatchInputEvents(weekInput);
        }

        cal.addEventListener("change", commit);

      } catch (eEnh) {
        // Nunca romper la app
      }
    }

    function enhanceAll() {
      try {
        var nodes = document.querySelectorAll('input[type="week"]');
        for (var i = 0; i < nodes.length; i++) enhanceWeekInput(nodes[i]);
      } catch (eAll) {}
    }

    // 1) Primera pasada cuando carga todo
    window.addEventListener("load", function () {
      try { enhanceAll(); } catch (eLoad) {}
    });

    // 2) Observador para inputs que aparecen después (editar registro / mono / modales)
    try {
      var obs = new MutationObserver(function () {
        enhanceAll();
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (eObs) {}

  } catch (e) {
    // Nunca romper la app
  }
})();
