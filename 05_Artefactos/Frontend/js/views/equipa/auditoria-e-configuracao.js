/* View · área da equipa, separadores "Auditoria" (registo de atividade) e "Configuração" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, number } = TV.format;
  const { head, cardHead } = TV.blocks;

  // ===== Auditoria: quem fez o quê e quando =====
  const auditPage = (registos) => `
    ${head("REGISTO DE ATIVIDADE", "Auditoria", "Cada alteração feita na área da equipa fica registada: o que foi feito, sobre o quê, por quem e quando.")}
    <article class="dash-card">
      ${cardHead("HISTÓRICO DE AÇÕES", `Registos · ${number(registos.length)}`, '<div class="row-actions"><button type="button" data-refresh>Atualizar</button><button type="button" data-verify-chain>Verificar cadeia</button><button class="button button-light" type="button" data-csv>Exportar CSV</button></div>')}
      <div data-chain-result></div>
      ${registos.length
      ? `<div class="table-scroll"><table>
            <thead><tr><th>Data e hora</th><th>Ação</th><th>Sobre</th><th>Feito por</th><th>IP</th></tr></thead>
            <tbody>${registos
        .map((r) => `<tr><td class="mono">${escapeHtml(r.data)}</td><td><b>${escapeHtml(r.acao)}</b></td><td>${escapeHtml(r.sobre)}</td><td>${escapeHtml(r.autor)}</td><td class="mono">${escapeHtml(r.ip || "—")}</td></tr>`)
        .join("")}</tbody></table></div>`
      : ui.empty("Sem registos", "As ações feitas na área da equipa aparecem aqui.")}
    </article>`;

  // Resultado de "Verificar cadeia": cada registo guarda o hash do anterior
  const chainResult = (v) =>
    `<p class="notice"><b>${v.valida ? `${TV.icon("circle-check")} Cadeia íntegra` : `${TV.icon("circle-alert")} Cadeia quebrada`}</b>${v.valida
      ? `Os ${number(v.total)} registos estão completos e não foram alterados.`
      : `O registo #${v.primeiro_invalido} foi alterado, ou um registo anterior foi apagado.`}</p>`;

  // ===== Configuração: servidor, palavra-passe e acessibilidade =====
  const settingsPage = ({ base, zona, offset, passwordCard }) => `
    ${head("CENTRO DE OPERAÇÕES", "Configuração", "Servidor, palavra-passe e preferências deste navegador.")}
    <div class="dash-grid grid-cols-1 lg:grid-cols-2">
      <article class="dash-card">
        ${cardHead("CONFIGURAÇÃO ELEITORAL", "Parâmetros globais")}
        <label class="field-label">Endereço da API<input value="${escapeHtml(base)}" readonly></label>
        <label class="field-label">Fuso horário<input value="${escapeHtml(zona)} · UTC${offset >= 0 ? "+" : ""}${offset}:00" readonly></label>
        <div data-server-params>${ui.loading("A ler a configuração do servidor…")}</div>
      </article>
      <div>
        ${passwordCard}
        <article class="dash-card">
          ${cardHead("ACESSIBILIDADE", "Preferências deste navegador")}
          <div class="toggle-row"><div><b>Texto maior</b><small>Aumenta o tamanho de todas as páginas.</small></div><button class="switch" type="button" data-pref="largeText" aria-label="Texto maior"></button></div>
          <div class="toggle-row"><div><b>Contraste elevado</b><small>Cores com mais contraste.</small></div><button class="switch" type="button" data-pref="contrast" aria-label="Contraste elevado"></button></div>
          <div class="toggle-row"><div><b>Modo escuro</b><small>Fundo escuro, mais confortável à noite. Sem escolha, segue o sistema.</small></div><button class="switch" type="button" data-theme-toggle aria-label="Modo escuro"></button></div>
        </article>
      </div>
    </div>`;

  // Valores reais da API (GET /publico/configuracao e /health)
  const campo = (rotulo, valor) => `<label class="field-label">${rotulo}<input value="${escapeHtml(valor)}" readonly></label>`;
  const serverParams = (c, saude) => `
    ${campo("Servidor que respondeu", saude ? `${saude.instance} · base de dados ${saude.database} · Redis ${saude.redis}` : "Sem resposta")}
    ${c
      ? `${campo("Duração da sessão", `${number(c.sessao_minutos)} minutos`)}
         ${campo("Limite de tentativas de login", `Bloqueio de ${number(c.login_bloqueio_minutos)} minutos após ${number(c.login_tentativas)} falhas`)}
         ${campo("Apuramento", c.apuramento === "worker" ? "Pelo worker, logo após o fecho (fila no Redis)" : "Imediato, no pedido de encerrar")}`
      : '<p class="form-message">Não foi possível ler a configuração do servidor.</p>'}`;

  Object.assign((TV.teamView = TV.teamView || {}), { auditPage, chainResult, settingsPage, serverParams });
})();
