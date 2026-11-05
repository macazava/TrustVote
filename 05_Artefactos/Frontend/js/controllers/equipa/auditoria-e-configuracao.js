/* Controller · área da equipa, separadores "Auditoria" e "Configuração" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, password, download } = TV;
  const { dateTime, fullDate } = TV.format;
  const { panel, attempt } = TV.panels;
  const team = (TV.team = TV.team || {});

  // ===== Auditoria =====
  const nomesEntidade = { eleicao: "Eleição", candidato: "Candidato", utilizador: "Conta", ronda: "Votação", estudante_inscrito: "Lista de inscritos" };

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
    const registos = lista.map((r) => ({ data: dateTime(r.data), completa: fullDate(r.data), acao: r.acao, sobre: sobre(r), autor: autor(r), ip: r.ip, hash: r.hash_atual }));

    el.innerHTML = TV.teamView.auditPage(registos);
    el.querySelector("[data-refresh]").addEventListener("click", () => ui.mount(el, renderAudit));
    el.querySelector("[data-verify-chain]").addEventListener("click", async (event) => {
      try {
        const v = await ui.busy(event.currentTarget, "A verificar…", () => api.auditoria.verificar());
        el.querySelector("[data-chain-result]").innerHTML = TV.teamView.chainResult(v);
      } catch (error) {
        ui.toast(error.message, true);
      }
    });
    el.querySelector("[data-csv]").addEventListener("click", () =>
      download.csv(
        "auditoria",
        ["Data e hora", "Ação", "Sobre", "Feito por", "IP", "Hash"],
        registos.map((r) => [r.completa, r.acao, r.sobre, r.autor, r.ip || "", r.hash || ""])
      )
    );
  };

  // ===== Configuração =====
  team.renderSettings = function renderSettings() {
    const el = panel("settings");
    el.innerHTML = TV.teamView.settingsPage({
      base: TV.base,
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: -new Date().getTimezoneOffset() / 60,
      passwordCard: password.card(),
    });
    password.wire(el);

    Promise.all([api.publico.configuracao().catch(() => null), api.health().catch(() => null)]).then(([config, saude]) => {
      const destino = el.querySelector("[data-server-params]");
      if (destino) destino.innerHTML = TV.teamView.serverParams(config, saude && saude.data);
    });

    // Texto maior e contraste: guardados por TrustVote.prefs (controllers/comum/pagina.js)
    el.querySelectorAll("[data-pref]").forEach((b) =>
      b.addEventListener("click", () => TV.prefs.save({ [b.dataset.pref]: !TV.prefs.read()[b.dataset.pref] }))
    );
    TV.prefs.apply();
  };
})();
