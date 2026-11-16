/* Controller · área da equipa, separador "Auditoria": cronologia com pesquisa e filtros, cadeia e CSV */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, download } = TV;
  const { fullDate } = TV.format;
  const { panel, attempt } = TV.panels;
  const team = (TV.team = TV.team || {});

  const LIMITE = 500;
  const POR_PAGINA = 60;
  const nomesEntidade = { eleicao: "Eleição", candidato: "Candidato", utilizador: "Conta", ronda: "Votação", estudante_inscrito: "Lista de inscritos" };

  team.renderAudit = async function renderAudit() {
    const el = panel("audit");
    const [lista, utilizadores, eleicoes] = await Promise.all([api.auditoria.listar(LIMITE), attempt(api.utilizadores.listar()), attempt(api.eleicoes.listar())]);
    const nomes = new Map((utilizadores.data || []).map((u) => [u.id, u.nome]));
    const titulos = new Map((eleicoes.data || []).map((e) => [e.id, e.titulo]));

    // "Sobre": o título da eleição ou o nome da conta; se não houver, o tipo e o número
    const sobre = (r) => {
      const eleicao = r.entidade === "eleicao" ? r.entidade_id : r.detalhes && r.detalhes.eleicao_id;
      if (r.entidade === "eleicao" && titulos.has(r.entidade_id)) return titulos.get(r.entidade_id);
      if (r.entidade === "utilizador" && nomes.has(r.entidade_id)) return nomes.get(r.entidade_id);
      const base = [nomesEntidade[r.entidade] || r.entidade, r.entidade_id && `#${r.entidade_id}`].filter(Boolean).join(" ") || "—";
      return eleicao && titulos.has(eleicao) ? `${base} · ${titulos.get(eleicao)}` : base;
    };
    const registos = lista
      .map((r) => ({
        iso: r.data,
        completa: fullDate(r.data),
        acao: r.acao,
        entidade: r.entidade,
        sobre: sobre(r),
        sistema: !r.utilizador_id,
        autor: r.utilizador_id ? nomes.get(r.utilizador_id) || `Utilizador #${r.utilizador_id}` : "Sistema",
        ip: r.ip,
        hash: r.hash_atual,
        detalhes: r.detalhes,
      }))
      .sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso));

    el.innerHTML = TV.teamView.auditPage(registos);
    el.querySelector("[data-refresh]").addEventListener("click", () => ui.mount(el, renderAudit));

    // Verificar a cadeia (o botão volta a aparecer no resultado, para repetir)
    const cadeia = el.querySelector("[data-chain-result]");
    const ligarVerificacao = () =>
      cadeia.querySelector("[data-verify-chain]").addEventListener("click", async (event) => {
        try {
          const v = await ui.busy(event.currentTarget, "A verificar…", () => api.auditoria.verificar());
          cadeia.innerHTML = TV.teamView.chainResult(v);
          ligarVerificacao();
        } catch (error) {
          ui.toast(error.message, true);
        }
      });
    ligarVerificacao();

    el.querySelector("[data-csv]").addEventListener("click", () =>
      download.csv(
        "auditoria",
        ["Data e hora", "Ação", "Sobre", "Feito por", "IP", "Hash"],
        registos.map((r) => [r.completa, r.acao, r.sobre, r.autor, r.ip || "", r.hash || ""])
      )
    );

    // Pesquisa, filtro por tipo e "Mostrar mais"
    const destino = el.querySelector("[data-audit-list]");
    if (!destino) return;
    const mais = el.querySelector("[data-audit-more]");
    const pesquisa = el.querySelector("[data-audit-search]");
    const chips = [...el.querySelectorAll("[data-audit-filter]")];
    let filtro = "";
    let limite = POR_PAGINA;

    function desenhar() {
      const termo = pesquisa.value.trim().toLowerCase();
      const visiveis = registos.filter(
        (r) =>
          (!filtro || (filtro === "sistema" ? r.sistema : r.entidade === filtro)) &&
          (!termo || [r.acao, r.sobre, r.autor, r.ip].filter(Boolean).join(" ").toLowerCase().includes(termo))
      );
      destino.innerHTML = TV.teamView.auditTimeline(visiveis.slice(0, limite));
      mais.innerHTML = visiveis.length > limite ? `<button class="button button-light" type="button" data-more>Mostrar mais (${visiveis.length - limite})</button>` : "";
      mais.querySelector("[data-more]")?.addEventListener("click", () => {
        limite += POR_PAGINA;
        desenhar();
      });
    }
    pesquisa.addEventListener("input", () => {
      limite = POR_PAGINA;
      desenhar();
    });
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        filtro = chip.dataset.auditFilter;
        limite = POR_PAGINA;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        desenhar();
      })
    );
    desenhar();
  };
})();
