/* Controller · área da equipa, separador "Visão geral": junta os números da eleição em destaque */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, elections } = TV;
  const { panel, attempt } = TV.panels;

  // Texto do tempo que falta: "5 h", "1 dia", "3 dias" ou "Terminada"
  function timeLeft(fim) {
    if (fim === null) return null;
    if (fim <= 0) return "Terminada";
    if (fim < 864e5) return `${Math.ceil(fim / 36e5)} h`;
    const dias = Math.floor(fim / 864e5);
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }

  async function renderOverview() {
    const [eleicao, lista] = await Promise.all([elections.featured(), api.eleicoes.listar()]);
    const [stats, resultados] = eleicao
      ? await Promise.all([attempt(api.votacao.estatisticas(eleicao.id)), attempt(api.votacao.resultados(eleicao.id))])
      : [{ error: null }, { error: null }];
    const serie = (stats.data && stats.data.serie) || [];

    panel("overview").innerHTML = TV.teamView.overview({
      eleicao,
      lista,
      stats,
      resultados,
      serie,
      ultimaHora: serie.length ? serie[serie.length - 1].votos : null,
      emCurso: lista.filter((e) => e.estado === "em_curso").length,
      encerradas: lista.filter((e) => e.estado === "encerrada").length,
      rondaAtual: resultados.data && resultados.data[resultados.data.length - 1],
      restante: timeLeft(eleicao && eleicao.fim ? Date.parse(eleicao.fim) - Date.now() : null),
    });
  }

  (TV.team = TV.team || {}).renderOverview = renderOverview;
})();
