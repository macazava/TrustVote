/* View · área do eleitor: "Visão geral" e os três passos do boletim (escolher, rever, voto depositado) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime, voterNumber } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  // ===== Visão geral =====
  // d = { e, recibos, user, hoje, saudacao, subtitulo }
  const overviewPage = ({ e, recibos, user, hoje, saudacao, subtitulo }) => `
    ${head(hoje, `${saudacao}, ${escapeHtml(user.nome.split(" ")[0])}.`, subtitulo, `
      <div class="badge-card">
        <span class="ok-label">${TV.icon("check")}</span>
        <div><small>CREDENCIAL ELEITORAL · ${escapeHtml(voterNumber(user))}</small><b>${user.ativo === false ? "Suspensa" : "Verificada e válida"}</b></div>
        <i></i>
      </div>`)}

    ${e ? v.electionCard(e, false) : v.emptyCard("Sem eleições ativas", "As eleições em que pode votar aparecem aqui.")}

    <div class="overview-grid grid-cols-1 xl:grid-cols-[2.1fr_1fr]">
      <article class="dash-card">
        <p class="eyebrow">O SEU VOTO</p>
        <h2>O que precisa de saber</h2>
        <ul class="check-list">
          <li><span class="check-box">${TV.icon("check")}</span><b>Voto secreto</b><small>Ninguém sabe em quem votou.</small><i>${TV.icon("check")}</i></li>
          <li><span class="check-box">${TV.icon("check")}</span><b>Um voto por eleição</b><small>Depois de confirmado, o voto não pode ser alterado.</small><i>${TV.icon("check")}</i></li>
        </ul>
      </article>
      <article class="dash-card">
        <p class="eyebrow">ATIVIDADE RECENTE</p>
        <h2>${recibos.length ? "O seu último voto" : "Ainda não votou"}</h2>
        ${recibos.length
      ? `<div class="receipt-code"><small>${escapeHtml(recibos[0].eleicao_titulo || "")} · ${dateTime(recibos[0].data)}</small><b>${escapeHtml(recibos[0].recibo)}</b></div>`
      : '<div class="empty-box">O recibo fica disponível depois de votar.</div>'}
        <button class="link-button" type="button" data-go="receipts">Como funciona o recibo? ${TV.icon("arrow-right")}</button>
      </article>
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
      ${selectable ? `<input type="radio" name="candidate" value="branco" required aria-label="Voto em branco"${checked ? " checked" : ""}>` : ""}
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
  const reviewPage = (e, candidato) => `
    <article class="dash-card ballot">
      ${ballotSteps(2)}
      <p class="eyebrow">BOLETIM DIGITAL · PASSO 2 DE 3</p>
      <h1 tabindex="-1">Confirme a sua escolha</h1>
      <p class="muted">Depois de depositado, o voto não pode ser alterado.</p>
      <div class="candidate-list">${candidato ? v.candidateOption(candidato, e.candidatosRonda.indexOf(candidato), false) : blankOption(false)}</div>
      <p class="form-message" role="status" data-vote-message></p>
      <div class="ballot-foot">
        <button class="link-button" type="button" data-change>${TV.icon("arrow-left")} Alterar escolha</button>
        <button class="button button-primary" type="button" data-deposit>Depositar voto ${TV.icon("arrow-right")}</button>
      </div>
    </article>`;

  // ===== Boletim · passo 3: voto depositado (recibo = null quando já tinha votado) =====
  const donePage = (recibo) => `
    <article class="dash-card ballot ballot-done">
      ${ballotSteps(3)}
      <span class="seal-icon">${TV.icon("check")}</span>
      <p class="eyebrow">VOTO DEPOSITADO</p>
      <h1 tabindex="-1">${recibo ? "O seu voto foi registado." : "Já votou nesta eleição."}</h1>
      <p class="muted">${recibo ? "Obrigado por participar. Guarde o recibo como comprovativo." : "Cada eleitor só pode votar uma vez por ronda."}</p>
      ${recibo ? `<div class="receipt-code"><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(recibo.recibo)}</b></div>
         <button class="link-button" type="button" data-copy="${escapeHtml(recibo.recibo)}">${TV.icon("copy")} Copiar código</button>` : ""}
      <button class="button button-primary" type="button" data-go="receipts">Continuar para o recibo ${TV.icon("arrow-right")}</button>
    </article>`;

  Object.assign(v, { overviewPage, ballotPage, reviewPage, donePage });
})();
