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
      <div class="badge-card rounded-xl shadow-soft">
        <span class="ok-label">✓</span>
        <div><small>CREDENCIAL ELEITORAL · ${escapeHtml(voterNumber(user))}</small><b>${user.ativo === false ? "Suspensa" : "Verificada e válida"}</b></div>
        <i></i>
      </div>`)}

    ${e ? v.electionCard(e, false) : v.emptyCard("Sem eleições ativas", "Quando a equipa te habilitar numa eleição, ela aparece aqui.")}

    <div class="overview-grid grid-cols-1 xl:grid-cols-[2.1fr_1fr]">
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <p class="eyebrow">O TEU VOTO</p>
        <h2>O que precisas de saber</h2>
        <ul class="check-list">
          <li><span class="check-box rounded-lg">✓</span><b>Voto secreto</b><small>Ninguém sabe em quem votaste.</small><i>✓</i></li>
          <li><span class="check-box rounded-lg">✓</span><b>Um voto por eleição</b><small>Depois de confirmado, o voto não pode ser alterado.</small><i>✓</i></li>
          <li><span class="check-box rounded-lg">${user.totp_ativo ? "✓" : "!"}</span><b>Autenticação de dois fatores</b><small>${user.totp_ativo ? "Ativa nesta conta." : "Desativada — ativa nas Definições."}</small><i>${user.totp_ativo ? "✓" : "→"}</i></li>
        </ul>
      </article>
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <p class="eyebrow">ATIVIDADE RECENTE</p>
        <h2>${recibos.length ? "O teu último voto" : "Ainda não votaste"}</h2>
        ${recibos.length
          ? `<div class="receipt-code rounded-xl"><small>${escapeHtml(recibos[0].eleicao_titulo || "")} · ${dateTime(recibos[0].data)}</small><b>${escapeHtml(recibos[0].recibo)}</b></div>`
          : '<div class="empty-box rounded-xl">O recibo fica disponível depois de votares.</div>'}
        <button class="link-button" type="button" data-go="receipts">Como funciona o recibo? →</button>
      </article>
    </div>`;

  // ===== Boletim · passo 1: escolher =====
  const ballotPage = (e, escolhidoId) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift ballot">
      <p class="eyebrow">BOLETIM DIGITAL · PASSO 1 DE 3</p>
      <h1>Escolhe uma candidatura</h1>
      <p class="muted">Seleciona uma opção. Podes rever a escolha antes de a depositar.</p>
      <p class="notice rounded-xl"><b>${escapeHtml(e.titulo)}</b>${escapeHtml(e.descricao || e.voltaLabel)}</p>
      <form data-ballot>
        <div class="candidate-list">${e.candidatosRonda.map((c, i) => v.candidateOption(c, i, true, c.id === escolhidoId)).join("")}</div>
        <p class="form-message" role="status"></p>
        <div class="ballot-foot">
          <small>O teu voto é secreto</small>
          <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Rever escolha →</button>
        </div>
      </form>
      <button class="link-button" type="button" data-back>← Voltar às eleições</button>
    </article>`;

  // ===== Boletim · passo 2: rever =====
  const reviewPage = (e, candidato) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift ballot">
      <p class="eyebrow">BOLETIM DIGITAL · PASSO 2 DE 3</p>
      <h1>Confirma a tua escolha</h1>
      <p class="muted">Depois de depositado, o voto não pode ser alterado.</p>
      <div class="candidate-list">${v.candidateOption(candidato, e.candidatosRonda.indexOf(candidato), false)}</div>
      <p class="form-message" role="status" data-vote-message></p>
      <div class="ballot-foot">
        <button class="link-button" type="button" data-change>← Alterar escolha</button>
        <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-deposit>Depositar voto →</button>
      </div>
    </article>`;

  // ===== Boletim · passo 3: voto depositado (recibo = null quando já tinha votado) =====
  const donePage = (recibo) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift ballot ballot-done">
      <span class="seal-icon">✓</span>
      <p class="eyebrow">VOTO DEPOSITADO</p>
      <h1>${recibo ? "O teu voto foi registado." : "Já votaste nesta eleição."}</h1>
      <p class="muted">${recibo ? "Obrigado por participares. Guarda o recibo como comprovativo." : "Cada eleitor só pode votar uma vez por ronda."}</p>
      ${recibo ? `<div class="receipt-code rounded-xl"><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(recibo.recibo)}</b></div>` : ""}
      <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-go="receipts">Continuar para o recibo →</button>
    </article>`;

  Object.assign(v, { overviewPage, ballotPage, reviewPage, donePage });
})();
