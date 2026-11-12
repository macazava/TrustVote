/* View · área do eleitor: "Visão geral" e os três passos do boletim (escolher, rever, voto depositado) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime, voterNumber } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  // ===== Visão geral =====
  // d = { e, lista, recibos, votou, user, hoje, saudacao, subtitulo }

  // Eleição em destaque: o que fazer agora, quanto tempo falta e em que passo está
  const focusCard = (e) => `
    <article class="dash-card ov-focus ${e.votou ? "is-voted" : e.aberta ? "is-open" : ""}">
      <div class="ov-focus-main">
        <div class="el-item-top">${v.statusLine(e)}<span class="el-time">${v.timeInfo(e)}</span></div>
        <small class="ov-focus-kicker">${e.votou ? "VOTO REGISTADO" : e.aberta ? "A SUA PRÓXIMA AÇÃO" : "PRÓXIMA ELEIÇÃO"} · ${e.ano}</small>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p class="ov-focus-text">${e.votou
          ? "O seu voto já foi contado. Pode consultar o recibo e, quando a votação fechar, os resultados."
          : e.aberta
            ? `Tem ${e.candidatosRonda.length} candidaturas no boletim. Votar demora cerca de um minuto.`
            : "A votação ainda não abriu. Adicione as datas ao seu calendário para não se esquecer."}</p>
        ${v.periodBar(e)}
      </div>
      <div class="ov-focus-actions">
        ${v.voteAction(e, `Votar agora ${TV.icon("arrow-right")}`)}
        <button class="button button-outline" type="button" data-details="${e.id}">Ver detalhes</button>
        ${v.calendario(e)}
      </div>
      ${v.stepsTrack(e)}
    </article>`;

  // Atalhos com um número ou estado em cada um
  function shortcuts({ lista, recibos, votou }) {
    const abertas = lista.filter((x) => x.aberta && !x.votou).length;
    const encerradas = lista.filter((x) => x.estado === "encerrada").length;
    const documentos = recibos.length || lista.filter((x) => x.votou).length;
    return `
      <nav class="help-shortcuts ov-shortcuts" aria-label="Atalhos">
        ${v.atalho({ icone: "vote", titulo: "Eleições", texto: abertas ? `${abertas} à espera do seu voto` : "Nenhuma à espera do seu voto", attrs: { "data-go": "elections" } })}
        ${v.atalho({ icone: "inbox", titulo: "Recibos", texto: documentos ? `${documentos} ${documentos === 1 ? "documento" : "documentos"}` : votou ? "Comprovativo disponível" : "Disponível depois de votar", attrs: { "data-go": "receipts" } })}
        ${v.atalho({ icone: "chart-column", titulo: "Resultados", texto: encerradas ? `${encerradas} ${encerradas === 1 ? "eleição apurada" : "eleições apuradas"}` : "Publicados após o fecho", attrs: { "data-go": "results" } })}
        ${v.atalho({ icone: "message-circle", titulo: "Sondagem", texto: "Dê a sua opinião, de forma anónima", attrs: { "data-go": "poll" } })}
      </nav>`;
  }

  // Atividade: votos (data do servidor ou do recibo) e criação da conta, do mais recente para o mais antigo
  function activity({ lista, recibos, user }) {
    const itens = lista
      .filter((x) => x.votou)
      .map((x) => {
        const recibo = recibos.find((r) => r.eleicao_id === x.id);
        const data = (x.participacao && x.participacao.data) || (recibo && recibo.data);
        return { data, icone: "circle-check", titulo: `Votou em ${x.titulo}`, texto: recibo ? "Recibo guardado neste dispositivo" : "Comprovativo de participação disponível" };
      });
    if (user.data_registo) itens.push({ data: user.data_registo, icone: "user-check", titulo: "Conta de eleitor criada", texto: "Credencial verificada pela instituição" });
    itens.sort((a, b) => Date.parse(b.data || 0) - Date.parse(a.data || 0));
    return `
      <article class="dash-card">
        <div class="el-card-head"><div><h2>Atividade recente</h2></div></div>
        ${itens.length
          ? `<ol class="ov-activity">${itens.slice(0, 4).map((i) => `
              <li><span>${TV.icon(i.icone)}</span><div><b>${escapeHtml(i.titulo)}</b><small>${escapeHtml(i.texto)}</small></div><time>${i.data ? dateTime(i.data) : "—"}</time></li>`).join("")}</ol>`
          : '<p class="muted">Ainda não há atividade.</p>'}
        <button class="link-button" type="button" data-go="receipts">Ver os meus recibos ${TV.icon("arrow-right")}</button>
      </article>`;
  }

  const safety = () => `
    <article class="dash-card">
      <h2>Garantias</h2>
      <ul class="profile-list">
        <li class="is-yes">Voto secreto: ninguém sabe em quem votou</li>
        <li class="is-yes">Recibo para confirmar que o voto foi contado</li>
        <li class="is-no">Um voto por eleição: depois de confirmado não pode ser alterado</li>
      </ul>
      <button class="link-button" type="button" data-go="help">Dúvidas? Abrir a ajuda ${TV.icon("arrow-right")}</button>
    </article>`;

  const overviewPage = (d) => `
    ${head(d.hoje, `${d.saudacao}, ${escapeHtml(d.user.nome.split(" ")[0])}.`, d.subtitulo, `
      <div class="badge-card">
        <span class="ok-label">${TV.icon("check")}</span>
        <div><small>CREDENCIAL ELEITORAL · ${escapeHtml(voterNumber(d.user))}</small><b>${d.user.ativo === false ? "Suspensa" : "Verificada e válida"}</b></div>
        <i></i>
      </div>`)}

    ${d.e ? focusCard(d.e) : v.emptyCard("Sem eleições ativas", "As eleições em que pode votar aparecem aqui.", { label: "Ver calendário eleitoral", href: "calendario.html" })}

    ${shortcuts(d)}

    <div class="ov-columns">
      ${activity(d)}
      ${safety()}
    </div>`;

  // ===== Opção "voto em branco" (value="branco" no formulário) =====
  const blankOption = (selectable = true, checked = false) => `
    <label${selectable ? "" : ' class="is-static"'}>
      <span class="avatar" aria-hidden="true">—</span>
      <span>
        <small>OPÇÃO EM BRANCO</small>
        <b>Voto em branco</b>
        <small>Não escolhe nenhuma candidatura. Conta para a participação, não para os candidatos.</small>
      </span>
      ${selectable ? `<input type="radio" name="candidate" value="branco" required aria-label="Voto em branco"${checked ? " checked" : ""}>${v.ballotTick}` : ""}
    </label>`;

  // ===== Indicador de passos do boletim (1 Escolher · 2 Rever · 3 Depositar) =====
  const ballotSteps = (atual) => {
    const passos = ["Escolher", "Rever", "Depositar"];
    const passo = (nome, i) => {
      const n = i + 1;
      const estado = n < atual || atual === 3 ? "is-done" : n === atual ? "is-current" : "";
      return `<span class="${estado}"${n === atual ? ' aria-current="step"' : ""}><i>${estado === "is-done" ? TV.icon("check") : n}</i><b>${nome}</b></span>`;
    };
    return `<div class="steps-track ballot-steps" aria-label="Passo ${atual} de 3">${passos.map(passo).join("<hr>")}</div>`;
  };

  // ===== Boletim · passo 1: escolher =====
  const ballotPage = (e, escolhidoId) => `
    <article class="dash-card ballot">
      ${ballotSteps(1)}
      <p class="eyebrow">BOLETIM DIGITAL · PASSO 1 DE 3</p>
      <h1 tabindex="-1">Escolha uma candidatura</h1>
      <p class="muted">Selecione uma opção. Pode rever a escolha antes de a depositar.</p>
      <p class="notice"><b>${escapeHtml(e.titulo)}</b>${escapeHtml(e.descricao || e.voltaLabel)}</p>
      <form data-ballot>
        <div class="candidate-list">${e.candidatosRonda.map((c, i) => v.candidateOption(c, i, true, c.id === escolhidoId)).join("")}${blankOption(true, escolhidoId === "branco")}</div>
        <p class="form-message" role="status"></p>
        <div class="ballot-foot">
          <small>O seu voto é secreto</small>
          <button class="button button-primary" type="submit">Rever escolha ${TV.icon("arrow-right")}</button>
        </div>
      </form>
      <button class="link-button" type="button" data-back>${TV.icon("arrow-left")} Voltar às eleições</button>
    </article>`;

  // ===== Boletim · passo 2: rever (candidato = null é voto em branco) =====
  // O boletim aparece tal como vai ser depositado; o botão só fica ativo depois de confirmar
  const reviewPage = (e, candidato) => `
    <article class="dash-card ballot">
      ${ballotSteps(2)}
      <p class="eyebrow">BOLETIM DIGITAL · PASSO 2 DE 3</p>
      <h1 tabindex="-1">Confirme a sua escolha</h1>
      <p class="muted">Este é o boletim que vai entrar na urna. Depois de depositado, o voto não pode ser alterado.</p>
      <div class="ballot-paper">
        <header>
          <span class="ballot-paper-mark">${TV.icon("check")}</span>
          <div><small>BOLETIM DE VOTO · ${escapeHtml(e.voltaLabel || "1.ª volta").toUpperCase()}</small><b>${escapeHtml(e.titulo)}</b></div>
        </header>
        <div class="candidate-list">${candidato ? v.candidateOption(candidato, e.candidatosRonda.indexOf(candidato), false) : blankOption(false)}</div>
        <footer>${TV.icon("lock")} Antes de entrar na urna, o boletim é separado da sua identidade.</footer>
      </div>
      <label class="check-label ballot-confirm">
        <input type="checkbox" data-confirm>
        Confirmo que esta é a minha escolha e sei que não a posso alterar depois de depositar.
      </label>
      <p class="form-message" role="status" data-vote-message></p>
      <div class="ballot-foot">
        <button class="link-button" type="button" data-change>${TV.icon("arrow-left")} Alterar escolha</button>
        <button class="button button-primary" type="button" data-deposit disabled>Depositar voto ${TV.icon("arrow-right")}</button>
      </div>
    </article>`;

  // ===== Boletim · passo 3: voto depositado (recibo = null quando já tinha votado) =====
  // O selo entra com uma animação de carimbo (css/paginas/paineis/boletim.css)
  const donePage = (recibo) => `
    <article class="dash-card ballot ballot-done">
      ${ballotSteps(3)}
      <span class="seal-icon seal-stamp">${TV.icon("check")}</span>
      <p class="eyebrow">VOTO DEPOSITADO E SELADO</p>
      <h1 tabindex="-1">${recibo ? "O seu voto foi registado." : "Já votou nesta eleição."}</h1>
      <p class="muted">${recibo ? "Obrigado por participar. Guarde o recibo como comprovativo." : "Cada eleitor só pode votar uma vez por ronda."}</p>
      ${recibo ? `<div class="receipt-code"><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(recibo.recibo)}</b></div>
         <div class="ballot-done-actions">
           <button class="button button-outline" type="button" data-download-receipt>${TV.icon("download")} Descarregar recibo (PDF)</button>
           <button class="link-button" type="button" data-copy="${escapeHtml(recibo.recibo)}">${TV.icon("copy")} Copiar código</button>
         </div>
         ${v.receiptQr(recibo, true)}` : ""}
      <button class="button button-primary" type="button" data-go="receipts">Continuar para o recibo ${TV.icon("arrow-right")}</button>
    </article>`;

  Object.assign(v, { overviewPage, ballotPage, reviewPage, donePage });
})();
