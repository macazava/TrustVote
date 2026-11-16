/* View · área da equipa, separador "Auditoria": indicadores, verificação da cadeia e cronologia por dia,
   com pesquisa, filtro por tipo e detalhes de cada registo */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, number, plural, time } = TV.format;
  const { head } = TV.blocks;

  // Tipos de registo: nome no filtro e ícone na cronologia
  const tipos = {
    eleicao: ["Eleições", "vote"],
    ronda: ["Votação", "clock"],
    candidato: ["Candidatos", "user-check"],
    utilizador: ["Contas", "lock"],
    estudante_inscrito: ["Inscritos", "clipboard-list"],
  };

  const auditStats = (registos) => {
    const hoje = new Date().toDateString();
    const deHoje = registos.filter((r) => new Date(r.iso).toDateString() === hoje).length;
    const sistema = registos.filter((r) => r.sistema).length;
    const pessoas = new Set(registos.filter((r) => !r.sistema).map((r) => r.autor)).size;
    return `
      <div class="voter-stats">
        <div class="voter-stat is-brand"><b>${number(registos.length)}</b><span>Registos</span><small>os mais recentes</small></div>
        <div class="voter-stat"><b>${number(deHoje)}</b><span>Hoje</span><small>${deHoje ? "ações registadas" : "sem atividade"}</small></div>
        <div class="voter-stat"><b>${number(pessoas)}</b><span>Pessoas</span><small>fizeram alterações</small></div>
        <div class="voter-stat"><b>${number(sistema)}</b><span>Automáticas</span><small>feitas pelo sistema</small></div>
      </div>`;
  };

  const auditPage = (registos) => {
    const presentes = [...new Set(registos.map((r) => r.entidade).filter((e) => tipos[e]))];
    return `
      ${head("REGISTO DE ATIVIDADE", "Auditoria", "")}
      ${auditStats(registos)}
      <div data-chain-result>
        <div class="result-outcome chain-banner">
          <span class="result-outcome-icon">${TV.icon("shield-check")}</span>
          <div><b>Cadeia de registos</b><p>Confirme que nenhum registo foi alterado ou apagado.</p></div>
          <button class="button button-primary" type="button" data-verify-chain>Verificar agora</button>
        </div>
      </div>
      <article class="dash-card">
        <div class="card-head">
          <div><h2>Atividade</h2></div>
          <div class="row-actions">
            <button class="button button-light" type="button" data-refresh>Atualizar</button>
            <button class="button button-outline" type="button" data-csv>Exportar CSV</button>
          </div>
        </div>
        ${registos.length
          ? `<div class="people-toolbar">
              <label class="cand-search">${TV.icon("search")}<input type="search" placeholder="Pesquisar ação, eleição, pessoa ou IP" aria-label="Pesquisar no registo" data-audit-search></label>
              <div class="chip-row" role="group" aria-label="Filtrar por tipo">
                <button class="chip" type="button" data-audit-filter="" aria-pressed="true">Tudo</button>
                ${presentes.map((e) => `<button class="chip" type="button" data-audit-filter="${e}" aria-pressed="false">${tipos[e][0]}</button>`).join("")}
                <button class="chip" type="button" data-audit-filter="sistema" aria-pressed="false">Sistema</button>
              </div>
            </div>
            <div class="audit-timeline" data-audit-list></div>
            <div class="people-more" data-audit-more></div>`
          : ui.empty("Sem registos", "As ações feitas na área da equipa aparecem aqui.")}
      </article>`;
  };

  // Rótulo do dia: "Hoje", "Ontem" ou a data por extenso
  function dayLabel(iso) {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(Date.now() - 864e5);
    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    if (d.toDateString() === ontem.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  // Detalhes guardados com o registo (ex.: votos inválidos, número da volta)
  const detalhes = (r) => {
    const linhas = Object.entries(r.detalhes || {}).map(([k, v]) => `<div><dt>${escapeHtml(k.replace(/_/g, " "))}</dt><dd>${escapeHtml(typeof v === "object" ? JSON.stringify(v) : String(v))}</dd></div>`);
    return `
      <dl class="audit-details">
        ${linhas.join("")}
        <div><dt>data completa</dt><dd>${escapeHtml(r.completa)}</dd></div>
        <div><dt>IP</dt><dd class="mono">${escapeHtml(r.ip || "—")}</dd></div>
        <div><dt>hash</dt><dd class="mono audit-hash">${escapeHtml(r.hash || "—")}</dd></div>
      </dl>`;
  };

  const auditEntry = (r) => `
    <li class="audit-entry${r.sistema ? " is-system" : ""}">
      <span class="audit-icon" aria-hidden="true"></span>
      <details>
        <summary>
          <time class="audit-time" datetime="${escapeHtml(r.iso)}">${escapeHtml(time(r.iso))}</time>
          <span class="audit-text"><b>${escapeHtml(r.acao)}</b><span>${escapeHtml(r.sobre)}</span></span>
          <span class="audit-author${r.sistema ? " is-system" : ""}">${escapeHtml(r.autor)}</span>
        </summary>
        ${detalhes(r)}
      </details>
    </li>`;

  // Agrupa os registos por dia (já vêm do mais recente para o mais antigo)
  function auditTimeline(registos) {
    if (!registos.length) return `<p class="muted people-empty">${TV.icon("search")} Nenhum registo corresponde.</p>`;
    const grupos = [];
    registos.forEach((r) => {
      const dia = new Date(r.iso).toDateString();
      if (!grupos.length || grupos[grupos.length - 1].dia !== dia) grupos.push({ dia, iso: r.iso, itens: [] });
      grupos[grupos.length - 1].itens.push(r);
    });
    return grupos
      .map(
        (g) => `
        <section class="audit-day">
          <h3>${escapeHtml(dayLabel(g.iso))}<small>${plural(g.itens.length, "registo", "registos")}</small></h3>
          <ol>${g.itens.map(auditEntry).join("")}</ol>
        </section>`
      )
      .join("");
  }

  // Resultado de "Verificar cadeia": cada registo guarda o hash do anterior
  const chainResult = (v) => `
    <div class="result-outcome chain-banner ${v.valida ? "is-win" : "is-warn"}">
      <span class="result-outcome-icon">${TV.icon(v.valida ? "shield-check" : "circle-alert")}</span>
      <div>
        <b>${v.valida ? "Cadeia íntegra" : "Cadeia quebrada"}</b>
        <p>${v.valida
          ? `Os ${number(v.total)} registos estão completos e não foram alterados. Verificado às ${escapeHtml(time(new Date().toISOString()))}.`
          : `O registo #${escapeHtml(v.primeiro_invalido)} foi alterado, ou um registo anterior foi apagado.`}</p>
      </div>
      <button class="button button-light" type="button" data-verify-chain>Verificar outra vez</button>
    </div>`;

  Object.assign((TV.teamView = TV.teamView || {}), { auditPage, auditTimeline, chainResult });
})();
