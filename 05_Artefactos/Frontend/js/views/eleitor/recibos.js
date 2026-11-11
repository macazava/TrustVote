/* View · área do eleitor, separador "Recibos" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  // ===== Recibos =====
  const volta = (n) => (n === 2 ? "2.ª volta" : "1.ª volta");
  const titulo = (r) => escapeHtml(r.eleicao_titulo || `Eleição #${r.eleicao_id}`);

  // Página: os documentos à esquerda e, ao lado, o que é cada um e porque o voto continua secreto
  const receiptsPage = () => `
    ${head("VERIFICAÇÃO INDIVIDUAL", "Os meus recibos", "Os documentos que provam a sua participação, sem revelar a escolha.")}
    <div class="receipts-layout">
      <div class="receipts-main" data-receipts></div>
      <aside class="receipts-aside">
        <article class="dash-card">
          <p class="eyebrow">SOBRE OS DOCUMENTOS</p>
          <h2>O que cada um prova</h2>
          <dl class="receipts-kinds">
            <div><dt>${TV.icon("shield-check")} Recibo de voto</dt><dd>Emitido no momento do voto, com um código único. Serve para confirmar que o seu voto foi contado.</dd></div>
            <div><dt>${TV.icon("circle-check")} Comprovativo de participação</dt><dd>Confirma que votou numa eleição. Aparece quando o recibo foi guardado noutro navegador.</dd></div>
          </dl>
        </article>
        <article class="dash-card">
          <p class="eyebrow">PRIVACIDADE</p>
          <h2>O voto continua secreto</h2>
          <ul class="profile-list">
            <li class="is-no">Nenhum documento indica em quem votou</li>
            <li class="is-no">O servidor não sabe que recibo é de quem</li>
            <li class="is-yes">Os recibos ficam só neste dispositivo: descarregue-os em PDF</li>
          </ul>
        </article>
      </aside>
    </div>`;

  const noReceipts = () =>
    `<article class="dash-card">${TV.ui.empty("Ainda não existem recibos", "O recibo é emitido quando deposita um voto.", { label: "Ver eleições", go: "elections" })}</article>`;

  // Resumo por cima da lista: quantos documentos há e onde estão guardados
  const receiptsSummary = (nRecibos, nComprovativos) => `
    <div class="receipts-summary">
      <span>${TV.icon("inbox")} <b>${nRecibos}</b> ${nRecibos === 1 ? "recibo" : "recibos"} neste dispositivo</span>
      ${nComprovativos ? `<span>${TV.icon("circle-check")} <b>${nComprovativos}</b> ${nComprovativos === 1 ? "comprovativo" : "comprovativos"} de participação</span>` : ""}
    </div>`;

  // Linha de dados do documento (rótulo em cima, valor em baixo)
  const dado = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;

  // Votou, mas o recibo não está neste navegador (o servidor nunca guarda recibos):
  // mostra o comprovativo de participação que o servidor conhece — eleição, volta e data, sem a escolha
  const participationCard = (c, i) => `
    <article class="dash-card receipt-doc is-proof">
      <header class="receipt-doc-head">
        <span class="receipt-doc-icon">${TV.icon("circle-check")}</span>
        <div><small>COMPROVATIVO DE PARTICIPAÇÃO</small><h2>${titulo(c)}</h2></div>
        <span class="status-pill"><i></i> VOTO REGISTADO</span>
      </header>
      <dl class="receipt-doc-data">
        ${dado("Volta", volta(c.ronda))}
        ${dado("Data do voto", c.data ? dateTime(c.data) : "—")}
        ${dado("Escolha", "Não incluída")}
      </dl>
      <p class="receipt-doc-note">${TV.icon("info")} Confirma que votou nesta eleição, mas não indica em quem.</p>
      <footer class="receipt-doc-actions">
        <button class="button button-primary" type="button" data-proof="${i}">${TV.icon("download")} Descarregar comprovativo (PDF)</button>
      </footer>
    </article>`;

  // QR code que abre a verificação pública deste recibo (aberto no fim do voto, fechado nos cartões)
  const receiptQr = (r, aberto = false) => {
    const url = TV.qr.verifyUrl(r.recibo);
    return `
      <details class="receipt-qr"${aberto ? " open" : ""}>
        <summary>${TV.icon("shield-check")} QR code de verificação</summary>
        <div>
          ${TV.qr.svg(url, `QR code para verificar o recibo ${r.recibo}`)}
          <p>Leia este código com uma câmara para confirmar, na página pública, que este voto foi contado.</p>
        </div>
      </details>`;
  };

  const receiptCard = (r, i) => `
    <article class="dash-card receipt-doc">
      <header class="receipt-doc-head">
        <span class="receipt-doc-icon">${TV.icon("shield-check")}</span>
        <div><small>RECIBO DE VOTO</small><h2>${titulo(r)}</h2></div>
        <span class="status-pill status-plain" data-verify-status="${i}"><i></i> DEPOSITADO</span>
      </header>
      <dl class="receipt-doc-data">
        ${dado("Volta", volta(r.ronda))}
        ${dado("Data do voto", dateTime(r.data))}
        ${dado("Escolha", "Não incluída")}
      </dl>
      <div class="receipt-doc-code">
        <div><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(r.recibo)}</b></div>
        <button class="icon-button" type="button" data-copy="${escapeHtml(r.recibo)}" aria-label="Copiar código" title="Copiar código">${TV.icon("copy")}</button>
      </div>
      <div class="receipt-checks" data-verify-checks="${i}"></div>
      ${receiptQr(r)}
      <footer class="receipt-doc-actions">
        <button class="button button-primary" type="button" data-verify="${i}">${TV.icon("shield-check")} Verificar contagem</button>
        <button class="button button-outline" type="button" data-download="${i}">${TV.icon("download")} Descarregar recibo (PDF)</button>
        <a class="link-button" href="verificar.html?codigo=${encodeURIComponent(r.recibo)}">Página pública de verificação ${TV.icon("arrow-up-right")}</a>
      </footer>
    </article>`;

  // Resultado de "Verificar": etiqueta e lista de confirmações
  const verifyPill = (resposta) =>
    `<i></i> ${!resposta.valido ? "NÃO ENCONTRADO" : resposta.incluido ? "INCLUÍDO E VERIFICADO" : "VOTO ALTERADO"}`;
  const verifyChecks = (resposta) =>
    resposta.valido
      ? `<span>${TV.icon("check")} Voto registado</span><span>${resposta.incluido ? `${TV.icon("check")} Incluído na contagem` : `${TV.icon("circle-alert")} Selo de integridade inválido — contacte a comissão eleitoral`}</span><span>${TV.icon("check")} ${resposta.ronda === 2 ? "2.ª" : "1.ª"} volta</span>`
      : "";

  // O recibo descarregado é um PDF (js/views/recibo-pdf.js)
  Object.assign(v, { receiptQr, receiptsPage, noReceipts, receiptsSummary, participationCard, receiptCard, verifyPill, verifyChecks });
})();
