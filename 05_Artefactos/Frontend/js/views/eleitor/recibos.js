/* View · área do eleitor, separador "Recibos" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  // ===== Recibos =====
  const receiptsPage = () =>
    `${head("VERIFICAÇÃO INDIVIDUAL", "Os meus recibos", "Confirme que o seu voto foi incluído sem revelar a escolha.")}<div data-receipts></div>`;

  const noReceipts = () =>
    `<article class="dash-card">${TV.ui.empty("Ainda não existem recibos", "O recibo é emitido quando deposita um voto.")}<div class="state-box"><button class="button button-outline" type="button" data-go="elections">Ver eleições ${TV.icon("arrow-right")}</button></div></article>`;

  const localNotice = () =>
    '<p class="notice"><b>Recibos guardados neste dispositivo.</b>Para manter o voto secreto, o servidor não sabe que recibo é de quem: descarregue-os para não os perder.</p>';

  // QR code que abre a verificação pública deste recibo (aberto no fim do voto, fechado nos cartões)
  const receiptQr = (r, aberto = false) => {
    const url = TV.qr.verifyUrl(r.recibo);
    return `
      <details class="receipt-qr"${aberto ? " open" : ""}>
        <summary>${TV.icon("shield-check")} QR code de verificação</summary>
        <div>
          ${TV.qr.svg(url, `QR code para verificar o recibo ${r.recibo}`)}
          <p>Aponte a câmara do telemóvel para confirmar, na página pública, que este voto foi contado.</p>
        </div>
      </details>`;
  };

  const receiptCard = (r, i) => `
    <article class="dash-card receipt-card grid-cols-1 md:grid-cols-[auto_1fr_auto]">
      <span class="seal-icon">${TV.icon("check")}</span>
      <div>
        <span class="status-pill status-plain" data-verify-status="${i}"><i></i> DEPOSITADO</span>
        <h2>${escapeHtml(r.eleicao_titulo || `Eleição #${r.eleicao_id}`)}</h2>
        <p>Depositado a ${dateTime(r.data)} · ${r.ronda === 2 ? "2.ª" : "1.ª"} volta.</p>
        <div class="receipt-code"><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(r.recibo)}</b></div>
        <div class="receipt-checks" data-verify-checks="${i}"></div>
        ${receiptQr(r)}
      </div>
      <div class="receipt-actions">
        <button class="button button-primary" type="button" data-verify="${i}">Verificar</button>
        <button class="button button-outline" type="button" data-download="${i}">Descarregar recibo</button>
        <button class="link-button" type="button" data-copy="${escapeHtml(r.recibo)}">${TV.icon("copy")} Copiar código</button>
        <a class="link-button" href="verificar.html?codigo=${encodeURIComponent(r.recibo)}">${TV.icon("shield-check")} Página pública de verificação</a>
      </div>
    </article>`;

  // Resultado de "Verificar": etiqueta e lista de confirmações
  const verifyPill = (resposta) =>
    `<i></i> ${!resposta.valido ? "NÃO ENCONTRADO" : resposta.incluido ? "INCLUÍDO E VERIFICADO" : "VOTO ALTERADO"}`;
  const verifyChecks = (resposta) =>
    resposta.valido
      ? `<span>${TV.icon("check")} Voto registado</span><span>${resposta.incluido ? `${TV.icon("check")} Incluído na contagem` : `${TV.icon("circle-alert")} Selo de integridade inválido — contacte a comissão eleitoral`}</span><span>${TV.icon("check")} ${resposta.ronda === 2 ? "2.ª" : "1.ª"} volta</span>`
      : "";

  // Texto do ficheiro "recibo-XXXX.txt"
  const receiptText = (r) =>
    [
      "TrustVote · Recibo de voto",
      `Eleição: ${r.eleicao_titulo || r.eleicao_id}`,
      `Ronda: ${r.ronda}`,
      `Data: ${dateTime(r.data)}`,
      `Recibo: ${r.recibo}`,
      r.hash ? `Hash: ${r.hash}` : "",
      `Verificar: ${TV.qr.verifyUrl(r.recibo)}`,
    ].filter(Boolean).join("\n");

  Object.assign(v, { receiptQr, receiptsPage, noReceipts, localNotice, receiptCard, verifyPill, verifyChecks, receiptText });
})();
