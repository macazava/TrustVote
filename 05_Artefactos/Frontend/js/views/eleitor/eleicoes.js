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

  // ===== Separador "Eleições": a decorrer e agendadas em cima, histórico em baixo =====
  const { dateTime, number, percent } = TV.format;
  const plural = (n, um, varios) => `${number(n)} ${n === 1 ? um : varios}`;
  const nomeVolta = (e) => (e.ronda ? (e.ronda.numero === 2 ? "2.ª volta" : "1.ª volta") : "Sem volta definida");

  // Quanto do período de votação já passou (0–100)
  const decorrido = (e) => {
    const ini = Date.parse(e.inicio);
    const fim = Date.parse(e.fim);
    if (!ini || !fim || fim <= ini) return 0;
    return Math.max(0, Math.min(100, ((Date.now() - ini) / (fim - ini)) * 100));
  };

  // Iniciais sobrepostas das candidaturas (até 4) e os nomes
  const candidatesStack = (lista) =>
    lista.length
      ? `<div class="el-candidates">
          <span class="el-avatars">${lista.slice(0, 4).map((c) => `<span class="avatar" title="${escapeHtml(c.nome)}">${escapeHtml(initials(c.nome))}</span>`).join("")}</span>
          <small>${escapeHtml(lista.map((c) => c.nome).join(" · "))}</small>
        </div>`
      : '<p class="muted">As candidaturas ainda não foram publicadas.</p>';

  // Período da votação: abertura, barra do tempo decorrido e encerramento
  const periodBar = (e) =>
    e.inicio && e.fim
      ? `<div class="el-period">
          <div><small>ABERTURA</small><b>${dateTime(e.inicio)}</b></div>
          <div class="el-period-bar" role="img" aria-label="${percent(decorrido(e))} do período decorrido"><i style="width:${decorrido(e)}%"></i></div>
          <div><small>ENCERRAMENTO</small><b>${dateTime(e.fim)}</b></div>
        </div>`
      : '<p class="muted">Datas por definir.</p>';

  const calendario = (e) =>
    !e.votou && (e.aberta || e.estado === "agendada")
      ? TV.blocks.calendarButton({ id: e.id, titulo: e.titulo, inicio: e.inicio, fim: e.fim, descricao: e.descricao })
      : "";

  const electionItem = (e) => `
    <article class="dash-card el-item ${e.votou ? "is-voted" : e.aberta ? "is-open" : ""}">
      <div class="el-item-main">
        <div class="el-item-top">${statusLine(e)}<span class="el-time">${timeInfo(e)}</span></div>
        <h2>${escapeHtml(e.titulo)}</h2>
        ${e.descricao ? `<p class="el-desc">${escapeHtml(e.descricao)}</p>` : ""}
        <ul class="el-meta">
          <li>${TV.icon("calendar")} ${nomeVolta(e)}</li>
          <li>${TV.icon("user-check")} ${plural(e.candidatosRonda.length, "candidatura", "candidaturas")}</li>
          ${e.votou ? `<li class="is-ok">${TV.icon("circle-check")} Já votou</li>` : ""}
        </ul>
        ${periodBar(e)}
        ${candidatesStack(e.candidatosRonda)}
      </div>
      <div class="el-item-actions">
        ${voteAction(e)}
        <button class="button button-outline" type="button" data-details="${e.id}">Ver detalhes</button>
        ${calendario(e)}
      </div>
    </article>`;

  const historyRow = (e) => `
    <li>
      <span class="year">${e.ano}</span>
      <div><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(e.periodo)}</small></div>
      <span class="el-history-state ${e.votou ? "is-ok" : ""}">${TV.icon(e.votou ? "circle-check" : "lock")} ${e.votou ? "Votou" : "Encerrada"}</span>
      <button class="link-button" type="button" data-go="results">Resultados ${TV.icon("arrow-right")}</button>
    </li>`;

  const electionsPage = (ativas, concluidas) => {
    const aDecorrer = ativas.filter((e) => e.estado === "em_curso").length;
    const agendadas = ativas.filter((e) => e.estado === "agendada").length;
    const porVotar = ativas.filter((e) => e.aberta && !e.votou).length;
    return `
    ${head("ELEIÇÕES ACADÉMICAS", "As suas eleições", "As eleições em que pode votar, as que estão para vir e as anteriores.")}
    <div class="el-summary">
      <div><b>${number(aDecorrer)}</b><small>a decorrer</small></div>
      <div class="${porVotar ? "is-highlight" : ""}"><b>${number(porVotar)}</b><small>à espera do seu voto</small></div>
      <div><b>${number(agendadas)}</b><small>${agendadas === 1 ? "agendada" : "agendadas"}</small></div>
      <div><b>${number(concluidas.length)}</b><small>${concluidas.length === 1 ? "concluída" : "concluídas"}</small></div>
    </div>

    <h2 class="el-section-title">A decorrer e agendadas</h2>
    ${ativas.length ? ativas.map(electionItem).join("") : emptyCard("Sem eleições ativas", "Ainda não tem nenhuma eleição a decorrer em que possa votar.", verCalendario)}

    <article class="dash-card el-history">
      <div class="el-card-head">
        <div><p class="eyebrow">HISTÓRICO</p><h2>Eleições concluídas</h2></div>
        <a class="link-button" href="historico.html">Histórico eleitoral completo ${TV.icon("arrow-up-right")}</a>
      </div>
      ${concluidas.length
        ? `<ol class="el-history-list">${concluidas.map(historyRow).join("")}</ol>`
        : '<p class="muted">Ainda não existem eleições concluídas.</p>'}
    </article>`;
  };

  // ===== Detalhes de uma eleição: candidaturas à esquerda, ficha e ação ao lado =====
  const candidateCard = (c, i) => {
    const info = elections.candidateInfo(c).filter(Boolean).join(" · ");
    return `
      <li>
        <span class="avatar">${escapeHtml(initials(c.nome))}</span>
        <div>
          <small>OPÇÃO ${String(i + 1).padStart(2, "0")}${c.partido ? ` · ${escapeHtml(c.partido)}` : ""}</small>
          <b>${escapeHtml(c.nome)}</b>
          ${info ? `<span>${escapeHtml(info)}</span>` : ""}
          ${c.descricao ? `<p>${escapeHtml(c.descricao)}</p>` : ""}
        </div>
      </li>`;
  };
  const ficha = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;

  const detailsPage = (e) => `
    <button class="link-button el-back" type="button" data-back>${TV.icon("arrow-left")} Voltar às eleições</button>
    ${head(`ELEIÇÃO · ${e.ano}`, escapeHtml(e.titulo), escapeHtml(e.descricao || "Informação completa sobre o ato eleitoral."))}
    <div class="el-details">
      <article class="dash-card el-details-main">
        <div class="el-card-head">
          <div><p class="eyebrow">BOLETIM · ${nomeVolta(e).toUpperCase()}</p><h2>Candidaturas</h2></div>
          <small class="muted">${plural(e.candidatosRonda.length, "opção", "opções")} + voto em branco</small>
        </div>
        ${e.candidatosRonda.length
          ? `<ol class="el-candidate-list">${e.candidatosRonda.map(candidateCard).join("")}</ol>`
          : '<p class="muted">As candidaturas ainda não foram publicadas.</p>'}
      </article>
      <aside class="el-details-aside">
        <article class="dash-card">
          <div class="el-item-top">${statusLine(e)}</div>
          <h2>Dados da eleição</h2>
          <dl class="el-sheet">
            ${ficha("Volta", nomeVolta(e))}
            ${ficha("Abertura", e.inicio ? dateTime(e.inicio) : "—")}
            ${ficha("Encerramento", e.fim ? dateTime(e.fim) : "—")}
            ${e.quorum ? ficha("Quórum", `${percent(e.quorum)} dos eleitores`) : ""}
            ${ficha("O seu voto", e.votou ? "Registado" : e.aberta ? "Por depositar" : "—")}
          </dl>
          ${(e.aberta && !e.votou) || e.estado === "agendada" ? `<p class="el-time">${timeInfo(e)}</p>` : ""}
          <div class="el-details-actions">
            ${voteAction(e, `Abrir boletim digital ${TV.icon("arrow-right")}`)}
            ${calendario(e)}
          </div>
        </article>
        <article class="dash-card">
          <p class="eyebrow">ANTES DE VOTAR</p>
          <h2>O que precisa de saber</h2>
          <ul class="profile-list">
            <li class="is-yes">Pode rever a escolha antes de confirmar</li>
            <li class="is-yes">Recebe um recibo para verificar que o voto foi contado</li>
            <li class="is-no">Depois de confirmado, o voto não pode ser alterado</li>
          </ul>
        </article>
      </aside>
    </div>`;

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

  Object.assign((TV.voterView = TV.voterView || {}), { candidateOption, emptyCard, electionsPage, detailsPage, helpPage, atalho, periodBar, stepsTrack, statusLine, timeInfo, voteAction, calendario });
})();
