/* Área da equipa ligada ao backend */
document.addEventListener("DOMContentLoaded", async () => {
  const TV = window.TrustVote;
  const { api, session, ui, format, elections, twoFactor } = TV;
  const { escapeHtml, number, percent, dateTime, time, initials, voterNumber } = format;

  const wrap = document.querySelector(".dashboard-wrap");
  const panel = (name) => document.querySelector(`[data-panel="${name}"]`);
  const go = (view) => document.querySelector(`.panel-nav [data-view="${view}"]`)?.click();
  const attempt = (promise) => promise.then((data) => ({ data }), (error) => ({ error }));

  let user;
  try {
    user = await session.require("equipa");
  } catch (error) {
    wrap.classList.add("is-ready");
    document.querySelector(".dashboard-content").innerHTML = ui.error(error);
    document.querySelector("[data-retry]").addEventListener("click", () => window.location.reload());
    return;
  }

  // ===== Cabeçalho =====
  const exp = (session.claims() || {}).exp;
  document.querySelector("[data-session-chip]").textContent = exp ? `SESSÃO ATÉ ${time(new Date(exp * 1000).toISOString())}` : "SESSÃO SEGURA";
  document.querySelector("[data-user-chip]").innerHTML =
    `<span class="avatar">${escapeHtml(initials(user.nome))}</span><span><b>${escapeHtml(user.nome)}</b><small>ADMINISTRADOR</small></span>`;
  document.querySelector("[data-logout]").addEventListener("click", session.logout);
  document.querySelector(".dashboard-content").addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) go(target.dataset.go);
  });

  const head = (eyebrow, title, text = "", extra = "") => `
    <div class="page-head">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        ${text ? `<p class="muted">${text}</p>` : ""}
      </div>
      ${extra}
    </div>`;

  const cardHead = (eyebrow, title, extra = "") =>
    `<div class="card-head"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${extra}</div>`;

  const pill = (text, warn = false) => `<span class="status-pill rounded-full${warn ? " status-warn" : ""}"><i></i> ${escapeHtml(text)}</span>`;
  const okLabel = (text, ok = true) => `<span class="ok-label${ok ? "" : " is-off"}">${ok ? "✓" : "!"} ${escapeHtml(text)}</span>`;

  // ===== Exportação CSV (abre bem no Excel: separador ";" e BOM para os acentos) =====
  function downloadCsv(nome, cabecalho, linhas) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cabecalho, ...linhas].map((l) => l.map(cell).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    link.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const fullDate = (iso) => new Date(iso).toLocaleString("pt-PT");
  const slug = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ===== Gráficos =====
  // Barras horizontais: o comprimento é relativo ao maior valor, o texto mostra votos e percentagem
  function barChart(linhas, label) {
    const max = Math.max(1, ...linhas.map((l) => l.votos));
    return `
      <div class="bar-chart" role="img" aria-label="${escapeHtml(label)}">
        ${linhas
        .map(
          (l) => `
            <div class="bar-chart-row" title="${escapeHtml(`${l.nome} · ${number(l.votos)} votos (${percent(l.percentagem)})`)}">
              <span class="bar-chart-label"><b>${escapeHtml(l.nome)}</b>${l.detalhe ? `<small>${escapeHtml(l.detalhe)}</small>` : ""}</span>
              <span class="bar-chart-track"><i style="width:${(l.votos / max) * 100}%"></i></span>
              <span class="bar-chart-value"><b>${percent(l.percentagem)}</b><small>${number(l.votos)} votos</small></span>
            </div>`
        )
        .join("")}
      </div>`;
  }

  // Colunas: participação de cada eleição numa escala fixa de 0 a 100%
  function columnChart(colunas, label) {
    return `
      <div class="column-chart" role="img" aria-label="${escapeHtml(label)}">
        ${colunas
        .map(
          (c) => `
            <div class="column-chart-item" title="${escapeHtml(`${c.nome} · ${percent(c.valor)} (${c.detalhe})`)}">
              <b>${percent(c.valor)}</b>
              <span class="column-chart-track"><i style="height:${Math.min(100, c.valor || 0)}%"></i></span>
              <small>${escapeHtml(c.nome)}</small>
            </div>`
        )
        .join("")}
      </div>`;
  }

  // Junta os resultados de uma ronda com os dados dos candidatos (lista) e ordena do mais para o menos votado
  function resultRows(ronda, candidatos) {
    const lista = new Map((candidatos || []).map((c) => [c.id, c.partido]));
    return [...ronda.candidatos]
      .map((c) => ({ nome: c.nome, detalhe: lista.get(c.id) || "", votos: c.total_votos || 0, percentagem: c.percentagem || 0 }))
      .sort((a, b) => b.votos - a.votos);
  }

  // Soma os votos dos candidatos de cada lista
  function listRows(linhas) {
    const total = linhas.reduce((s, l) => s + l.votos, 0);
    const porLista = new Map();
    linhas.forEach((l) => porLista.set(l.detalhe || "Sem lista", (porLista.get(l.detalhe || "Sem lista") || 0) + l.votos));
    return [...porLista]
      .map(([nome, votos]) => ({ nome, votos, percentagem: total ? Math.round((votos / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.votos - a.votos);
  }

  // ===== Visão geral =====
  function lineChart(serie) {
    const w = 1000;
    const h = 260;
    const max = Math.max(1, ...serie.map((p) => p.votos));
    const x = (i) => 40 + (i / Math.max(1, serie.length - 1)) * (w - 60);
    const y = (v) => h - 30 - (v / max) * (h - 60);
    const d = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.votos).toFixed(1)}`).join(" ");
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<line x1="40" x2="${w - 20}" y1="${y(max * f)}" y2="${y(max * f)}"></line><text x="0" y="${y(max * f) + 3}">${number(Math.round(max * f))}</text>`)
      .join("");
    const labels = serie
      .filter((_, i) => i % Math.ceil(serie.length / 6) === 0 || i === serie.length - 1)
      .map((p) => `<text x="${x(serie.indexOf(p)) - 12}" y="${h - 8}">${time(p.hora)}</text>`)
      .join("");
    return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Votos ao longo do tempo">${grid}${labels}<path d="${d}"></path></svg>`;
  }

  async function renderOverview() {
    const el = panel("overview");
    const [eleicao, lista] = await Promise.all([elections.featured(), api.eleicoes.listar()]);
    const [stats, resultados] = eleicao
      ? await Promise.all([attempt(api.votacao.estatisticas(eleicao.id)), attempt(api.votacao.resultados(eleicao.id))])
      : [{ error: null }, { error: null }];
    const s = stats.data;
    const serie = (s && s.serie) || [];
    const ultimaHora = serie.length ? serie[serie.length - 1].votos : null;
    const emCurso = lista.filter((e) => e.estado === "em_curso").length;
    const encerradas = lista.filter((e) => e.estado === "encerrada").length;
    const rondaAtual = resultados.data && resultados.data[resultados.data.length - 1];
    const fim = eleicao && eleicao.fim ? Date.parse(eleicao.fim) - Date.now() : null;
    const restante = fim === null ? null : fim <= 0 ? "Terminada" : fim < 864e5 ? `${Math.ceil(fim / 36e5)} h` : `${Math.floor(fim / 864e5)} ${Math.floor(fim / 864e5) === 1 ? "dia" : "dias"}`;

    el.innerHTML = `
      ${head("CENTRO DE OPERAÇÕES", "Visão geral", "Acompanhe a participação e os resultados das eleições.", eleicao ? pill(eleicao.estadoLabel, !eleicao.aberta) : "")}
      <div class="admin-metrics grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
        <article class="metric-card rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span class="check-box rounded-lg">✓</span>
          <small>PARTICIPAÇÃO</small><em>${s ? percent(s.participacao) : ""}</em>
          <b>${s ? `${number(s.votantes)} <small style="font-size:11px">/ ${number(s.habilitados)}</small>` : "—"}</b>
          <div class="bar"><i style="width:${s ? Math.min(100, s.participacao) : 0}%"></i></div>
        </article>
        <article class="metric-card rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span class="check-box rounded-lg">✓</span>
          <small>VOTOS REGISTADOS</small><em>${eleicao ? escapeHtml(elections.statusLabels[eleicao.estado]) : ""}</em>
          <b>${s ? number(s.votantes) : "—"}</b>
          <span>${ultimaHora !== null ? `${number(ultimaHora)} na última hora` : escapeHtml(stats.error ? stats.error.message : "Sem eleição ativa")}</span>
        </article>
        <article class="metric-card rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span class="check-box rounded-lg">✓</span>
          <small>TEMPO RESTANTE</small><em>${eleicao ? escapeHtml(eleicao.voltaLabel.split(" · ")[0].toUpperCase()) : ""}</em>
          <b>${restante || "—"}</b>
          <span>${eleicao && eleicao.fim ? `Fecha a ${dateTime(eleicao.fim)}` : "Sem votação marcada"}</span>
        </article>
        <article class="metric-card rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span class="check-box rounded-lg">✓</span>
          <small>ELEIÇÕES</small><em>${number(lista.length)} NO TOTAL</em>
          <b>${number(emCurso)} <small style="font-size:11px">em curso</small></b>
          <span>${number(encerradas)} encerradas · ${number(lista.length - emCurso - encerradas)} em preparação</span>
        </article>
      </div>
      <div class="overview-grid grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("PARTICIPAÇÃO", "Votos ao longo do tempo", eleicao ? `<span class="model-tag rounded-lg">${escapeHtml(eleicao.titulo)}</span>` : "")}
          ${serie.length ? lineChart(serie) : `<div class="empty-box rounded-xl">${escapeHtml(stats.error ? stats.error.message : "Ainda não existem votos registados.")}</div>`}
        </article>
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("RESULTADOS PROVISÓRIOS", "Votos por candidato")}
          ${rondaAtual && rondaAtual.candidatos.length
        ? barChart(resultRows(rondaAtual, eleicao.candidatos).slice(0, 5), "Votos por candidato na eleição em curso")
        : `<div class="empty-box rounded-xl">${escapeHtml(resultados.error ? resultados.error.message : "Sem resultados por enquanto.")}</div>`
      }
          <button class="button rounded-xl button-outline" type="button" data-go="results">Ver todos os resultados →</button>
        </article>
      </div>`;
  }

  // ===== Eleições =====
  const transitions = {
    rascunho: ["agendar", "Agendada"],
    agendada: ["iniciar", "Em curso"],
    em_curso: ["encerrar", "Encerrada"],
  };

  async function renderElectionList() {
    const el = panel("elections");
    const lista = await api.eleicoes.listar();
    const detalhes = await Promise.all(lista.map((e) => api.eleicoes.detalhe(e.id).then(elections.view)));
    const stats = await Promise.all(detalhes.map((e) => (e.estado === "rascunho" ? { error: true } : attempt(api.votacao.estatisticas(e.id)))));

    el.innerHTML = `
      ${head("GESTÃO ELEITORAL", "Eleições", "Configure e acompanhe os atos eleitorais da plataforma.", '<button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-new>Nova eleição →</button>')}
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("GESTÃO ELEITORAL", "Eleições configuradas")}
        ${detalhes.length
        ? `<div class="election-rows">${detalhes
          .map(
            (e, i) => `
                  <div class="election-row rounded-2xl transition hover:shadow-soft${e.estado === "em_curso" ? "" : " is-muted"}">
                    <span class="round-mark">✓</span>
                    <div>
                      ${pill(e.estadoLabel, e.estado === "rascunho")}
                      <h3>${escapeHtml(e.titulo)}</h3>
                      <small>${escapeHtml(e.periodo)} · ${(e.candidatos || []).filter((c) => c.ativo).length} candidatos</small>
                    </div>
                    <div class="turnout"><b>${stats[i].data ? percent(stats[i].data.participacao) : "—"}</b><small>participação</small></div>
                    <button class="button rounded-xl button-outline" type="button" data-edit="${e.id}">${e.estado === "rascunho" ? "Configurar" : "Gerir"}</button>
                  </div>`
          )
          .join("")}</div>`
        : ui.empty("Ainda não existem eleições", "Crie a primeira eleição para começar.")
      }
      </article>`;

    el.querySelector("[data-new]").addEventListener("click", () => renderElectionForm(null));
    el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => renderElectionForm(Number(b.dataset.edit))));
  }

  async function renderElectionForm(id) {
    const el = panel("elections");
    el.innerHTML = ui.loading();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const e = id ? elections.view(await api.eleicoes.detalhe(id)) : null;
    const editavel = !e || ["rascunho", "agendada"].includes(e.estado);
    const r1 = e && (e.rondas || []).find((r) => r.numero === 1);
    const next = e && transitions[e.estado];
    const dis = editavel ? "" : " disabled";

    el.innerHTML = `
      ${head("GESTÃO ELEITORAL", e ? "Editar eleição" : "Criar eleição", e ? "Atualize a configuração do ato eleitoral." : "Configure um novo ato eleitoral na plataforma.")}
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("DADOS DA ELEIÇÃO", "Informação principal")}
        <form data-election-form>
          <label class="field-label">Título<input name="titulo" required maxlength="200" value="${escapeHtml(e ? e.titulo : "")}"${dis}></label>
          <label class="field-label">Estado
            <select name="estado"${e ? "" : " disabled"}>
              <option value="">${e ? elections.statusLabels[e.estado] : "Rascunho"} (atual)</option>
              ${next ? `<option value="${next[0]}">${next[1]}</option>` : ""}
            </select>
          </label>
          <label class="field-label">Início<input type="datetime-local" name="inicio" required value="${r1 ? elections.toLocalInput(r1.data_inicio) : ""}"${dis}></label>
          <label class="field-label">Fim<input type="datetime-local" name="fim" required value="${r1 ? elections.toLocalInput(r1.data_fim) : ""}"${dis}></label>
          <label class="field-label">Descrição<textarea name="descricao" rows="3"${dis}>${escapeHtml(e ? e.descricao || "" : "")}</textarea></label>
          <p class="form-message" role="status"></p>
          <div class="form-actions">
            ${e && e.estado === "rascunho" ? '<button class="button rounded-xl button-outline" type="button" data-remove>Apagar eleição</button>' : ""}
            <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">${e ? "Guardar alterações" : "Guardar eleição"}</button>
            <button class="button rounded-xl button-light" type="button" data-back>Cancelar</button>
          </div>
        </form>
      </article>
      ${e ? '<div data-candidates-card></div><div data-voters-card></div><div data-rounds-card></div>' : ""}`;

    el.querySelector("[data-back]").addEventListener("click", () => ui.mount(el, renderElectionList));

    const form = el.querySelector("[data-election-form]");
    const message = form.querySelector(".form-message");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dados = { titulo: form.titulo.value.trim(), descricao: form.descricao.value.trim() || null };
      const datas = { data_inicio: elections.fromLocalInput(form.inicio.value), data_fim: elections.fromLocalInput(form.fim.value) };
      if (editavel && Date.parse(datas.data_fim) <= Date.parse(datas.data_inicio)) return ui.message(message, "O fim tem de ser depois do início.");
      try {
        await ui.busy(form.querySelector('[type="submit"]'), "A guardar…", async () => {
          if (!e) {
            const nova = await api.eleicoes.criar(dados);
            await api.eleicoes.criarRonda(nova.id, datas);
            id = nova.id;
          } else {
            if (editavel) {
              await api.eleicoes.atualizar(e.id, dados);
              if (r1) await api.eleicoes.atualizarRonda(e.id, 1, datas);
              else await api.eleicoes.criarRonda(e.id, datas);
            }
            if (form.estado.value) await api.eleicoes.acao(e.id, form.estado.value);
          }
        });
        ui.toast(e ? "Eleição atualizada." : "Eleição criada. Adicione candidatos e eleitores.");
        renderElectionForm(id);
      } catch (error) {
        ui.message(message, error.message);
      }
    });

    el.querySelector("[data-remove]")?.addEventListener("click", async () => {
      if (!window.confirm("Apagar esta eleição? Esta ação não pode ser desfeita.")) return;
      try {
        await api.eleicoes.apagar(e.id);
        ui.toast("Eleição apagada.");
        ui.mount(el, renderElectionList);
      } catch (error) {
        ui.message(message, error.message);
      }
    });

    if (e) {
      renderCandidatesCard(e);
      renderVotersCard(e);
      renderRoundsCard(e);
    }
  }

  function renderCandidatesCard(e) {
    const box = panel("elections").querySelector("[data-candidates-card]");
    const rascunho = e.estado === "rascunho";
    box.innerHTML = `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("CANDIDATURAS", `Candidatos · ${(e.candidatos || []).length}`)}
        ${(e.candidatos || []).length
        ? `<div class="table-scroll rounded-xl"><table>
                <thead><tr><th>Opção</th><th>Candidato</th><th>Lista</th><th>Estado</th><th>Ações</th></tr></thead>
                <tbody>${e.candidatos
          .map(
            (c, i) => `
                    <tr>
                      <td class="mono">${String(i + 1).padStart(2, "0")}</td>
                      <td><b>${escapeHtml(c.nome)}</b><br><small class="muted" style="font-size:11px">${escapeHtml(c.descricao || "")}</small></td>
                      <td>${escapeHtml(c.partido || "—")}</td>
                      <td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td>
                      <td><div class="row-actions">
                        <button type="button" data-toggle="${c.id}" data-ativo="${c.ativo}">${c.ativo ? "Desativar" : "Ativar"}</button>
                        ${rascunho ? `<button type="button" data-remove-cand="${c.id}">Remover</button>` : ""}
                      </div></td>
                    </tr>`
          )
          .join("")}</tbody></table></div>`
        : '<p class="muted">Ainda não existem candidatos. São precisos pelo menos 2 para agendar.</p>'
      }
        ${rascunho
        ? `<form class="inline-form" data-cand-form>
                <label class="field-label">Nome<input name="nome" required maxlength="200"></label>
                <label class="field-label">Lista<input name="partido" maxlength="200"></label>
                <label class="field-label">Descrição<input name="descricao" maxlength="500"></label>
                <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Adicionar →</button>
              </form>`
        : '<p class="muted">Só é possível adicionar ou remover candidatos em rascunho.</p>'
      }
      </article>`;

    const reload = async () => renderCandidatesCard(elections.view(await api.eleicoes.detalhe(e.id)));

    box.querySelector("[data-cand-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      try {
        await ui.busy(f.querySelector("button"), "A adicionar…", () =>
          api.eleicoes.criarCandidato(e.id, {
            nome: f.nome.value.trim(),
            partido: f.partido.value.trim() || null,
            descricao: f.descricao.value.trim() || null,
          })
        );
        await reload();
      } catch (error) {
        ui.toast(error.message, true);
      }
    });
    box.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.eleicoes.atualizarCandidato(e.id, b.dataset.toggle, { ativo: b.dataset.ativo !== "true" });
          await reload();
        } catch (error) {
          ui.toast(error.message, true);
        }
      })
    );
    box.querySelectorAll("[data-remove-cand]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.eleicoes.apagarCandidato(e.id, b.dataset.removeCand);
          await reload();
        } catch (error) {
          ui.toast(error.message, true);
        }
      })
    );
  }

  async function renderVotersCard(e) {
    const box = panel("elections").querySelector("[data-voters-card]");
    await ui.mount(box, async () => {
      const [habilitados, todos] = await Promise.all([api.eleicoes.habilitados(e.id), api.utilizadores.listar("eleitor")]);
      const ids = new Set(habilitados.map((h) => h.utilizador_id));
      const livres = todos.filter((u) => !ids.has(u.id) && u.ativo);

      box.innerHTML = `
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead(
        "CADERNO ELEITORAL",
        `Eleitores habilitados · ${habilitados.length}`,
        `<div class="row-actions">${habilitados.length ? '<button type="button" data-voter-csv>Exportar CSV</button>' : ""}${livres.length ? `<button class="button rounded-xl button-outline" type="button" data-voter-all>Habilitar todos (${livres.length})</button>` : ""}</div>`
      )}
          ${habilitados.length
          ? `<div class="table-scroll rounded-xl voter-picker"><table>
                  <thead><tr><th>Eleitor</th><th>E-mail</th><th>Habilitado em</th><th></th></tr></thead>
                  <tbody>${habilitados
            .map(
              (h) => `
                      <tr><td><b>${escapeHtml(h.nome)}</b></td><td>${escapeHtml(h.email)}</td><td>${dateTime(h.data)}</td>
                      <td><div class="row-actions"><button type="button" data-unvoter="${h.utilizador_id}">Remover</button></div></td></tr>`
            )
            .join("")}</tbody></table></div>`
          : '<p class="muted">Nenhum eleitor habilitado. É preciso pelo menos 1 para agendar.</p>'
        }
          ${livres.length
          ? `<form class="inline-form" data-voter-form>
                  <label class="field-label">Habilitar eleitor
                    <select name="uid" required>
                      <option value="">Selecione um eleitor</option>
                      ${livres.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)} · ${escapeHtml(u.email)}</option>`).join("")}
                    </select>
                  </label>
                  <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Habilitar →</button>
                </form>`
          : ""
        }
        </article>`;

      const reload = () => renderVotersCard(e);
      // Caderno eleitoral: quem pode votar (não inclui votos)
      box.querySelector("[data-voter-csv]")?.addEventListener("click", () =>
        downloadCsv(`caderno-eleitoral-${slug(e.titulo)}`, ["Nome", "E-mail", "Habilitado em"], habilitados.map((h) => [h.nome, h.email, fullDate(h.data)]))
      );
      box.querySelector("[data-voter-all]")?.addEventListener("click", async (event) => {
        try {
          const r = await ui.busy(event.currentTarget, "A habilitar…", () => api.eleicoes.habilitar(e.id, livres.map((u) => u.id)));
          ui.toast(`${r.adicionados} eleitor(es) habilitado(s).`);
          reload();
        } catch (error) {
          ui.toast(error.message, true);
        }
      });
      box.querySelector("[data-voter-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await api.eleicoes.habilitar(e.id, [Number(event.currentTarget.uid.value)]);
          reload();
        } catch (error) {
          ui.toast(error.message, true);
        }
      });
      box.querySelectorAll("[data-unvoter]").forEach((b) =>
        b.addEventListener("click", async () => {
          try {
            await api.eleicoes.desabilitar(e.id, b.dataset.unvoter);
            reload();
          } catch (error) {
            ui.toast(error.message, true);
          }
        })
      );
    });
  }

  function renderRoundsCard(e) {
    const box = panel("elections").querySelector("[data-rounds-card]");
    const rondas = [...(e.rondas || [])].sort((a, b) => a.numero - b.numero);
    const podeSegunda = e.estado === "em_curso" && rondas.length === 1 && rondas[0].estado !== "aberta";
    const ativos = (e.candidatos || []).filter((c) => c.ativo);

    box.innerHTML = `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("CALENDÁRIO", "Rondas")}
        ${rondas.length
        ? `<div class="table-scroll rounded-xl"><table>
                <thead><tr><th>Ronda</th><th>Período</th><th>Estado</th><th>Ações</th></tr></thead>
                <tbody>${rondas
          .map(
            (r) => `
                    <tr><td>${r.numero === 2 ? "2.ª" : "1.ª"} volta</td><td>${escapeHtml(format.period(r.data_inicio, r.data_fim))}</td>
                    <td>${okLabel(r.estado.toUpperCase(), r.estado === "aberta")}</td>
                    <td><div class="row-actions">
                      ${e.estado === "em_curso" && r.estado === "aberta" ? `<button type="button" data-round="${r.numero}" data-round-action="encerrar">Encerrar ronda</button>` : ""}
                      ${e.estado === "em_curso" && r.estado === "agendada" ? `<button type="button" data-round="${r.numero}" data-round-action="abrir">Abrir ronda</button>` : ""}
                    </div></td></tr>`
          )
          .join("")}</tbody></table></div>`
        : '<p class="muted">Guarde as datas da eleição para criar a 1.ª volta.</p>'
      }
        ${podeSegunda
        ? `<form class="inline-form" data-second-round>
                <p class="muted">Criar 2.ª volta: escolha exatamente 2 candidatos.</p>
                ${ativos.map((c) => `<label class="radio-line rounded-xl transition hover:border-tv-accent"><input type="checkbox" name="cand" value="${c.id}"> ${escapeHtml(c.nome)}</label>`).join("")}
                <label class="field-label">Início<input type="datetime-local" name="inicio" required></label>
                <label class="field-label">Fim<input type="datetime-local" name="fim" required></label>
                <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Criar 2.ª volta →</button>
              </form>`
        : ""
      }
      </article>`;

    box.querySelectorAll("[data-round]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.eleicoes.acaoRonda(e.id, b.dataset.round, b.dataset.roundAction);
          renderElectionForm(e.id);
        } catch (error) {
          ui.toast(error.message, true);
        }
      })
    );
    box.querySelector("[data-second-round]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      const ids = [...f.querySelectorAll('[name="cand"]:checked')].map((i) => Number(i.value));
      if (ids.length !== 2) return ui.toast("Escolha exatamente 2 candidatos.", true);
      try {
        await api.eleicoes.criarRonda(e.id, {
          data_inicio: elections.fromLocalInput(f.inicio.value),
          data_fim: elections.fromLocalInput(f.fim.value),
          candidato_ids: ids,
        });
        ui.toast("2.ª volta criada.");
        renderElectionForm(e.id);
      } catch (error) {
        ui.toast(error.message, true);
      }
    });
  }

  // ===== Candidatos =====
  async function renderCandidates() {
    const el = panel("candidates");
    const lista = await api.eleicoes.listar();
    el.innerHTML = `
      ${head("GESTÃO ELEITORAL", "Candidatos", "Listas e candidatos incluídos nas eleições académicas.", lista.length ? `<label class="field-label" style="margin:0;min-width:280px">Eleição<select data-cand-election>${lista.map((e) => `<option value="${e.id}">${escapeHtml(e.titulo)} · ${elections.statusLabels[e.estado]}</option>`).join("")}</select></label>` : "")}
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-cand-table>${lista.length ? "" : ui.empty("Ainda não existem eleições")}</article>`;
    const select = el.querySelector("[data-cand-election]");
    if (!select) return;
    const table = el.querySelector("[data-cand-table]");
    const load = () =>
      ui.mount(table, async () => {
        const e = await api.eleicoes.detalhe(select.value);
        table.innerHTML = (e.candidatos || []).length
          ? `<div class="table-scroll rounded-xl"><table>
              <thead><tr><th>Opção</th><th>Candidato</th><th>Descrição</th><th>Estado</th></tr></thead>
              <tbody>${e.candidatos
            .map((c, i) => `<tr><td class="mono">${String(i + 1).padStart(2, "0")}</td><td><b>${escapeHtml(c.nome)}</b></td><td>${escapeHtml([c.partido, c.descricao].filter(Boolean).join(" · ") || "—")}</td><td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td></tr>`)
            .join("")}</tbody></table></div>
             <button class="button rounded-xl button-outline" type="button" data-manage>Gerir na eleição →</button>`
          : `${ui.empty("Sem candidatos nesta eleição")}<div class="state-box"><button class="button rounded-xl button-outline" type="button" data-manage>Adicionar candidatos →</button></div>`;
        table.querySelector("[data-manage]").addEventListener("click", () => {
          go("elections");
          renderElectionForm(Number(select.value));
        });
      });
    select.addEventListener("change", load);
    load();
  }

  // ===== Eleitores =====
  async function renderVoters() {
    const el = panel("voters");
    el.innerHTML = `
      ${head("ESTUDANTES", "Eleitores", "Estudantes inscritos com credencial eleitoral na plataforma.", `
        <label class="field-label" style="margin:0;min-width:220px">Perfil
          <select data-profile>
            <option value="">Todos</option>
            <option value="eleitor">Eleitores</option>
            <option value="administrador">Administradores</option>
          </select>
        </label>`)}
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-users></article>`;
    const select = el.querySelector("[data-profile]");
    const box = el.querySelector("[data-users]");
    const load = () =>
      ui.mount(box, async () => {
        const lista = await api.utilizadores.listar(select.value || undefined);
        box.innerHTML = lista.length
          ? `<div class="table-scroll rounded-xl"><table>
              <thead><tr><th>Número</th><th>Eleitor</th><th>Tipo</th><th>2FA</th><th>Estado</th><th>Ações</th></tr></thead>
              <tbody>${lista
            .map(
              (u) => `
                  <tr>
                    <td class="mono">${escapeHtml(voterNumber(u))}</td>
                    <td><b>${escapeHtml(u.nome)}</b><br><small class="muted" style="font-size:11px">${escapeHtml(u.email)}</small></td>
                    <td>${u.perfil === "administrador" ? "Administrador" : "Credencial individual"}</td>
                    <td>${u.totp_ativo ? "Ativa" : "—"}</td>
                    <td>${okLabel(u.ativo ? "ATIVO" : "SUSPENSO", u.ativo)}</td>
                    <td><div class="row-actions">${u.id === user.id
                  ? '<small class="muted" style="font-size:11px">A sua conta</small>'
                  : `<button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ ativo: !u.ativo })}'>${u.ativo ? "Suspender" : "Reativar"}</button>
                           <button type="button" data-user="${u.id}" data-patch='${JSON.stringify({ perfil: u.perfil === "administrador" ? "eleitor" : "administrador" })}'>${u.perfil === "administrador" ? "Tornar eleitor" : "Tornar administrador"}</button>`
                }</div></td>
                  </tr>`
            )
            .join("")}</tbody></table></div>`
          : ui.empty("Sem contas para este filtro");
        box.querySelectorAll("[data-user]").forEach((b) =>
          b.addEventListener("click", async () => {
            try {
              await ui.busy(b, "…", () => api.utilizadores.atualizar(b.dataset.user, JSON.parse(b.dataset.patch)));
              ui.toast("Conta atualizada.");
              load();
            } catch (error) {
              ui.toast(error.message, true);
            }
          })
        );
      });
    select.addEventListener("change", load);
    load();
  }

  // ===== Resultados =====
  async function renderResults() {
    const el = panel("results");
    const lista = await api.eleicoes.listar();
    const aDecorrer = lista.filter((e) => e.estado === "em_curso");
    const anteriores = lista.filter((e) => e.estado === "encerrada");
    const [detalhes, estatisticas, resultados] = await Promise.all([
      Promise.all([...aDecorrer, ...anteriores].map((e) => api.eleicoes.detalhe(e.id).then(elections.view))),
      Promise.all([...aDecorrer, ...anteriores].map((e) => attempt(api.votacao.estatisticas(e.id)))),
      Promise.all([...aDecorrer, ...anteriores].map((e) => attempt(api.votacao.resultados(e.id)))),
    ]);
    const dados = detalhes.map((e, i) => ({ e, stats: estatisticas[i].data, rondas: resultados[i].data || [], erro: resultados[i].error }));
    const atuais = dados.slice(0, aDecorrer.length);
    const historico = dados.slice(aDecorrer.length).sort((a, b) => Date.parse(a.e.inicio || a.e.data_criacao) - Date.parse(b.e.inicio || b.e.data_criacao));

    // Cartão de uma eleição: votos por candidato e por lista, em cada volta
    const electionCard = ({ e, stats, rondas, erro }, provisorio) => `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead(
      `${provisorio ? "RESULTADOS PROVISÓRIOS" : "RESULTADOS FINAIS"} · ${e.ano} · ${escapeHtml(e.periodo)}`,
      escapeHtml(e.titulo),
      `<div class="row-actions">${stats ? `<span class="model-tag rounded-lg">Participação ${percent(stats.participacao)} · ${number(stats.votantes)} / ${number(stats.habilitados)}</span>` : ""}${rondas.length ? `<button type="button" data-export="${e.id}">Exportar CSV</button>` : ""}</div>`
    )}
        ${rondas.length
        ? rondas
          .map((r) => {
            const linhas = resultRows(r, e.candidatos);
            const listas = listRows(linhas);
            return `
                    ${rondas.length > 1 ? `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>` : ""}
                    <div class="results-split grid-cols-1 lg:grid-cols-2">
                      <div><h3>Votos por candidato</h3>${barChart(linhas, `Votos por candidato · ${e.titulo}`)}</div>
                      ${listas.length > 1 && listas.length < linhas.length ? `<div><h3>Votos por lista</h3>${barChart(listas, `Votos por lista · ${e.titulo}`)}</div>` : ""}
                    </div>`;
          })
          .join("")
        : `<div class="empty-box rounded-xl">${escapeHtml(erro ? erro.message : "Ainda não existem votos.")}</div>`
      }
      </article>`;

    el.innerHTML = `
      ${head("APURAMENTO", "Resultados", "Votos por candidato e por lista, na eleição a decorrer e nas eleições anteriores.")}
      <h2 class="results-section-title">A decorrer</h2>
      ${atuais.length
        ? atuais.map((d) => electionCard(d, true)).join("")
        : `<article class="dash-card rounded-2xl shadow-soft">${ui.empty("Nenhuma eleição a decorrer", "Os resultados provisórios aparecem quando uma votação abre.")}</article>`
      }
      <h2 class="results-section-title">Histórico</h2>
      ${historico.length
        ? `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
              ${cardHead("COMPARAÇÃO", "Participação por eleição")}
              ${columnChart(
          historico.map(({ e, stats }) => ({
            nome: e.titulo,
            valor: stats ? stats.participacao : 0,
            detalhe: stats ? `${number(stats.votantes)} de ${number(stats.habilitados)} votaram` : "sem dados",
          })),
          "Participação em cada eleição encerrada"
        )}
            </article>
            ${historico.slice().reverse().map((d) => electionCard(d, false)).join("")}`
        : `<article class="dash-card rounded-2xl shadow-soft">${ui.empty("Ainda não há eleições encerradas")}</article>`
      }`;

    // Relatório de resultados: uma linha por candidato e por volta
    el.querySelectorAll("[data-export]").forEach((b) =>
      b.addEventListener("click", () => {
        const { e, stats, rondas } = dados.find((d) => d.e.id === Number(b.dataset.export));
        const linhas = rondas.flatMap((r) =>
          resultRows(r, e.candidatos).map((l) => [e.titulo, `${r.ronda}.ª volta`, l.nome, l.detalhe, l.votos, percent(l.percentagem)])
        );
        if (stats) linhas.push([], ["Participação", "", "", "", `${stats.votantes} de ${stats.habilitados}`, percent(stats.participacao)]);
        downloadCsv(`resultados-${slug(e.titulo)}`, ["Eleição", "Volta", "Candidato", "Lista", "Votos", "Percentagem"], linhas);
      })
    );
  }

  // ===== Auditoria: registo de quem fez o quê e quando =====
  let registos = [];
  const nomesEntidade = { eleicao: "Eleição", candidato: "Candidato", utilizador: "Conta", ronda: "Votação" };

  async function renderAudit() {
    const el = panel("audit");
    const [lista, utilizadores, eleicoes] = await Promise.all([api.auditoria.listar(200), attempt(api.utilizadores.listar()), attempt(api.eleicoes.listar())]);
    const nomes = new Map((utilizadores.data || []).map((u) => [u.id, u.nome]));
    const titulos = new Map((eleicoes.data || []).map((e) => [e.id, e.titulo]));
    const sobre = (r) =>
      r.entidade === "eleicao" && titulos.has(r.entidade_id)
        ? titulos.get(r.entidade_id)
        : r.entidade === "utilizador" && nomes.has(r.entidade_id)
          ? nomes.get(r.entidade_id)
          : [nomesEntidade[r.entidade] || r.entidade, r.entidade_id && `#${r.entidade_id}`].filter(Boolean).join(" ") || "—";
    const autor = (r) => (r.utilizador_id ? nomes.get(r.utilizador_id) || `Utilizador #${r.utilizador_id}` : "Sistema");
    registos = lista.map((r) => ({ data: dateTime(r.data), completa: fullDate(r.data), acao: r.acao, sobre: sobre(r), autor: autor(r) }));

    el.innerHTML = `
      ${head("REGISTO DE ATIVIDADE", "Auditoria", "Cada alteração feita na área da equipa fica registada: o que foi feito, sobre o quê, por quem e quando.")}
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead("HISTÓRICO DE AÇÕES", `Registos · ${number(registos.length)}`, '<div class="row-actions"><button type="button" data-refresh>Atualizar</button><button class="button rounded-xl button-light" type="button" data-csv>Exportar CSV</button></div>')}
        ${registos.length
        ? `<div class="table-scroll rounded-xl"><table>
                <thead><tr><th>Data e hora</th><th>Ação</th><th>Sobre</th><th>Feito por</th></tr></thead>
                <tbody>${registos
          .map((r) => `<tr><td class="mono">${escapeHtml(r.data)}</td><td><b>${escapeHtml(r.acao)}</b></td><td>${escapeHtml(r.sobre)}</td><td>${escapeHtml(r.autor)}</td></tr>`)
          .join("")}</tbody></table></div>`
        : ui.empty("Sem registos", "As ações feitas na área da equipa aparecem aqui.")
      }
      </article>`;
    el.querySelector("[data-refresh]").addEventListener("click", () => ui.mount(el, renderAudit));
    el.querySelector("[data-csv]").addEventListener("click", () =>
      downloadCsv("auditoria", ["Data e hora", "Ação", "Sobre", "Feito por"], registos.map((r) => [r.completa, r.acao, r.sobre, r.autor]))
    );
  }

  // ===== Configuração =====
  function renderSettings() {
    const el = panel("settings");
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    el.innerHTML = `
      ${head("CENTRO DE OPERAÇÕES", "Configuração", "Ligação ao servidor, verificação em dois passos e preferências deste navegador.")}
      <div class="dash-grid grid-cols-1 lg:grid-cols-2">
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("CONFIGURAÇÃO ELEITORAL", "Parâmetros globais")}
          <form data-api-form>
            <label class="field-label">Endereço da API<input name="base" type="url" required value="${escapeHtml(TV.base)}"></label>
            <label class="field-label">Fuso horário<input value="${escapeHtml(zona)} · UTC${offset >= 0 ? "+" : ""}${offset}:00" readonly></label>
            <label class="field-label">Algoritmo de assinatura dos tokens<input value="RS256 · sessão de 30 minutos" readonly></label>
            <p class="form-message" role="status"></p>
            <div class="form-actions" style="justify-content:flex-start">
              <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Testar e guardar</button>
              <button class="link-button" type="button" data-default>Repor ${escapeHtml(TV.DEFAULT_BASE)}</button>
            </div>
          </form>
        </article>
        <div>
          ${twoFactor.card(session.user)}
          <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
            ${cardHead("ACESSIBILIDADE", "Preferências deste navegador")}
            <div class="toggle-row"><div><b>Texto maior</b><small>Aumenta o tamanho de todas as páginas.</small></div><button class="switch" type="button" data-pref="largeText"></button></div>
            <div class="toggle-row"><div><b>Contraste elevado</b><small>Cores com mais contraste.</small></div><button class="switch" type="button" data-pref="contrast"></button></div>
          </article>
        </div>
      </div>`;

    const PREFS = "trustvote:preferencias";
    const read = () => {
      try {
        return JSON.parse(localStorage.getItem(PREFS) || "{}");
      } catch {
        return {};
      }
    };
    const paint = () =>
      el.querySelectorAll("[data-pref]").forEach((b) => b.setAttribute("aria-pressed", String(!!read()[b.dataset.pref])));
    el.querySelectorAll("[data-pref]").forEach((b) =>
      b.addEventListener("click", () => {
        const prefs = { ...read(), [b.dataset.pref]: !read()[b.dataset.pref] };
        try {
          localStorage.setItem(PREFS, JSON.stringify(prefs));
        } catch { }
        document.body.classList.toggle("large-text", !!prefs.largeText);
        document.body.classList.toggle("high-contrast", !!prefs.contrast);
        paint();
      })
    );
    paint();

    const form = el.querySelector("[data-api-form]");
    const message = form.querySelector(".form-message");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const anterior = TV.base;
      TV.setBase(form.base.value);
      try {
        const res = await ui.busy(form.querySelector('[type="submit"]'), "A testar…", () => api.health());
        if (!res.ok) throw new Error(`O servidor respondeu com erro ${res.status}.`);
        ui.message(message, `Ligação guardada · ${res.latency} ms.`, true);
      } catch (error) {
        TV.setBase(anterior);
        ui.message(message, error.message);
      }
    });
    el.querySelector("[data-default]").addEventListener("click", () => {
      form.base.value = TV.DEFAULT_BASE;
    });
    twoFactor.wire(el, renderSettings);
  }

  // ===== Arranque =====
  wrap.classList.add("is-ready");
  renderSettings();

  const loaders = {
    overview: renderOverview,
    elections: renderElectionList,
    candidates: renderCandidates,
    voters: renderVoters,
    results: renderResults,
    audit: renderAudit,
  };
  Object.entries(loaders).forEach(([name, load]) => ui.mount(panel(name), load));

  // Volta a carregar a vista quando é aberta no menu
  document.querySelectorAll(".panel-nav [data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      const load = loaders[button.dataset.view];
      if (load && button.dataset.view !== "elections") ui.mount(panel(button.dataset.view), load);
    })
  );

  // Atualiza a visão operacional a cada 20 s
  setInterval(() => {
    if (panel("overview").classList.contains("active") && !document.hidden) renderOverview().catch(() => { });
  }, 20000);
});
