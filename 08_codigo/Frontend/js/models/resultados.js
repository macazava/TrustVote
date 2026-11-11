/* Model · contas sobre os resultados: votos por candidato e por lista (TrustVote.results) */
(function () {
  "use strict";

  // Junta os resultados de uma ronda com os dados dos candidatos (lista) e ordena do mais para o menos votado
  function resultRows(ronda, candidatos) {
    const lista = new Map((candidatos || []).map((c) => [c.id, c.partido]));
    return [...ronda.candidatos]
      .map((c) => ({ nome: c.nome, detalhe: lista.get(c.id) || "", votos: c.total_votos || 0, percentagem: c.percentagem || 0 }))
      .sort((a, b) => b.votos - a.votos);
  }

  // Soma os votos dos candidatos de cada lista
  function listRows(linhas) {
    const total = linhas.reduce((s, l) => s + l.votos, 0);
    const porLista = new Map();
    linhas.forEach((l) => porLista.set(l.detalhe || "Sem lista", (porLista.get(l.detalhe || "Sem lista") || 0) + l.votos));
    return [...porLista]
      .map(([nome, votos]) => ({ nome, votos, percentagem: total ? Math.round((votos / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.votos - a.votos);
  }

  window.TrustVote.results = { resultRows, listRows };
})();
