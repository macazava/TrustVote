/* View · blocos das páginas públicas preenchidos com dados da API (página inicial, calendário, listas, resultados) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, date, dateTime, period, time, initials } = TV.format;

  // ===== Calendário: próxima eleição =====
  const electionEyebrow = { em_curso: "VOTAÇÃO A DECORRER", agendada: "PRÓXIMA ELEIÇÃO", encerrada: "ÚLTIMA ELEIÇÃO" };
  const nextElection = (e) => `
    <div class="heading-row">
      <div>
        <p class="eyebrow">${electionEyebrow[e.estado] || "ELEIÇÃO"}</p>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p>Votação de ${dateTime(e.data_inicio)} a ${dateTime(e.data_fim)}.</p>
        ${e.estado === "encerrada" ? "" : TV.blocks.calendarButton({ id: e.id, titulo: e.titulo, inicio: e.data_inicio, fim: e.data_fim, descricao: e.descricao })}
      </div>
      ${TV.blocks.stateBadge(e.estado)}
    </div>`;

  // ===== Listas: um cartão por lista, com candidatos e propostas =====
  // Os membros só aparecem quando acrescentam algo ao título (lista com nome próprio ou vários candidatos)
  const listCard = (nome, membros) => {
    const ehLista = nome.startsWith("Lista ");
    const propostas = membros.map((c) => c.descricao).filter(Boolean);
    const mostrarMembros = membros.length > 1 || membros[0].nome !== nome;
    return `
      <article class="list-card">
        <header>
          <span class="candidate-badge">${escapeHtml(ehLista ? nome.slice(6) : initials(nome))}</span>
          <div>
            <small>${ehLista ? "LISTA" : "CANDIDATURA"}</small>
            <h2>${escapeHtml(nome)}</h2>
          </div>
        </header>
        ${mostrarMembros
        ? `<ul class="list-members" aria-label="Candidatos">${membros.map((c) => `<li><span class="avatar" aria-hidden="true">${escapeHtml(initials(c.nome))}</span>${escapeHtml(c.nome)}</li>`).join("")}</ul>`
        : ""}
        ${propostas.length
        ? `<p class="list-label">Propostas</p><ul class="candidate-proposals">${propostas.map((p) => `<li>${TV.icon("check")}<span>${escapeHtml(p)}</span></li>`).join("")}</ul>`
        : '<p class="list-empty">Ainda sem propostas publicadas.</p>'}
      </article>`;
  };

  // Resumo por cima das listas: a eleição, quantas listas há e o que fazer a seguir
  const listsSummary = (e, total) => `
    <div class="lists-summary">
      <div>
        <p class="eyebrow">${electionEyebrow[e.estado] || "ELEIÇÃO"}</p>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p>${number(total)} ${total === 1 ? "candidatura admitida" : "candidaturas admitidas"} · votação de ${dateTime(e.data_inicio)} a ${dateTime(e.data_fim)}</p>
      </div>
      ${e.estado === "em_curso"
      ? `<a class="button" href="login.html?area=eleitor" data-voter-link>Votar agora ${TV.icon("arrow-right")}</a>`
      : `<a class="button" href="${e.estado === "encerrada" ? "resultados.html" : "calendario.html"}">${e.estado === "encerrada" ? "Ver resultados" : "Ver calendário"} ${TV.icon("arrow-right")}</a>`}
    </div>`;

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
  // Um cartão por eleição: ano à esquerda (marca da linha do tempo), participação em barra e números
  const historyPeriod = (e) => `
    <article class="history-period">
      <div class="history-year" aria-hidden="true"><span>${TV.icon("calendar")}</span><b>${new Date(e.data_fim).getFullYear()}</b></div>
      <div class="history-body">
        <div class="history-top">
          ${TV.blocks.stateBadge("encerrada")}
          <time>${escapeHtml(period(e.data_inicio, e.data_fim))}</time>
        </div>
        <h2>${escapeHtml(e.titulo)}</h2>
        ${e.descricao ? `<p>${escapeHtml(e.descricao)}</p>` : ""}
        <div class="history-turnout">
          <div><small>PARTICIPAÇÃO</small><b>${percent(e.participacao)}</b></div>
          <div class="bar" role="img" aria-label="${percent(e.participacao)} de participação"><i style="width:${Math.min(100, e.participacao || 0)}%"></i></div>
        </div>
        <div class="facts">
          <div><b>${number(e.eleitores)}</b><small>estudantes elegíveis</small></div>
          <div><b>${number(e.votos)}</b><small>votos registados</small></div>
          <div><b>${e.apurada_em ? date(e.apurada_em) : "—"}</b><small>apuramento</small></div>
        </div>
        <a class="history-link" href="resultados.html">Ver resultados ${TV.icon("arrow-right")}</a>
      </div>
    </article>`;

  // Totais no topo da página: quantas eleições, quantos votos e a participação média
  const historyStats = (lista) => {
    const votos = lista.reduce((t, e) => t + (e.votos || 0), 0);
    const media = lista.reduce((t, e) => t + (e.participacao || 0), 0) / lista.length;
    return `
      <div><dt>Eleições encerradas</dt><dd>${number(lista.length)}</dd></div>
      <div><dt>Votos registados</dt><dd>${number(votos)}</dd></div>
      <div><dt>Participação média</dt><dd>${percent(media)}</dd></div>`;
  };

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

  // ===== Resultados: convite para entrar (o quadro de cada eleição vem de views/resultados.js) =====
  const loginForResults = () => `
    <article class="dash-card results-login">
      <span class="results-pending-icon">${TV.icon("user-check")}</span>
      <div>
        <h2>Resultados por candidatura</h2>
        <p>Os votos de cada candidatura, os brancos e o quórum estão na área reservada, depois de iniciar sessão.</p>
      </div>
      <a class="button button-primary" href="login.html?area=eleitor">Iniciar sessão ${TV.icon("arrow-right")}</a>
    </article>`;

  TV.publicView = { notices, historyPeriod, historyStats, nextElection, lastCount, listCard, listsSummary, loginForResults };
})();
