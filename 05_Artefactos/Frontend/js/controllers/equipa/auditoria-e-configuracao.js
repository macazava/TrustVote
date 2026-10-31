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
  team.renderSettings = function renderSettings() {
    const el = panel("settings");
    el.innerHTML = TV.teamView.settingsPage({
      base: TV.base,
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: -new Date().getTimezoneOffset() / 60,
      twoFactorCard: twoFactor.card(session.user),
    });

    // Texto maior e contraste: guardados por TrustVote.prefs (controllers/comum/pagina.js)
    el.querySelectorAll("[data-pref]").forEach((b) =>
      b.addEventListener("click", () => TV.prefs.save({ [b.dataset.pref]: !TV.prefs.read()[b.dataset.pref] }))
    );
    TV.prefs.apply();

    twoFactor.wire(el, renderSettings);
  };
})();
