/* View · como os valores aparecem no ecrã: números, percentagens, datas, iniciais (TrustVote.format) */
(function () {
  "use strict";

  const TV = window.TrustVote;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const number = (value) => (value === null || value === undefined ? "—" : new Intl.NumberFormat("pt-PT").format(value));

  const percent = (value) =>
    value === null || value === undefined
      ? "—"
      : `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

  const dateTime = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  // Data e hora com o ano (para relatórios e ficheiros exportados)
  const fullDate = (iso) => new Date(iso).toLocaleString("pt-PT");

  const date = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }) : "—");

  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "—");

  const period = (start, end) => (start && end ? `${dateTime(start)} — ${dateTime(end)}` : "Datas por definir");

  function initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function voterNumber(user) {
    if (user && user.num_estudante) return user.num_estudante;
    const year = user && user.data_registo ? new Date(user.data_registo).getFullYear() : new Date().getFullYear();
    return `TV-${year}-${String((user && user.id) || 0).padStart(3, "0")}`;
  }

  function countdown(iso) {
    const left = Math.max(0, Date.parse(iso) - Date.now());
    const d = Math.floor(left / 864e5);
    const h = Math.floor((left % 864e5) / 36e5);
    const m = Math.floor((left % 36e5) / 6e4);
    return `${String(d).padStart(2, "0")}d : ${String(h).padStart(2, "0")}h : ${String(m).padStart(2, "0")}m`;
  }

  // Texto para nomes de ficheiros: "Associação 2026" → "associacao-2026"
  const slug = (texto) =>
    texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  TV.format = { escapeHtml, number, percent, dateTime, fullDate, date, time, period, initials, voterNumber, countdown, slug };
})();
