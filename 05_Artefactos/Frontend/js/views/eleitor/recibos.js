/* View · área do eleitor, separador "Recibos" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  // ===== Recibos =====
  const receiptsPage = () =>
    `${head("VERIFICAÇÃO INDIVIDUAL", "Os meus recibos", "Confirma que o teu voto foi incluído sem revelar a escolha.")}<div data-receipts></div>`;

  const noReceipts = () =>
    `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">${TV.ui.empty("Ainda não existem recibos", "O recibo é emitido quando depositas um voto.")}<div class="state-box"><button class="button rounded-xl button-outline" type="button" data-go="elections">Ver eleições →</button></div></article>`;

  const localNotice = () => '<p class="notice rounded-xl">A mostrar os recibos guardados neste dispositivo.</p>';

  const receiptCard = (r, i) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift receipt-card grid-cols-1 md:grid-cols-[auto_1fr_auto]">
      <span class="seal-icon">✓</span>
      <div>
        <span class="status-pill rounded-full status-plain" data-verify-status="${i}"><i></i> DEPOSITADO</span>
        <h2>${escapeHtml(r.eleicao_titulo || `Eleição #${r.eleicao_id}`)}</h2>
        <p>Depositado a ${dateTime(r.data)} · ${r.ronda === 2 ? "2.ª" : "1.ª"} volta.</p>
        <div class="receipt-code rounded-xl"><small>CÓDIGO DO RECIBO</small><b>${escapeHtml(r.recibo)}</b></div>
        <div class="receipt-checks" data-verify-checks="${i}"></div>
      </div>
      <div class="receipt-actions">
        <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-verify="${i}">Verificar</button>
        <button class="button rounded-xl button-outline" type="button" data-download="${i}">Descarregar recibo</button>
      </div>
    </article>`;

  // Resultado de "Verificar": etiqueta e lista de confirmações
  const verifyPill = (valido) => `<i></i> ${valido ? "INCLUÍDO E VERIFICADO" : "NÃO ENCONTRADO"}`;
  const verifyChecks = (resposta) =>
    resposta.valido ? `<span>✓ Voto registado</span><span>✓ Incluído na contagem</span><span>✓ ${resposta.ronda === 2 ? "2.ª" : "1.ª"} volta</span>` : "";

  // Texto do ficheiro "recibo-XXXX.txt"
  const receiptText = (r) =>
    [
      "TrustVote · Recibo de voto",
      `Eleição: ${r.eleicao_titulo || r.eleicao_id}`,
      `Ronda: ${r.ronda}`,
      `Data: ${dateTime(r.data)}`,
      `Recibo: ${r.recibo}`,
      r.hash ? `Hash: ${r.hash}` : "",
    ].filter(Boolean).join("\n");

  Object.assign(v, { receiptsPage, noReceipts, localNotice, receiptCard, verifyPill, verifyChecks, receiptText });
})();
