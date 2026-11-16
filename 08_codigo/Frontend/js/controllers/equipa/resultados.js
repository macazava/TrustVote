/* Controller · área da equipa, separador "Resultados": separadores por eleição, painel da eleição escolhida,
   atualização automática enquanto a votação está aberta, verificação de integridade e exportação CSV */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, elections, download } = TV;
  const { percent, slug } = TV.format;
  const { resultRows } = TV.results;
  const { panel, attempt } = TV.panels;

  const ATUALIZAR_A_CADA = 30000;
  let relogio = null;

  // Junta tudo o que o painel de uma eleição precisa
  async function carregar(e) {
    const [detalhe, stats, resultados] = await Promise.all([
      api.eleicoes.detalhe(e.id).then(elections.view),
      attempt(api.votacao.estatisticas(e.id)),
      attempt(api.votacao.resultados(e.id)),
    ]);
    return { e: detalhe, stats: stats.data, rondas: resultados.data || [], erro: resultados.error, atualizado: new Date().toISOString() };
  }

  async function renderResults() {
    const el = panel("results");
    clearInterval(relogio);
    const lista = await api.eleicoes.listar();
    const visiveis = lista.filter((e) => ["em_curso", "encerrada"].includes(e.estado));
    const dados = await Promise.all(visiveis.map(carregar));

    // Ao vivo primeiro, depois as encerradas da mais recente para a mais antiga
    const inicio = (d) => Date.parse(d.e.inicio || d.e.data_criacao);
    const itens = [...dados].sort((a, b) => (a.e.estado === "em_curso") - (b.e.estado === "em_curso") || inicio(a) - inicio(b)).reverse();
    // Comparação histórica: encerradas, da mais antiga para a mais recente
    const historico = dados.filter((d) => d.e.estado === "encerrada").sort((a, b) => inicio(a) - inicio(b));

    let escolhida = itens[0] && itens[0].e.id;
    const voltas = {}; // volta escolhida em cada eleição
    el.innerHTML = TV.teamView.resultsPage(itens, historico, escolhida);
    if (!itens.length) return;

    const board = el.querySelector("[data-results-board]");
    const tabs = [...el.querySelectorAll("[data-result-election]")];
    const atual = () => itens.find((d) => d.e.id === escolhida);

    function desenhar() {
      const d = atual();
      board.innerHTML = TV.teamView.resultsBoard(d, voltas[d.e.id]);
      ligar(d);
    }

    function ligar(d) {
      board.querySelectorAll("[data-result-round]").forEach((input) =>
        input.addEventListener("change", () => {
          voltas[d.e.id] = Number(input.value);
          desenhar();
        })
      );

      board.querySelector("[data-integrity]")?.addEventListener("click", async (event) => {
        const b = event.currentTarget;
        try {
          const r = await ui.busy(b, "A verificar…", () => api.votacao.integridade(d.e.id));
          board.querySelector("[data-integrity-result]").innerHTML = TV.teamView.integrityResult(r);
        } catch (error) {
          ui.toast(error.message, true);
        }
      });

      // Relatório de resultados: uma linha por candidato e por volta
      board.querySelector("[data-export]")?.addEventListener("click", () => {
        const { e, stats, rondas } = d;
        const linhas = rondas.flatMap((r) => [
          ...resultRows(r, e.candidatos).map((l) => [e.titulo, `${r.ronda}.ª volta`, l.nome, l.detalhe, l.votos, percent(l.percentagem)]),
          [e.titulo, `${r.ronda}.ª volta`, "Votos em branco", "", r.brancos, percent(r.percentagem_brancos)],
        ]);
        if (stats) linhas.push([], ["Participação", "", "", "", `${stats.votantes} de ${stats.habilitados}`, percent(stats.participacao)]);
        download.csv(`resultados-${slug(e.titulo)}`, ["Eleição", "Volta", "Candidato", "Lista", "Votos", "Percentagem"], linhas);
      });
    }

    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        escolhida = Number(tab.dataset.resultElection);
        tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        desenhar();
      })
    );
    // Setas do teclado entre separadores
    el.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });

    desenhar();

    // Votação aberta: recarrega os números da eleição escolhida (sem mexer na verificação já feita)
    relogio = setInterval(async () => {
      if (!board.isConnected) return clearInterval(relogio);
      const d = atual();
      if (d.e.estado !== "em_curso" || document.hidden) return;
      try {
        const novo = await carregar(d.e);
        itens[itens.indexOf(d)] = novo;
        if (escolhida !== novo.e.id) return;
        const verificacao = board.querySelector("[data-integrity-result]")?.innerHTML || "";
        desenhar();
        board.querySelector("[data-integrity-result]").innerHTML = verificacao;
        // Encerrou entretanto: recarrega o separador para mostrar o apuramento final
        if (novo.e.estado !== "em_curso") renderResults();
      } catch {
        /* rede: tenta no próximo ciclo */
      }
    }, ATUALIZAR_A_CADA);
  }

  (TV.team = TV.team || {}).renderResults = renderResults;
})();
