/* View · área do eleitor, separadores "Recibos" e "Definições" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, dateTime, time, voterNumber } = TV.format;
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

  // ===== Definições (acrescenta-se ao cartão de acessibilidade que já está no HTML) =====
  const settingsIntro = () => '<p class="muted" data-settings-extra>Gere os teus dados de contacto e preferências de segurança.</p>';

  const settingsCards = (user, claims) => `
    <div class="dash-grid grid-cols-1 lg:grid-cols-2" data-settings-extra>
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <p class="eyebrow">PERFIL ELEITORAL</p>
        <h2>Informação da conta</h2>
        <label class="field-label">Nome completo<input value="${escapeHtml(user.nome)}" readonly></label>
        <label class="field-label">E-mail da conta<input value="${escapeHtml(user.email)}" readonly></label>
        <label class="field-label">Número de eleitor<input value="${escapeHtml(voterNumber(user))}" readonly></label>
        <p class="muted" style="font-size:11px">Os dados eleitorais são geridos pela instituição.</p>
      </article>
      <div>
        ${TV.twoFactor.card(user)}
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          <p class="eyebrow">SESSÃO ATUAL</p>
          <h2>Sessão verificada</h2>
          <p>Iniciada às ${claims.iat ? time(new Date(claims.iat * 1000).toISOString()) : "—"} · termina às ${claims.exp ? time(new Date(claims.exp * 1000).toISOString()) : "—"}.</p>
          <button class="button rounded-xl button-outline" type="button" data-logout-settings>Terminar sessão →</button>
        </article>
      </div>
    </div>`;

  Object.assign(v, { receiptsPage, noReceipts, localNotice, receiptCard, verifyPill, verifyChecks, receiptText, settingsIntro, settingsCards });
})();
