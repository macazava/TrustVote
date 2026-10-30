/* Model · eleições: estado, ronda atual, datas e a eleição em destaque (TrustVote.elections) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, localReceipts } = TV;
  const { period } = TV.format;

  const statusLabels = {
    rascunho: "RASCUNHO",
    agendada: "AGENDADA",
    em_curso: "VOTAÇÃO ABERTA",
    encerrada: "ENCERRADA",
  };

  const orgaoLabels = {
    direcao: "Direção",
    assembleia: "Assembleia",
    conselho_fiscal: "Conselho Fiscal",
  };

  // Órgão, curso e ano do candidato, para mostrar junto ao nome
  function candidateInfo(c) {
    const ano = c.ano ? `${c.ano}.º ano` : "";
    return [orgaoLabels[c.orgao], [c.curso, ano].filter(Boolean).join(", ")].filter(Boolean);
  }

  function currentRound(eleicao) {
    const rondas = [...((eleicao && eleicao.rondas) || [])].sort((a, b) => a.numero - b.numero);
    return (
      rondas.find((r) => r.estado === "aberta") ||
      rondas.find((r) => r.estado === "agendada") ||
      rondas[rondas.length - 1] ||
      null
    );
  }

  // Junta à eleição o que o ecrã precisa: ronda atual, se está aberta, ano, período e etiquetas
  function electionView(eleicao) {
    const ronda = currentRound(eleicao);
    const inicio = ronda ? ronda.data_inicio : null;
    const fim = ronda ? ronda.data_fim : null;
    const now = Date.now();
    const aberta =
      eleicao.estado === "em_curso" &&
      !!ronda &&
      ronda.estado === "aberta" &&
      (!inicio || Date.parse(inicio) <= now) &&
      (!fim || Date.parse(fim) > now);
    const candidatos = ronda && ronda.candidatos && ronda.candidatos.length
      ? ronda.candidatos
      : (eleicao.candidatos || []).filter((c) => c.ativo);

    return {
      ...eleicao,
      ronda,
      inicio,
      fim,
      aberta,
      ano: new Date(inicio || eleicao.data_criacao || Date.now()).getFullYear(),
      estadoLabel: statusLabels[eleicao.estado] || String(eleicao.estado).toUpperCase(),
      periodo: period(inicio, fim),
      voltaLabel: ronda ? `${ronda.numero === 2 ? "2.ª" : "1.ª"} volta · ${ronda.estado}` : "Sem ronda definida",
      candidatosRonda: candidatos,
    };
  }

  async function featuredElection() {
    const todas = await api.eleicoes.listar();
    const escolhida =
      todas.find((e) => e.estado === "em_curso") || todas.find((e) => e.estado === "agendada") || null;
    return escolhida ? electionView(await api.eleicoes.detalhe(escolhida.id)) : null;
  }

  // Eleições do eleitor, com a indicação de se já votou em cada uma
  async function hasVoted(eleicao) {
    try {
      return !!(await api.votacao.participacao(eleicao.id)).votou;
    } catch {
      return localReceipts.all().some((r) => r.eleicao_id === eleicao.id && (!eleicao.ronda || r.ronda === eleicao.ronda.numero));
    }
  }

  async function loadForVoter() {
    const todas = await api.eleicoes.listar();
    const detalhes = await Promise.all(todas.map((e) => api.eleicoes.detalhe(e.id).then(electionView)));
    await Promise.all(
      detalhes.map(async (e) => {
        e.votou = await hasVoted(e);
      })
    );
    return detalhes;
  }

  // Converte datetime-local para ISO com fuso horário (exigido pelo backend)
  function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
    return `${value.length === 16 ? `${value}:00` : value}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
  }

  function toLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  TV.elections = { statusLabels, orgaoLabels, candidateInfo, currentRound, view: electionView, featured: featuredElection, loadForVoter, fromLocalInput, toLocalInput };
})();
