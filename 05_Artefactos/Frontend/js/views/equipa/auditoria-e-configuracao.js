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
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      ${cardHead("HISTÓRICO DE AÇÕES", `Registos · ${number(registos.length)}`, '<div class="row-actions"><button type="button" data-refresh>Atualizar</button><button class="button rounded-xl button-light" type="button" data-csv>Exportar CSV</button></div>')}
      ${registos.length
      ? `<div class="table-scroll rounded-xl"><table>
            <thead><tr><th>Data e hora</th><th>Ação</th><th>Sobre</th><th>Feito por</th></tr></thead>
            <tbody>${registos
        .map((r) => `<tr><td class="mono">${escapeHtml(r.data)}</td><td><b>${escapeHtml(r.acao)}</b></td><td>${escapeHtml(r.sobre)}</td><td>${escapeHtml(r.autor)}</td></tr>`)
        .join("")}</tbody></table></div>`
      : ui.empty("Sem registos", "As ações feitas na área da equipa aparecem aqui.")}
    </article>`;

  // ===== Configuração: servidor, dois fatores e acessibilidade =====
  const settingsPage = ({ base, zona, offset, twoFactorCard }) => `
    ${head("CENTRO DE OPERAÇÕES", "Configuração", "Servidor, verificação em dois passos e preferências deste navegador.")}
    <div class="dash-grid grid-cols-1 lg:grid-cols-2">
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("CONFIGURAÇÃO ELEITORAL", "Parâmetros globais")}
        <label class="field-label">Endereço da API<input value="${escapeHtml(base)}" readonly></label>
        <label class="field-label">Fuso horário<input value="${escapeHtml(zona)} · UTC${offset >= 0 ? "+" : ""}${offset}:00" readonly></label>
      </article>
      <div>
        ${twoFactorCard}
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("ACESSIBILIDADE", "Preferências deste navegador")}
          <div class="toggle-row"><div><b>Texto maior</b><small>Aumenta o tamanho de todas as páginas.</small></div><button class="switch" type="button" data-pref="largeText"></button></div>
          <div class="toggle-row"><div><b>Contraste elevado</b><small>Cores com mais contraste.</small></div><button class="switch" type="button" data-pref="contrast"></button></div>
        </article>
      </div>
    </div>`;

  Object.assign((TV.teamView = TV.teamView || {}), { auditPage, settingsPage });
})();
