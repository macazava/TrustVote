/* View · blocos das páginas públicas preenchidos com dados da API (página inicial, calendário, listas, resultados) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, dateTime, time, initials } = TV.format;
  const { statusLabels } = TV.elections;
  const { resultRow } = TV.charts;

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
        ? "Os números públicos ainda não estão disponíveis no backend."
        : "Servidor indisponível: não foi possível obter os números."
    }</p>`;

  // ===== Calendário: próxima eleição =====
  const nextElection = (e) => `
    <div class="heading-row">
      <div>
        <p class="eyebrow">PRÓXIMA ELEIÇÃO</p>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p>Votação de ${dateTime(e.data_inicio)} a ${dateTime(e.data_fim)}.</p>
      </div>
      <span class="status-pill rounded-full"><i></i> ${statusLabels[e.estado] || e.estado}</span>
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
        <span class="status-pill rounded-full">${escapeHtml(tituloEleicao.toUpperCase())}</span>
      </article>`;
  };

  // ===== Resultados =====
  const turnoutCard = (dados) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      <p class="eyebrow">PARTICIPAÇÃO EM TEMPO REAL</p>
      <h2>${escapeHtml(dados.eleicao.titulo)}</h2>
      <div class="facts grid-cols-2 sm:grid-cols-3">
        <div><b>${number(dados.eleitores)}</b><small>estudantes elegíveis</small></div>
        <div><b>${number(dados.votos)}</b><small>votos</small></div>
        <div><b>${percent(dados.participacao)}</b><small>participação</small></div>
      </div>
    </article>`;

  const loginForResults = () => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      <h2>Resultados detalhados</h2>
      <p>Os resultados por candidatura estão disponíveis na área reservada.</p>
      <a class="button rounded-xl button-primary shadow-sm hover:shadow-lift" href="login.html?area=eleitor">Iniciar sessão →</a>
    </article>`;

  function resultsCard(eleicao, rondas, error) {
    const body = error
      ? `<p class="form-message">${escapeHtml(error.message)}</p>`
      : (rondas || [])
        .map((r) => `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>${r.candidatos.map(resultRow).join("")}`)
        .join("");
    return `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <div class="heading-row">
          <h2>${escapeHtml(eleicao.titulo)}</h2>
          <span class="status-pill rounded-full"><i></i> ${statusLabels[eleicao.estado] || eleicao.estado}</span>
        </div>
        ${body}
      </article>`;
  }

  // ===== Transparência: estado dos servidores =====
  const serverStatus = ({ ok, media, instancias, baseDados }) => `
    <div class="audit-list">
      <p><i>${ok ? "✓" : "!"}</i> API ${ok ? "disponível" : "com falhas"} · ${media} ms de latência média</p>
      <p><i>${instancias.length > 1 ? "✓" : "!"}</i> ${instancias.length || "—"} instância(s) a responder: ${escapeHtml(instancias.join(", ") || "—")}</p>
      <p><i>${baseDados ? "✓" : "!"}</i> Base de dados ${baseDados ? "ligada" : "sem resposta"}</p>
    </div>`;

  TV.publicView = { metrics, nextElection, listCard, turnoutCard, loginForResults, resultsCard, serverStatus };
})();
