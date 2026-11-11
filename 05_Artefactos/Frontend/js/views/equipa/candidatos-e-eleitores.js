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
    <article class="dash-card" data-cand-table>${lista.length ? "" : ui.empty("Ainda não existem eleições", "Os candidatos são adicionados dentro de cada eleição.", { label: "Criar a primeira eleição", go: "elections" })}</article>`;

  const candidatesTable = (e) =>
    (e.candidatos || []).length
      ? `<div class="table-scroll"><table data-table="Pesquisar candidatos">
          <thead><tr><th>Opção</th><th>Candidato</th><th>Descrição</th><th>Estado</th></tr></thead>
          <tbody>${e.candidatos
        .map((c, i) => `<tr><td class="mono">${String(i + 1).padStart(2, "0")}</td><td><b>${escapeHtml(c.nome)}</b></td><td>${escapeHtml([c.partido, ...elections.candidateInfo(c), c.descricao].filter(Boolean).join(" · ") || "—")}</td><td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td></tr>`)
        .join("")}</tbody></table></div>
         <button class="button button-outline" type="button" data-manage>Gerir na eleição ${TV.icon("arrow-right")}</button>`
      : `${ui.empty("Sem candidatos nesta eleição")}<div class="state-box"><button class="button button-outline" type="button" data-manage>Adicionar candidatos ${TV.icon("arrow-right")}</button></div>`;

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
    <article class="dash-card" data-users></article>
    <article class="dash-card" data-enrolled></article>`;

  // ===== Lista oficial de inscritos (quem pode criar conta quando o registo está restrito) =====
  const enrolledCard = ({ restrito, estudantes }) => `
    <p class="eyebrow">LISTA OFICIAL</p>
    <h2>Estudantes inscritos · ${estudantes.length}</h2>
    <p class="notice"><b>${restrito ? "Registo restrito a esta lista." : "Registo aberto."}</b>${restrito
      ? "Só os números desta lista podem criar conta."
      : "Qualquer número pode criar conta. Para restringir, defina REGISTO_RESTRITO=true no servidor."}</p>
    ${estudantes.length
      ? `<div class="table-scroll"><table data-table="Pesquisar inscritos por número, nome ou curso">
          <thead><tr><th>Número</th><th>Nome</th><th>Curso</th><th>Conta</th><th></th></tr></thead>
          <tbody>${estudantes
        .map(
          (s) => `<tr><td class="mono">${escapeHtml(s.num_estudante)}</td><td>${escapeHtml(s.nome || "—")}</td><td>${escapeHtml(s.curso || "—")}</td>
            <td>${okLabel(s.registado ? "CRIADA" : "POR CRIAR", s.registado)}</td>
            <td><div class="row-actions"><button type="button" data-unenroll="${escapeHtml(s.num_estudante)}">Remover</button></div></td></tr>`
        )
        .join("")}</tbody></table></div>`
      : '<p class="muted">A lista está vazia.</p>'}
    <form class="inline-form" data-enroll-form>
      <label class="field-label">Acrescentar (uma linha por estudante: número;nome;curso)
        <textarea name="linhas" rows="4" required placeholder="20260001;Ana Silva;Design&#10;20260002"></textarea>
      </label>
      <p class="form-message" role="status"></p>
      <button class="button button-primary" type="submit">Acrescentar ${TV.icon("arrow-right")}</button>
    </form>`;

  // Botões para suspender/reativar e mudar o perfil (exceto na própria conta)
  const userActions = (u, eu) =>
    u.id === eu.id
      ? '<small class="muted" style="font-size:12px">A sua conta</small>'
      : `<button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ ativo: !u.ativo })}'>${u.ativo ? "Suspender" : "Reativar"}</button>
         <button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ perfil: u.perfil === "administrador" ? "eleitor" : "administrador" })}'>${u.perfil === "administrador" ? "Tornar eleitor" : "Tornar administrador"}</button>
         <button type="button" data-reset="${u.id}" data-nome="${escapeHtml(u.nome)}">Repor palavra-passe</button>`;

  const usersTable = (lista, eu) =>
    lista.length
      ? `<div class="table-scroll"><table data-table="Pesquisar por nome, e-mail ou número" data-table-key="utilizadores">
          <thead><tr><th>Número</th><th>Eleitor</th><th>Curso</th><th>Tipo</th><th>Estado</th><th>Ações</th></tr></thead>
          <tbody>${lista
        .map(
          (u) => `
              <tr>
                <td class="mono">${escapeHtml(voterNumber(u))}</td>
                <td><b>${escapeHtml(u.nome)}</b><br><small class="muted" style="font-size:12px">${escapeHtml(u.email)}</small></td>
                <td>${escapeHtml(u.curso || "—")}</td>
                <td>${u.perfil === "administrador" ? "Administrador" : "Credencial individual"}</td>
                <td>${okLabel(u.ativo ? "ATIVO" : "SUSPENSO", u.ativo)}</td>
                <td><div class="row-actions">${userActions(u, eu)}</div></td>
              </tr>`
        )
        .join("")}</tbody></table></div>`
      : ui.empty("Sem contas para este filtro");

  Object.assign((TV.teamView = TV.teamView || {}), { candidatesPage, candidatesTable, votersPage, usersTable, enrolledCard });
})();
