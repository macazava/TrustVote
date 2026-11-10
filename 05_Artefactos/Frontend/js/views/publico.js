/* View · blocos das páginas públicas preenchidos com dados da API (página inicial, calendário, listas, resultados) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, date, dateTime, period, time, initials } = TV.format;
  const { statusLabels } = TV.elections;
  const { resultRow, roundSummary } = TV.charts;

  // ===== Página inicial: faixa dos números =====
  const metrics = (resumo, online) => `
    <div><b>${number(resumo && resumo.eleitores)}</b><small>estudantes elegíveis</small></div>
    <i></i>
    <div><b>${number(resumo && resumo.votos)}</b><small>votos registados</small></div>
    <i></i>
    <div><b>1 voto</b><small>por estudante</small></div>
    <i></i>
    <div><b>${percent(resumo && resumo.participacao)}</b><small>participação</small></div>
    <p>${resumo
      ? `Dados em tempo real · atualizado às ${time(new Date().toISOString())}`
      : online
        ? "Ainda não há eleições públicas: os números aparecem quando a primeira for agendada."
        : "Servidor indisponível: não foi possível obter os números."
    }</p>`;

  // ===== Calendário: próxima eleição =====
  const electionEyebrow = { em_curso: "VOTAÇÃO A DECORRER", agendada: "PRÓXIMA ELEIÇÃO", encerrada: "ÚLTIMA ELEIÇÃO" };
  const nextElection = (e) => `
    <div class="heading-row">
      <div>
        <p class="eyebrow">${electionEyebrow[e.estado] || "ELEIÇÃO"}</p>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p>Votação de ${dateTime(e.data_inicio)} a ${dateTime(e.data_fim)}.</p>
      </div>
      <span class="status-pill"><i></i> ${statusLabels[e.estado] || e.estado}</span>
    </div>`;

  // ===== Listas: um cartão por lista, com candidatos e propostas =====
  const listCard = (nome, membros, tituloEleicao) => {
    const propostas = membros.map((c) => c.descricao).filter(Boolean);
    return `
      <article>
        <span class="candidate-badge">${escapeHtml(nome.startsWith("Lista ") ? nome.slice(6) : initials(nome))}</span>
        <h2>${escapeHtml(nome)}</h2>
        <p><b>Candidatos:</b> ${escapeHtml(membros.map((c) => c.nome).join(", "))}</p>
        ${propostas.length ? `<ul class="candidate-proposals">${propostas.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
        <span class="status-pill">${escapeHtml(tituloEleicao.toUpperCase())}</span>
      </article>`;
  };

  // ===== Página inicial: avisos gerados a partir do estado da eleição =====
  function notices(resumo) {
    const e = resumo.eleicao;
    const titulo = escapeHtml(e.titulo);
    const estado = {
      em_curso: ["login.html?area=eleitor", date(e.data_fim), `Votação aberta: ${titulo}`],
      agendada: ["calendario.html", date(e.data_inicio), `Próxima votação: ${titulo}`],
      encerrada: ["resultados.html", date(e.data_fim), `Votação encerrada: ${titulo}`],
    }[e.estado];
    const listas = new Set(resumo.candidatos.map((c) => c.partido || c.nome)).size;
    const avisos = [
      estado,
      ["listas.html", `${number(listas)} ${listas === 1 ? "LISTA" : "LISTAS"}`, "Conheça as candidaturas e as suas propostas"],
      ["resultados.html", percent(resumo.participacao), `${number(resumo.votos)} de ${number(resumo.eleitores)} estudantes já votaram`],
    ];
    return avisos
      .filter(Boolean)
      .map(([link, etiqueta, texto]) => `<a href="${link}"><time>${escapeHtml(String(etiqueta).toUpperCase())}</time><b>${texto}</b><i>${TV.icon("arrow-right")}</i></a>`)
      .join("");
  }

  // ===== Histórico: uma entrada por eleição encerrada =====
  const historyPeriod = (e) => `
    <article class="history-period">
      <header><span>${TV.icon("calendar")}</span><time>${escapeHtml(period(e.data_inicio, e.data_fim))}</time></header>
      <h2>${escapeHtml(e.titulo)}</h2>
      ${e.descricao ? `<p>${escapeHtml(e.descricao)}</p>` : ""}
      <div class="facts grid-cols-2 sm:grid-cols-3">
        <div><b>${number(e.eleitores)}</b><small>estudantes elegíveis</small></div>
        <div><b>${number(e.votos)}</b><small>votos</small></div>
        <div><b>${percent(e.participacao)}</b><small>participação</small></div>
      </div>
    </article>`;

  // ===== "Como funciona": o que aconteceu no fecho da última eleição =====
  // Sem eleições encerradas mostra só os passos, sem horas
  // Encerrada antes da hora marcada: o fecho foi no máximo quando ficou apurada
  const fecho = (e) => (e.apurada_em && Date.parse(e.apurada_em) < Date.parse(e.data_fim) ? e.apurada_em : e.data_fim);
  const lastCount = (e) =>
    e
      ? [
        `${dateTime(fecho(e))} · Votação encerrada`,
        `${e.apurada_em ? dateTime(e.apurada_em) : "por apurar"} · Contagem concluída`,
        `${e.titulo} · ${percent(e.participacao)} de participação`,
      ].map((linha) => `<span>${escapeHtml(linha)}</span>`).join("")
      : ["Votação encerrada", "Contagem concluída", "Resultados publicados"].map((t) => `<span>${t}</span>`).join("");

  // ===== Resultados =====
  const turnoutCard = (dados) => `
    <article class="dash-card">
      <p class="eyebrow">PARTICIPAÇÃO EM TEMPO REAL</p>
      <h2>${escapeHtml(dados.eleicao.titulo)}</h2>
      <div class="facts grid-cols-2 sm:grid-cols-3">
        <div><b>${number(dados.eleitores)}</b><small>estudantes elegíveis</small></div>
        <div><b>${number(dados.votos)}</b><small>votos</small></div>
        <div><b>${percent(dados.participacao)}</b><small>participação</small></div>
      </div>
    </article>`;

  const loginForResults = () => `
    <article class="dash-card">
      <h2>Resultados detalhados</h2>
      <p>Os resultados por candidatura estão disponíveis na área reservada.</p>
      <a class="button button-primary" href="login.html?area=eleitor">Iniciar sessão ${TV.icon("arrow-right")}</a>
    </article>`;

  function resultsCard(eleicao, rondas, error) {
    const body = error
      ? `<p class="form-message">${escapeHtml(error.message)}</p>`
      : (rondas || [])
        .map((r) => `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>${r.candidatos.map(resultRow).join("")}${roundSummary(r)}`)
        .join("");
    return `
      <article class="dash-card">
        <div class="heading-row">
          <h2>${escapeHtml(eleicao.titulo)}</h2>
          <span class="status-pill"><i></i> ${statusLabels[eleicao.estado] || eleicao.estado}</span>
        </div>
        ${body}
      </article>`;
  }

  TV.publicView = { metrics, notices, historyPeriod, nextElection, lastCount, listCard, turnoutCard, loginForResults, resultsCard };
})();
