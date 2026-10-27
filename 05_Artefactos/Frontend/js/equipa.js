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

  const pill = (text, warn = false) => `<span class="status-pill${warn ? " status-warn" : ""}"><i></i> ${escapeHtml(text)}</span>`;
  const okLabel = (text, ok = true) => `<span class="ok-label${ok ? "" : " is-off"}">${ok ? "✓" : "!"} ${escapeHtml(text)}</span>`;

  const resultBars = (rondas) =>
    rondas
      .map(
        (r) => `
        <p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>
        ${r.candidatos
          .map(
            (c) => `
            <div class="result-row">
              <span>${escapeHtml(c.nome)}</span>
              <div class="bar"><i style="width:${Math.min(100, c.percentagem || 0)}%"></i></div>
              <b>${percent(c.percentagem)}</b>
              <small>${number(c.total_votos)} votos</small>
            </div>`
          )
          .join("")}`
      )
      .join("");

  // ===== Estado dos serviços =====
  const checks = [
    { name: "Autenticação", path: "/auth/eu" },
    { name: "Gestão eleitoral", path: "/eleicoes" },
    { name: "Utilizadores", path: "/utilizadores" },
    { name: "Auditoria", path: "/auditoria?limite=1", pending: true },
    { name: "Integridade", path: "/auditoria/verificar", pending: true },
    { name: "Recibos", path: "/recibos", pending: true },
  ];

  async function probe() {
    const amostras = [];
    for (let i = 0; i < 4; i++) amostras.push(await attempt(api.health()));
    const ok = amostras.filter((a) => a.data && a.data.ok);
    const instancias = [...new Set(ok.map((a) => a.data.data && a.data.data.instance).filter(Boolean))];
    const db = ok.some((a) => a.data.data && a.data.data.database === "ok");
    const lat = ok.length ? Math.round(ok.reduce((s, a) => s + a.data.latency, 0) / ok.length) : null;

    const lista = [
      { name: "API Gateway", state: ok.length === amostras.length ? "ok" : ok.length ? "warn" : "down", info: lat !== null ? `${lat} ms` : "sem resposta" },
      { name: "Instâncias", state: instancias.length > 1 ? "ok" : instancias.length ? "warn" : "down", info: instancias.join(" · ") || "—" },
      { name: "Base de dados", state: db ? "ok" : "down", info: db ? "ligada" : "sem resposta" },
    ];
    for (const c of checks) {
      const r = await attempt(TV.request("GET", c.path, { raw: true }));
      const status = r.data ? r.data.status : 0;
      lista.push({
        name: c.name,
        state: r.data && r.data.ok ? "ok" : c.pending && [404, 405, 501].includes(status) ? "pending" : "down",
        info: r.data && r.data.ok ? `${r.data.latency} ms` : c.pending && status === 404 ? "por implementar no backend" : status ? `erro ${status}` : "sem resposta",
      });
    }
    return { lista, instancias };
  }

  const okCount = (lista) => lista.filter((x) => x.state === "ok").length;
  const allOk = (lista) => lista.every((x) => x.state === "ok" || x.state === "pending");
  const systemsPill = (lista) =>
    allOk(lista) ? pill("TODOS OS SISTEMAS OPERACIONAIS") : pill(`${lista.length - okCount(lista)} SERVIÇO(S) COM FALHAS`, true);

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
    const [eleicao, lista, integridade, servicos] = await Promise.all([
      elections.featured(),
      api.eleicoes.listar(),
      attempt(api.auditoria.verificar()),
      probe(),
    ]);
    const stats = eleicao ? await attempt(api.votacao.estatisticas(eleicao.id)) : { error: null };
    const s = stats.data;
    const serie = (s && s.serie) || [];
    const ultimaHora = serie.length ? serie[serie.length - 1].votos : null;
    const replicasOk = servicos.instancias.length > 1;

    el.innerHTML = `
      ${head("CENTRO DE OPERAÇÕES", "Visão operacional", "Controlo seguro e auditável da infraestrutura eleitoral.", systemsPill(servicos.lista))}
      <div class="admin-metrics">
        <article class="metric-card">
          <span class="check-box">✓</span>
          <small>PARTICIPAÇÃO</small><em>${s ? percent(s.participacao) : ""}</em>
          <b>${s ? `${number(s.votantes)} <small style="font-size:11px">/ ${number(s.habilitados)}</small>` : "—"}</b>
          <div class="bar"><i style="width:${s ? Math.min(100, s.participacao) : 0}%"></i></div>
        </article>
        <article class="metric-card">
          <span class="check-box">✓</span>
          <small>VOTOS REGISTADOS</small><em>${eleicao ? escapeHtml(elections.statusLabels[eleicao.estado]) : ""}</em>
          <b>${s ? number(s.votantes) : "—"}</b>
          <span>${ultimaHora !== null ? `${number(ultimaHora)} na última hora` : escapeHtml(stats.error ? stats.error.message : "Sem eleição ativa")}</span>
        </article>
        <article class="metric-card">
          <span class="check-box">✓</span>
          <small>SERVIÇOS</small><em>${allOk(servicos.lista) ? "ESTÁVEL" : "ATENÇÃO"}</em>
          <b>${okCount(servicos.lista)} / ${servicos.lista.length}</b>
          <span>Operacionais · ${number(lista.length)} eleições</span>
        </article>
        <article class="metric-card">
          <span class="check-box">✓</span>
          <small>INTEGRIDADE</small><em>${integridade.data ? (integridade.data.valida ? "VÁLIDA" : "QUEBRADA") : ""}</em>
          <b>${integridade.data ? (integridade.data.valida ? "100%" : "Falha") : "—"}</b>
          <span>${integridade.data ? `${number(integridade.data.registos)} registos · ${time(new Date().toISOString())}` : escapeHtml(integridade.error.message)}</span>
        </article>
      </div>
      <div class="overview-grid">
        <article class="dash-card">
          ${cardHead("PARTICIPAÇÃO", "Votos ao longo do tempo", eleicao ? `<span class="model-tag">${escapeHtml(eleicao.titulo)}</span>` : "")}
          ${serie.length ? lineChart(serie) : `<div class="empty-box">${escapeHtml(stats.error ? stats.error.message : "Ainda não existem votos registados.")}</div>`}
        </article>
        <article class="dash-card resilience-text">
          ${cardHead("CONTROLO DE RESILIÊNCIA", "Failover automático")}
          <div class="ring" style="--ring:${replicasOk ? 75 : 30}%"><div><span><b>${replicasOk ? "PRONTO" : "ATENÇÃO"}</b><br><small>ESTADO</small></span></div></div>
          <p>${replicasOk ? `${servicos.instancias.length} réplicas a responder (${escapeHtml(servicos.instancias.join(", "))}) e prontas para assumir.` : "Só uma réplica respondeu. Verifique a segunda instância."}</p>
          <button class="button button-light" type="button" data-test-replicas style="width:100%">Testar réplicas</button>
        </article>
      </div>`;

    el.querySelector("[data-test-replicas]").addEventListener("click", (event) =>
      ui.busy(event.currentTarget, "A testar…", renderOverview).catch((e) => ui.toast(e.message, true))
    );
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
      ${head("GESTÃO ELEITORAL", "Eleições", "Configure e acompanhe os atos eleitorais da plataforma.", '<button class="button button-primary" type="button" data-new>Nova eleição →</button>')}
      <article class="dash-card">
        ${cardHead("GESTÃO ELEITORAL", "Eleições configuradas")}
        ${
          detalhes.length
            ? `<div class="election-rows">${detalhes
                .map(
                  (e, i) => `
                  <div class="election-row${e.estado === "em_curso" ? "" : " is-muted"}">
                    <span class="round-mark">✓</span>
                    <div>
                      ${pill(e.estadoLabel, e.estado === "rascunho")}
                      <h3>${escapeHtml(e.titulo)}</h3>
                      <small>${escapeHtml(e.periodo)} · ${(e.candidatos || []).filter((c) => c.ativo).length} candidatos</small>
                    </div>
                    <div class="turnout"><b>${stats[i].data ? percent(stats[i].data.participacao) : "—"}</b><small>participação</small></div>
                    <button class="button button-outline" type="button" data-edit="${e.id}">${e.estado === "rascunho" ? "Configurar" : "Gerir"}</button>
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
      <article class="dash-card">
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
            ${e && e.estado === "rascunho" ? '<button class="button button-outline" type="button" data-remove>Apagar eleição</button>' : ""}
            <button class="button button-primary" type="submit">${e ? "Guardar alterações" : "Guardar eleição"}</button>
            <button class="button button-light" type="button" data-back>Cancelar</button>
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
      <article class="dash-card">
        ${cardHead("CANDIDATURAS", `Candidatos · ${(e.candidatos || []).length}`)}
        ${
          (e.candidatos || []).length
            ? `<div class="table-scroll"><table>
                <thead><tr><th>Opção</th><th>Candidato</th><th>Partido</th><th>Estado</th><th>Ações</th></tr></thead>
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
        ${
          rascunho
            ? `<form class="inline-form" data-cand-form>
                <label class="field-label">Nome<input name="nome" required maxlength="200"></label>
                <label class="field-label">Partido<input name="partido" maxlength="200"></label>
                <label class="field-label">Descrição<input name="descricao" maxlength="500"></label>
                <button class="button button-primary" type="submit">Adicionar →</button>
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
        <article class="dash-card">
          ${cardHead("RECENSEAMENTO", `Eleitores habilitados · ${habilitados.length}`, livres.length ? `<button class="button button-outline" type="button" data-voter-all>Habilitar todos (${livres.length})</button>` : "")}
          ${
            habilitados.length
              ? `<div class="table-scroll voter-picker"><table>
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
          ${
            livres.length
              ? `<form class="inline-form" data-voter-form>
                  <label class="field-label">Habilitar eleitor
                    <select name="uid" required>
                      <option value="">Selecione um eleitor</option>
                      ${livres.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)} · ${escapeHtml(u.email)}</option>`).join("")}
                    </select>
                  </label>
                  <button class="button button-primary" type="submit">Habilitar →</button>
                </form>`
              : ""
          }
        </article>`;

      const reload = () => renderVotersCard(e);
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
      <article class="dash-card">
        ${cardHead("CALENDÁRIO", "Rondas")}
        ${
          rondas.length
            ? `<div class="table-scroll"><table>
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
        ${
          podeSegunda
            ? `<form class="inline-form" data-second-round>
                <p class="muted">Criar 2.ª volta: escolha exatamente 2 candidatos.</p>
                ${ativos.map((c) => `<label class="radio-line"><input type="checkbox" name="cand" value="${c.id}"> ${escapeHtml(c.nome)}</label>`).join("")}
                <label class="field-label">Início<input type="datetime-local" name="inicio" required></label>
                <label class="field-label">Fim<input type="datetime-local" name="fim" required></label>
                <button class="button button-primary" type="submit">Criar 2.ª volta →</button>
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
      ${head("GESTÃO ELEITORAL", "Candidatos", "Candidaturas incluídas na simulação académica.", lista.length ? `<label class="field-label" style="margin:0;min-width:280px">Eleição<select data-cand-election>${lista.map((e) => `<option value="${e.id}">${escapeHtml(e.titulo)} · ${elections.statusLabels[e.estado]}</option>`).join("")}</select></label>` : "")}
      <article class="dash-card" data-cand-table>${lista.length ? "" : ui.empty("Ainda não existem eleições")}</article>`;
    const select = el.querySelector("[data-cand-election]");
    if (!select) return;
    const table = el.querySelector("[data-cand-table]");
    const load = () =>
      ui.mount(table, async () => {
        const e = await api.eleicoes.detalhe(select.value);
        table.innerHTML = (e.candidatos || []).length
          ? `<div class="table-scroll"><table>
              <thead><tr><th>Opção</th><th>Candidato</th><th>Descrição</th><th>Estado</th></tr></thead>
              <tbody>${e.candidatos
                .map((c, i) => `<tr><td class="mono">${String(i + 1).padStart(2, "0")}</td><td><b>${escapeHtml(c.nome)}</b></td><td>${escapeHtml([c.partido, c.descricao].filter(Boolean).join(" · ") || "—")}</td><td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td></tr>`)
                .join("")}</tbody></table></div>
             <button class="button button-outline" type="button" data-manage>Gerir na eleição →</button>`
          : `${ui.empty("Sem candidatos nesta eleição")}<div class="state-box"><button class="button button-outline" type="button" data-manage>Adicionar candidatos →</button></div>`;
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
      ${head("RECENSEAMENTO", "Eleitores", "Credenciais eleitorais emitidas na plataforma.", `
        <label class="field-label" style="margin:0;min-width:220px">Perfil
          <select data-profile>
            <option value="">Todos</option>
            <option value="eleitor">Eleitores</option>
            <option value="administrador">Administradores</option>
          </select>
        </label>`)}
      <article class="dash-card" data-users></article>`;
    const select = el.querySelector("[data-profile]");
    const box = el.querySelector("[data-users]");
    const load = () =>
      ui.mount(box, async () => {
        const lista = await api.utilizadores.listar(select.value || undefined);
        box.innerHTML = lista.length
          ? `<div class="table-scroll"><table>
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
                    <td><div class="row-actions">${
                      u.id === user.id
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

  // ===== Serviços =====
  async function renderServices() {
    const el = panel("services");
    const { lista } = await probe();
    el.innerHTML = `
      ${head("CENTRO DE OPERAÇÕES", "Serviços", "Estado medido agora a partir do backend.", systemsPill(lista))}
      <article class="dash-card">
        ${cardHead("INFRAESTRUTURA", "Estado dos serviços", `<div class="row-actions">${pill(`${okCount(lista)} de ${lista.length} operacionais`)}<button type="button" data-refresh>Atualizar</button></div>`)}
        <div class="service-status">
          ${lista
            .map(
              (s) => `
              <div class="service-item is-${s.state}" title="${stateLabel[s.state]}">
                <span class="check-box">${s.state === "ok" ? "✓" : s.state === "pending" ? "…" : "!"}</span>
                <div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.info)} · ${stateLabel[s.state].toLowerCase()}</small></div>
                <i></i>
              </div>`
            )
            .join("")}
        </div>
      </article>`;
    el.querySelector("[data-refresh]").addEventListener("click", (event) => ui.busy(event.currentTarget, "A medir…", renderServices));
  }

  const stateLabel = { ok: "OPERACIONAL", warn: "DEGRADADO", down: "EM FALHA", pending: "POR IMPLEMENTAR" };

  // ===== Resultados e integridade =====
  async function renderIntegrity() {
    const el = panel("integrity");
    const [v, lista] = await Promise.all([attempt(api.auditoria.verificar()), api.eleicoes.listar()]);
    const comResultados = lista.filter((e) => ["em_curso", "encerrada"].includes(e.estado));
    const ok = v.data && v.data.valida;

    el.innerHTML = `
      ${head("VERIFICAÇÃO CRIPTOGRÁFICA", "Integridade", "Validação da cadeia e dos lotes eleitorais.")}
      <article class="dash-card integrity">
        <span class="integrity-seal${v.data && !ok ? " is-invalid" : ""}">${v.data ? (ok ? "✓" : "!") : "…"}</span>
        <p class="eyebrow">${v.data ? "VERIFICAÇÃO CONCLUÍDA" : "VERIFICAÇÃO INDISPONÍVEL"}</p>
        <h2>${v.data ? (ok ? "A cadeia eleitoral está íntegra." : "Foi detetada uma inconsistência.") : "Não foi possível verificar."}</h2>
        <p>${v.data ? `${number(v.data.registos)} registos verificados.${ok ? " Nenhuma inconsistência detetada." : ""}` : escapeHtml(v.error.message)}</p>
        <button class="button button-primary" type="button" data-verify>Executar nova verificação →</button>
        ${
          v.data && (v.data.blocos || []).length
            ? `<div class="chain-blocks">${v.data.blocos
                .map((b, i) => `<div><i>✓</i><b>${i === 0 ? "GENESIS" : `#${number(b.id)}`}</b><small>${escapeHtml(String(b.hash).slice(0, 6))}…</small></div>`)
                .join("")}</div>`
            : ""
        }
      </article>
      ${comResultados.map((e) => `<article class="dash-card" data-result="${e.id}"></article>`).join("") || `<article class="dash-card">${ui.empty("Sem resultados", "Os resultados aparecem quando uma eleição começa.")}</article>`}`;

    el.querySelector("[data-verify]").addEventListener("click", (event) => ui.busy(event.currentTarget, "A verificar…", renderIntegrity));
    comResultados.forEach((e) => {
      const card = el.querySelector(`[data-result="${e.id}"]`);
      ui.mount(card, async () => {
        const rondas = await api.votacao.resultados(e.id);
        card.innerHTML = `${cardHead(`RESULTADOS · ${elections.statusLabels[e.estado]}`, escapeHtml(e.titulo))}${resultBars(rondas)}`;
      });
    });
  }

  // ===== Auditoria =====
  let registos = [];

  async function renderAudit() {
    const el = panel("audit");
    registos = await api.auditoria.listar(200);
    el.innerHTML = `
      ${head("REGISTO IMUTÁVEL", "Auditoria", "Eventos assinados produzidos pela plataforma eleitoral.")}
      <article class="dash-card">
        ${cardHead("REGISTO IMUTÁVEL", `Eventos de auditoria · ${number(registos.length)}`, '<div class="row-actions"><button type="button" data-refresh>Atualizar</button><button class="button button-light" type="button" data-csv>Exportar relatório</button></div>')}
        ${
          registos.length
            ? `<div class="table-scroll"><table>
                <thead><tr><th>Hora</th><th>Evento</th><th>Origem</th><th>Hash</th><th>Estado</th></tr></thead>
                <tbody>${registos
                  .map(
                    (r) => `
                    <tr><td class="mono">${escapeHtml(new Date(r.data).toLocaleTimeString("pt-PT"))}</td><td><b>${escapeHtml(r.acao)}</b></td>
                    <td>${escapeHtml([r.entidade, r.entidade_id].filter(Boolean).join(" #") || (r.utilizador_id ? `Utilizador #${r.utilizador_id}` : r.ip || "—"))}</td>
                    <td><code>${escapeHtml(String(r.hash_atual || "").slice(0, 12))}…</code></td><td>${okLabel("VERIFICADO")}</td></tr>`
                  )
                  .join("")}</tbody></table></div>`
            : ui.empty("Sem registos")
        }
      </article>`;
    el.querySelector("[data-refresh]").addEventListener("click", () => ui.mount(el, renderAudit));
    el.querySelector("[data-csv]").addEventListener("click", () => {
      const cols = ["id", "data", "acao", "entidade", "entidade_id", "utilizador_id", "ip", "hash_atual"];
      const csv = [cols.join(";"), ...registos.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  // ===== Configuração =====
  function renderSettings() {
    const el = panel("settings");
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    el.innerHTML = `
      ${head("CENTRO DE OPERAÇÕES", "Configuração", "Controlo seguro e auditável da infraestrutura eleitoral.")}
      <div class="dash-grid">
        <article class="dash-card">
          ${cardHead("CONFIGURAÇÃO ELEITORAL", "Parâmetros globais")}
          <form data-api-form>
            <label class="field-label">Endereço da API<input name="base" type="url" required value="${escapeHtml(TV.base)}"></label>
            <label class="field-label">Fuso horário<input value="${escapeHtml(zona)} · UTC${offset >= 0 ? "+" : ""}${offset}:00" readonly></label>
            <label class="field-label">Algoritmo de assinatura dos tokens<input value="RS256 · sessão de 30 minutos" readonly></label>
            <p class="form-message" role="status"></p>
            <div class="form-actions" style="justify-content:flex-start">
              <button class="button button-primary" type="submit">Testar e guardar</button>
              <button class="link-button" type="button" data-default>Repor ${escapeHtml(TV.DEFAULT_BASE)}</button>
            </div>
          </form>
        </article>
        <div>
          ${twoFactor.card(session.user)}
          <article class="dash-card">
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
        } catch {}
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
    services: renderServices,
    integrity: renderIntegrity,
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
    if (panel("overview").classList.contains("active") && !document.hidden) renderOverview().catch(() => {});
  }, 20000);
});
