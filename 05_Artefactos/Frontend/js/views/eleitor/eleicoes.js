/* View · área do eleitor: cartão de cada eleição, passos do voto, lista de eleições, detalhes e ajuda */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, countdown, initials } = TV.format;
  const { head, stateBadge } = TV.blocks;

  // Tempo que falta para fechar ou abrir (o número é atualizado a cada 30 s pelo arranque)
  const timeInfo = (e) =>
    e.aberta && e.fim
      ? `Termina em <b data-countdown="${e.fim}">${countdown(e.fim)}</b>`
      : e.inicio && Date.parse(e.inicio) > Date.now()
        ? `Começa em <b data-countdown="${e.inicio}">${countdown(e.inicio)}</b>`
        : escapeHtml(e.periodo);

  const statusLine = (e) => stateBadge(e.votou ? "votou" : e.aberta ? "em_curso" : e.estado);

  // Botão principal: votar, ver o recibo ou votação fechada
  function voteAction(e, label = `Iniciar votação ${TV.icon("arrow-right")}`) {
    if (e.votou) return `<button class="button button-outline" type="button" data-go="receipts">Ver recibo ${TV.icon("arrow-right")}</button>`;
    if (!e.aberta) return '<button class="button button-outline" type="button" disabled>Votação fechada</button>';
    return `<button class="button button-primary" type="button" data-vote="${e.id}">${label}</button>`;
  }

  // Identidade → Votação → Recibo
  function stepsTrack(e) {
    const votou = e && e.votou;
    return `
      <div class="steps-track">
        <span class="is-done"><i>${TV.icon("check")}</i><b>Identidade</b><small>Confirmada</small></span>
        <hr>
        <span class="${votou ? "is-done" : "is-current"}"><i>${votou ? TV.icon("check") : "2"}</i><b>Votação</b><small>${votou ? "Concluída" : "Por concluir"}</small></span>
        <hr>
        <span class="${votou ? "is-done" : ""}"><i>${votou ? TV.icon("check") : "3"}</i><b>Recibo</b><small>${votou ? "Emitido" : "Após o voto"}</small></span>
      </div>`;
  }

  function electionCard(e, withDetails) {
    return `
      <article class="election-card overflow-hidden">
        <div class="election-card-top">${statusLine(e)}<span>${timeInfo(e)}</span></div>
        <div class="election-card-body">
          <span class="round-mark">${TV.icon("vote")}</span>
          <div>
            <small>ELEIÇÃO · ${e.ano}</small>
            <h2>${escapeHtml(e.titulo)}</h2>
            <p>${escapeHtml(e.descricao || `${e.periodo} · ${e.voltaLabel}`)}</p>
          </div>
          <div class="election-card-actions">
            ${withDetails ? `<button class="button button-outline" type="button" data-details="${e.id}">Ver detalhes</button>` : ""}
            ${voteAction(e)}
            ${!e.votou && (e.aberta || e.estado === "agendada") ? TV.blocks.calendarButton({ id: e.id, titulo: e.titulo, inicio: e.inicio, fim: e.fim, descricao: e.descricao }) : ""}
          </div>
        </div>
        ${withDetails ? "" : stepsTrack(e)}
      </article>`;
  }

  // Uma opção do boletim (com rádio) ou só a apresentação (na revisão)
  function candidateOption(c, i, selectable = true, checked = false) {
    const info = [c.partido, ...elections.candidateInfo(c), c.descricao].filter(Boolean).join(" · ") || "Candidatura registada";
    return `
      <label${selectable ? "" : ' class="is-static"'}>
        <span class="avatar">${escapeHtml(initials(c.nome))}</span>
        <span>
          <small>OPÇÃO ${String(i + 1).padStart(2, "0")}</small>
          <b>${escapeHtml(c.nome)}</b>
          <small>${escapeHtml(info)}</small>
        </span>
        ${selectable ? `<input type="radio" name="candidate" value="${c.id}" required aria-label="${escapeHtml(c.nome)}"${checked ? " checked" : ""}>` : ""}
      </label>`;
  }

  const emptyCard = (titulo, texto, acao) =>
    `<article class="dash-card">${ui.empty(titulo, texto, acao)}</article>`;
  const verCalendario = { label: "Ver calendário eleitoral", href: "calendario.html" };

  // ===== Separador "Eleições": ativas em cima, concluídas em baixo =====
  const electionsPage = (ativas, concluidas) => `
    ${head("ELEIÇÕES ACADÉMICAS", "As suas eleições", "Consulte as eleições ativas, agendadas e anteriores.")}
    ${ativas.length ? ativas.map((e) => electionCard(e, true)).join("") : emptyCard("Sem eleições ativas", "Ainda não tem nenhuma eleição a decorrer em que possa votar.", verCalendario)}
    <article class="dash-card">
      <p class="eyebrow">HISTÓRICO</p>
      <h2>Eleições concluídas</h2>
      ${concluidas.length
      ? `<div class="history-rows">${concluidas
        .map(
          (e) => `
              <div><span class="year">${e.ano}</span><span><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(e.periodo)}</small></span>
              <span class="ok-label">${TV.icon("check")} ${e.votou ? "VOTOU" : "ENCERRADA"}</span></div>`
        )
        .join("")}</div>`
      : '<p class="muted">Ainda não existem eleições concluídas.</p>'}
    </article>`;

  const detailsPage = (e) => `
    ${head(`ELEIÇÃO · ${e.ano}`, escapeHtml(e.titulo), "Informação completa sobre o ato eleitoral.")}
    <article class="dash-card">
      ${statusLine(e)}
      <h2>Dados da eleição</h2>
      <label class="field-label">Período de votação<input value="${escapeHtml(e.periodo)}" readonly></label>
      <label class="field-label">Ronda<input value="${escapeHtml(e.voltaLabel)}" readonly></label>
      <label class="field-label">Candidaturas<input value="${escapeHtml(e.candidatosRonda.map((c) => c.nome).join(" · ") || "—")}" readonly></label>
      ${e.descricao ? `<p class="notice"><b>Sobre esta eleição</b>${escapeHtml(e.descricao)}</p>` : ""}
      <div class="form-actions" style="justify-content:flex-start">
        ${voteAction(e, `Abrir boletim digital ${TV.icon("arrow-right")}`)}
        <button class="link-button" type="button" data-back>${TV.icon("arrow-left")} Voltar às eleições</button>
      </div>
    </article>`;

  // ===== Separador "Ajuda": atalhos, perguntas frequentes com pesquisa e contacto =====
  // d = { e, config, fimSessao }
  // Um atalho: botão (data-go / data-vote) ou link, com ícone, título e uma frase
  const atalho = ({ icone, titulo, texto, attrs }) => `
    <${attrs.href ? "a" : "button type=\"button\""} class="help-shortcut" ${Object.entries(attrs).map(([k, val]) => `${k}="${escapeHtml(String(val))}"`).join(" ")}>
      <span class="help-shortcut-icon">${TV.icon(icone)}</span>
      <span><b>${titulo}</b><small>${texto}</small></span>
      <span class="help-shortcut-go">${TV.icon("arrow-right")}</span>
    </${attrs.href ? "a" : "button"}>`;

  const helpPage = ({ e, config, fimSessao }) => {
    // O primeiro atalho muda com a situação do eleitor
    const votar =
      e && e.aberta && !e.votou
        ? { icone: "vote", titulo: "Votar agora", texto: escapeHtml(e.titulo), attrs: { "data-vote": e.id } }
        : e && e.votou
          ? { icone: "circle-check", titulo: "O meu comprovativo", texto: "Já votou: veja e descarregue o comprovativo", attrs: { "data-go": "receipts" } }
          : { icone: "calendar", titulo: "As minhas eleições", texto: "Eleições a decorrer e agendadas", attrs: { "data-go": "elections" } };
    const sessao = [
      fimSessao ? `A sua sessão termina às <b>${fimSessao}</b>` : "",
      "se terminar a meio do voto, a opção marcada fica guardada",
      config ? `após ${config.login_tentativas} tentativas falhadas a conta fica bloqueada ${config.login_bloqueio_minutos} min` : "",
    ].filter(Boolean);
    return `
    ${head("APOIO AO ELEITOR", "Como podemos ajudar?", "Escolha um atalho ou procure a sua dúvida.")}

    <nav class="help-shortcuts" aria-label="Atalhos">
      ${atalho(votar)}
      ${atalho({ icone: "inbox", titulo: "Os meus recibos", texto: "Recibos e comprovativos do seu voto", attrs: { "data-go": "receipts" } })}
      ${atalho({ icone: "chart-column", titulo: "Resultados", texto: "Participação e resultados das eleições", attrs: { "data-go": "results" } })}
      ${atalho({ icone: "message-circle", titulo: "Falar com a comissão", texto: "Escreva-nos pelo formulário de contacto", attrs: { href: "ajuda.html#contactos" } })}
    </nav>

    <article class="dash-card help-faq">
      <div class="help-faq-head">
        <div><p class="eyebrow">PERGUNTAS FREQUENTES</p><h2>Dúvidas sobre a votação</h2></div>
        <label class="table-search help-search">${TV.icon("search")}<span class="sr-only">Procurar nas perguntas frequentes</span>
          <input type="search" placeholder="Procurar (ex.: recibo, palavra-passe)" autocomplete="off" data-help-search>
        </label>
      </div>
      <!-- As mesmas perguntas da página Ajuda, lidas de lá (controllers/eleitor/arranque.js) -->
      <div class="faq-list" data-help-faq>${ui.loading("A carregar as perguntas frequentes…")}</div>
      <p class="help-no-results" data-help-empty hidden>Nenhuma pergunta corresponde à pesquisa.
        <a href="ajuda.html#contactos">Pergunte diretamente à comissão eleitoral</a>.</p>
    </article>

    <p class="help-session">${TV.icon("lock")} <span>${sessao.join(" · ")}.</span></p>`;
  };

  Object.assign((TV.voterView = TV.voterView || {}), { electionCard, candidateOption, emptyCard, electionsPage, detailsPage, helpPage });
})();
