/* View · área da equipa, separadores "Candidatos" e "Eleitores": filtros e tabelas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, voterNumber } = TV.format;
  const { head, okLabel } = TV.blocks;

  // ===== Candidatos =====
  const candidatesPage = (lista) => `
    ${head("GESTÃO ELEITORAL", "Candidatos", "Listas e candidatos incluídos nas eleições académicas.", lista.length ? `<label class="field-label" style="margin:0;min-width:280px">Eleição<select data-cand-election>${lista.map((e) => `<option value="${e.id}">${escapeHtml(e.titulo)} · ${elections.statusLabels[e.estado]}</option>`).join("")}</select></label>` : "")}
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-cand-table>${lista.length ? "" : ui.empty("Ainda não existem eleições")}</article>`;

  const candidatesTable = (e) =>
    (e.candidatos || []).length
      ? `<div class="table-scroll rounded-xl"><table>
          <thead><tr><th>Opção</th><th>Candidato</th><th>Descrição</th><th>Estado</th></tr></thead>
          <tbody>${e.candidatos
        .map((c, i) => `<tr><td class="mono">${String(i + 1).padStart(2, "0")}</td><td><b>${escapeHtml(c.nome)}</b></td><td>${escapeHtml([c.partido, ...elections.candidateInfo(c), c.descricao].filter(Boolean).join(" · ") || "—")}</td><td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td></tr>`)
        .join("")}</tbody></table></div>
         <button class="button rounded-xl button-outline" type="button" data-manage>Gerir na eleição →</button>`
      : `${ui.empty("Sem candidatos nesta eleição")}<div class="state-box"><button class="button rounded-xl button-outline" type="button" data-manage>Adicionar candidatos →</button></div>`;

  // ===== Eleitores =====
  const votersPage = () => `
    ${head("ESTUDANTES", "Eleitores", "Estudantes inscritos com credencial eleitoral na plataforma.", `
      <label class="field-label" style="margin:0;min-width:220px">Perfil
        <select data-profile>
          <option value="">Todos</option>
          <option value="eleitor">Eleitores</option>
          <option value="administrador">Administradores</option>
        </select>
      </label>`)}
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-users></article>`;

  // Botões para suspender/reativar e mudar o perfil (exceto na própria conta)
  const userActions = (u, eu) =>
    u.id === eu.id
      ? '<small class="muted" style="font-size:11px">A sua conta</small>'
      : `<button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ ativo: !u.ativo })}'>${u.ativo ? "Suspender" : "Reativar"}</button>
         <button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ perfil: u.perfil === "administrador" ? "eleitor" : "administrador" })}'>${u.perfil === "administrador" ? "Tornar eleitor" : "Tornar administrador"}</button>`;

  const usersTable = (lista, eu) =>
    lista.length
      ? `<div class="table-scroll rounded-xl"><table>
          <thead><tr><th>Número</th><th>Eleitor</th><th>Curso</th><th>Tipo</th><th>2FA</th><th>Estado</th><th>Ações</th></tr></thead>
          <tbody>${lista
        .map(
          (u) => `
              <tr>
                <td class="mono">${escapeHtml(voterNumber(u))}</td>
                <td><b>${escapeHtml(u.nome)}</b><br><small class="muted" style="font-size:11px">${escapeHtml(u.email)}</small></td>
                <td>${escapeHtml(u.curso || "—")}</td>
                <td>${u.perfil === "administrador" ? "Administrador" : "Credencial individual"}</td>
                <td>${u.totp_ativo ? "Ativa" : "—"}</td>
                <td>${okLabel(u.ativo ? "ATIVO" : "SUSPENSO", u.ativo)}</td>
                <td><div class="row-actions">${userActions(u, eu)}</div></td>
              </tr>`
        )
        .join("")}</tbody></table></div>`
      : ui.empty("Sem contas para este filtro");

  Object.assign((TV.teamView = TV.teamView || {}), { candidatesPage, candidatesTable, votersPage, usersTable });
})();
