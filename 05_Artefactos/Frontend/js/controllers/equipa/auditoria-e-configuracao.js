/* Controller · área da equipa, separadores "Auditoria" e "Configuração" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, session, twoFactor, download } = TV;
  const { dateTime, fullDate } = TV.format;
  const { panel, attempt } = TV.panels;
  const team = (TV.team = TV.team || {});

  // ===== Auditoria =====
  const nomesEntidade = { eleicao: "Eleição", candidato: "Candidato", utilizador: "Conta", ronda: "Votação" };

  team.renderAudit = async function renderAudit() {
    const el = panel("audit");
    const [lista, utilizadores, eleicoes] = await Promise.all([api.auditoria.listar(200), attempt(api.utilizadores.listar()), attempt(api.eleicoes.listar())]);
    const nomes = new Map((utilizadores.data || []).map((u) => [u.id, u.nome]));
    const titulos = new Map((eleicoes.data || []).map((e) => [e.id, e.titulo]));

    // "Sobre": o título da eleição ou o nome da conta; se não houver, o tipo e o número
    const sobre = (r) =>
      r.entidade === "eleicao" && titulos.has(r.entidade_id)
        ? titulos.get(r.entidade_id)
        : r.entidade === "utilizador" && nomes.has(r.entidade_id)
          ? nomes.get(r.entidade_id)
          : [nomesEntidade[r.entidade] || r.entidade, r.entidade_id && `#${r.entidade_id}`].filter(Boolean).join(" ") || "—";
    const autor = (r) => (r.utilizador_id ? nomes.get(r.utilizador_id) || `Utilizador #${r.utilizador_id}` : "Sistema");
    const registos = lista.map((r) => ({ data: dateTime(r.data), completa: fullDate(r.data), acao: r.acao, sobre: sobre(r), autor: autor(r) }));

    el.innerHTML = TV.teamView.auditPage(registos);
    el.querySelector("[data-refresh]").addEventListener("click", () => ui.mount(el, renderAudit));
    el.querySelector("[data-csv]").addEventListener("click", () =>
      download.csv("auditoria", ["Data e hora", "Ação", "Sobre", "Feito por"], registos.map((r) => [r.completa, r.acao, r.sobre, r.autor]))
    );
  };

  // ===== Configuração =====
  const PREFS = "trustvote:preferencias";
  const readPrefs = () => {
    try {
      return JSON.parse(localStorage.getItem(PREFS) || "{}");
    } catch {
      return {};
    }
  };

  team.renderSettings = function renderSettings() {
    const el = panel("settings");
    el.innerHTML = TV.teamView.settingsPage({
      base: TV.base,
      defaultBase: TV.DEFAULT_BASE,
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: -new Date().getTimezoneOffset() / 60,
      twoFactorCard: twoFactor.card(session.user),
    });

    // Texto maior e contraste: os interruptores mostram o estado guardado
    const paint = () =>
      el.querySelectorAll("[data-pref]").forEach((b) => b.setAttribute("aria-pressed", String(!!readPrefs()[b.dataset.pref])));
    el.querySelectorAll("[data-pref]").forEach((b) =>
      b.addEventListener("click", () => {
        const prefs = { ...readPrefs(), [b.dataset.pref]: !readPrefs()[b.dataset.pref] };
        try {
          localStorage.setItem(PREFS, JSON.stringify(prefs));
        } catch { }
        document.body.classList.toggle("large-text", !!prefs.largeText);
        document.body.classList.toggle("high-contrast", !!prefs.contrast);
        paint();
      })
    );
    paint();

    // Endereço da API: só fica guardado se o servidor responder
    const form = el.querySelector("[data-api-form]");
    const message = form.querySelector(".form-message");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const anterior = TV.base;
      TV.setBase(form.base.value);
      try {
        const res = await ui.busy(form.querySelector('[type="submit"]'), "A testar…", () => api.health());
        if (!res.ok) throw new Error(`O servidor respondeu com erro ${res.status}.`);
        ui.message(message, `Ligação guardada · ${res.latency} ms.`, true);
      } catch (error) {
        TV.setBase(anterior);
        ui.message(message, error.message);
      }
    });
    el.querySelector("[data-default]").addEventListener("click", () => {
      form.base.value = TV.DEFAULT_BASE;
    });
    twoFactor.wire(el, renderSettings);
  };
})();
