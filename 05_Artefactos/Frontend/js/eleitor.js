/* Área do eleitor ligada ao backend */
document.addEventListener("DOMContentLoaded", async () => {
  const TV = window.TrustVote;
  const { api, session, ui, format, elections, localReceipts, twoFactor } = TV;
  const { escapeHtml, number, percent, dateTime, time, initials, voterNumber, countdown } = format;

  const wrap = document.querySelector(".dashboard-wrap");
  const panel = (name) => document.querySelector(`[data-panel="${name}"]`);
  const go = (view) => document.querySelector(`.panel-nav [data-view="${view}"]`)?.click();

  let user;
  try {
    user = await session.require("eleitor");
  } catch (error) {
    wrap.classList.add("is-ready");
    document.querySelector(".dashboard-content").innerHTML = ui.error(error);
    document.querySelector("[data-retry]").addEventListener("click", () => window.location.reload());
    return;
  }

  // ===== Cabeçalho =====
  function header() {
    const exp = (session.claims() || {}).exp;
    document.querySelector("[data-session-chip]").textContent = exp ? `SESSÃO ATÉ ${time(new Date(exp * 1000).toISOString())}` : "SESSÃO SEGURA";
    const year = user.data_registo ? new Date(user.data_registo).getFullYear() : "";
    document.querySelector("[data-user-chip]").innerHTML =
      `<span class="avatar">${escapeHtml(initials(user.nome))}</span><span><b>${escapeHtml(user.nome)}</b><small>ELEITOR${year ? ` · ${year}` : ""}</small></span>`;
  }
  header();
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

  // ===== Dados partilhados =====
  let lista = [];

  async function loadElections() {
    const todas = await api.eleicoes.listar();
    const detalhes = await Promise.all(todas.map((e) => api.eleicoes.detalhe(e.id).then(elections.view)));
    await Promise.all(
      detalhes.map(async (e) => {
        e.votou = await hasVoted(e);
      })
    );
    return detalhes;
  }

  async function hasVoted(eleicao) {
    try {
      return !!(await api.votacao.participacao(eleicao.id)).votou;
    } catch {
      return localReceipts.all().some((r) => r.eleicao_id === eleicao.id && (!eleicao.ronda || r.ronda === eleicao.ronda.numero));
    }
  }

  const featured = () => lista.find((e) => e.estado === "em_curso") || lista.find((e) => e.estado === "agendada") || null;

  const timeInfo = (e) =>
    e.aberta && e.fim
      ? `Termina em <b data-countdown="${e.fim}">${countdown(e.fim)}</b>`
      : e.inicio && Date.parse(e.inicio) > Date.now()
        ? `Começa em <b data-countdown="${e.inicio}">${countdown(e.inicio)}</b>`
        : escapeHtml(e.periodo);

  setInterval(() => {
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      el.textContent = countdown(el.dataset.countdown);
    });
  }, 30000);

  const statusLine = (e) =>
    `<span class="status-pill status-plain"><i></i> ${e.votou ? "VOTO REGISTADO" : e.aberta ? "VOTAÇÃO ABERTA" : e.estadoLabel}</span>`;

  function voteAction(e, label = "Iniciar votação →") {
    if (e.votou) return '<button class="button button-outline" type="button" data-go="receipts">Ver recibo →</button>';
    if (!e.aberta) return '<button class="button button-outline" type="button" disabled>Votação fechada</button>';
    return `<button class="button button-primary" type="button" data-vote="${e.id}">${label}</button>`;
  }

  function electionCard(e, withDetails) {
    return `
      <article class="election-card">
        <div class="election-card-top">${statusLine(e)}<span>${timeInfo(e)}</span></div>
        <div class="election-card-body">
          <span class="round-mark">✓</span>
          <div>
            <small>ELEIÇÃO · ${e.ano}</small>
            <h2>${escapeHtml(e.titulo)}</h2>
            <p>${escapeHtml(e.descricao || `${e.periodo} · ${e.voltaLabel}`)}</p>
          </div>
          <div class="election-card-actions">
            ${withDetails ? `<button class="button button-outline" type="button" data-details="${e.id}">Ver detalhes</button>` : ""}
            ${voteAction(e)}
          </div>
        </div>
        ${withDetails ? "" : stepsTrack(e)}
      </article>`;
  }

  function stepsTrack(e) {
    const votou = e && e.votou;
    return `
      <div class="steps-track">
        <span class="is-done"><i>✓</i><b>Identidade</b><small>Confirmada</small></span>
        <hr>
        <span class="${votou ? "is-done" : "is-current"}"><i>${votou ? "✓" : "2"}</i><b>Votação</b><small>${votou ? "Concluída" : "Por concluir"}</small></span>
        <hr>
        <span class="${votou ? "is-done" : ""}"><i>${votou ? "✓" : "3"}</i><b>Recibo</b><small>${votou ? "Emitido" : "Após o voto"}</small></span>
      </div>`;
  }

  function bindVoteButtons(root) {
    root.querySelectorAll("[data-vote]").forEach((b) =>
      b.addEventListener("click", () => {
        go("elections");
        openBallot(Number(b.dataset.vote));
      })
    );
    root.querySelectorAll("[data-details]").forEach((b) => b.addEventListener("click", () => openDetails(Number(b.dataset.details))));
  }

  // ===== Visão geral =====
  function renderOverview() {
    const e = featured();
    const recibos = localReceipts.all();
    const hoje = new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 20 ? "Boa tarde" : "Boa noite";
    const subtitulo = !e
      ? "Não tens eleições ativas de momento."
      : e.votou
        ? "O teu voto já foi registado. Obrigado por participares."
        : e.aberta
          ? "Tens uma eleição presidencial à espera do teu voto."
          : `A próxima eleição começa a ${dateTime(e.inicio)}.`;

    panel("overview").innerHTML = `
      ${head(hoje, `${saudacao}, ${escapeHtml(user.nome.split(" ")[0])}.`, subtitulo, `
        <div class="badge-card">
          <span class="ok-label">✓</span>
          <div><small>CREDENCIAL ELEITORAL · ${escapeHtml(voterNumber(user))}</small><b>${user.ativo === false ? "Suspensa" : "Verificada e válida"}</b></div>
          <i></i>
        </div>`)}

      ${e ? electionCard(e, false) : `<article class="dash-card">${ui.empty("Sem eleições ativas", "Quando a equipa te habilitar numa eleição, ela aparece aqui.")}</article>`}

      <div class="overview-grid">
        <article class="dash-card">
          <p class="eyebrow">A TUA SEGURANÇA</p>
          <h2>Proteção em todas as etapas</h2>
          <ul class="check-list">
            <li><span class="check-box">✓</span><b>Voto anónimo</b><small>A identidade nunca é associada à escolha.</small><i>✓</i></li>
            <li><span class="check-box">✓</span><b>Registo distribuído</b><small>O voto é replicado de forma segura.</small><i>✓</i></li>
            <li><span class="check-box">${user.totp_ativo ? "✓" : "!"}</span><b>Autenticação de dois fatores</b><small>${user.totp_ativo ? "Ativa nesta conta." : "Desativada — ativa nas Definições."}</small><i>${user.totp_ativo ? "✓" : "→"}</i></li>
          </ul>
        </article>
        <article class="dash-card">
          <p class="eyebrow">ATIVIDADE RECENTE</p>
          <h2>${recibos.length ? "O teu último voto" : "Ainda não votaste"}</h2>
          ${
            recibos.length
              ? `<div class="receipt-code"><small>${escapeHtml(recibos[0].eleicao_titulo || "")} · ${dateTime(recibos[0].data)}</small><b>${escapeHtml(recibos[0].recibo)}</b></div>`
              : '<div class="empty-box">O recibo criptográfico ficará disponível depois da votação.</div>'
          }
          <button class="link-button" type="button" data-go="receipts">Como funciona o recibo? →</button>
        </article>
      </div>`;
    bindVoteButtons(panel("overview"));
  }

  // ===== Eleições =====
  function renderElections() {
    const ativas = lista.filter((e) => e.estado !== "encerrada");
    const concluidas = lista.filter((e) => e.estado === "encerrada");
    const el = panel("elections");

    el.innerHTML = `
      ${head("ELEIÇÕES PRESIDENCIAIS", "As tuas eleições", "Consulta eleições ativas, agendadas e anteriores.")}
      ${ativas.length ? ativas.map((e) => electionCard(e, true)).join("") : `<article class="dash-card">${ui.empty("Sem eleições ativas", "Ainda não estás habilitado em nenhuma eleição a decorrer.")}</article>`}
      <article class="dash-card">
        <p class="eyebrow">HISTÓRICO</p>
        <h2>Eleições concluídas</h2>
        ${
          concluidas.length
            ? `<div class="history-rows">${concluidas
                .map(
                  (e) => `
                  <div><span class="year">${e.ano}</span><span><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(e.periodo)}</small></span>
                  <span class="ok-label">✓ ${e.votou ? "VOTOU" : "ENCERRADA"}</span></div>`
                )
                .join("")}</div>`
            : '<p class="muted">Ainda não existem eleições concluídas.</p>'
        }
      </article>`;
    bindVoteButtons(el);
  }

  function openDetails(id) {
    const e = lista.find((x) => x.id === id);
    const el = panel("elections");
    window.scrollTo({ top: 0, behavior: "smooth" });
    el.innerHTML = `
      ${head(`ELEIÇÃO · ${e.ano}`, escapeHtml(e.titulo), "Informação completa sobre o ato eleitoral.")}
      <article class="dash-card">
        <p class="eyebrow"><i></i> ${e.aberta ? "VOTAÇÃO ABERTA" : e.estadoLabel}</p>
        <h2>Dados da eleição</h2>
        <label class="field-label">Período de votação<input value="${escapeHtml(e.periodo)}" readonly></label>
        <label class="field-label">Ronda<input value="${escapeHtml(e.voltaLabel)}" readonly></label>
        <label class="field-label">Candidaturas<input value="${escapeHtml(e.candidatosRonda.map((c) => c.nome).join(" · ") || "—")}" readonly></label>
        ${e.descricao ? `<p class="notice"><b>Sobre esta eleição</b>${escapeHtml(e.descricao)}</p>` : ""}
        <div class="form-actions" style="justify-content:flex-start">
          ${voteAction(e, "Abrir boletim digital →")}
          <button class="link-button" type="button" data-back>← Voltar às eleições</button>
        </div>
      </article>`;
    el.querySelector("[data-back]").addEventListener("click", renderElections);
    bindVoteButtons(el);
  }

  function candidateOption(c, i, selectable = true) {
    const info = [c.partido, c.descricao].filter(Boolean).join(" · ") || "Candidatura registada";
    return `
      <label${selectable ? "" : ' class="is-static"'}>
        <span class="avatar">${escapeHtml(initials(c.nome))}</span>
        <span>
          <small>OPÇÃO ${String(i + 1).padStart(2, "0")}</small>
          <b>${escapeHtml(c.nome)}</b>
          <small>${escapeHtml(info)}</small>
        </span>
        ${selectable ? `<input type="radio" name="candidate" value="${c.id}" required aria-label="${escapeHtml(c.nome)}">` : ""}
      </label>`;
  }

  function openBallot(id) {
    const e = lista.find((x) => x.id === id);
    const el = panel("elections");
    if (!e || !e.aberta) return renderElections();
    window.scrollTo({ top: 0, behavior: "smooth" });

    el.innerHTML = `
      <article class="dash-card ballot">
        <p class="eyebrow">BOLETIM DIGITAL · PASSO 1 DE 3</p>
        <h1>Escolha uma candidatura</h1>
        <p class="muted">Selecione uma opção. Pode rever a escolha antes de a depositar.</p>
        <p class="notice"><b>${escapeHtml(e.titulo)}</b>${escapeHtml(e.descricao || e.voltaLabel)}</p>
        <form data-ballot>
          <div class="candidate-list">${e.candidatosRonda.map((c, i) => candidateOption(c, i)).join("")}</div>
          <p class="form-message" role="status"></p>
          <div class="ballot-foot">
            <small>A escolha será encriptada localmente</small>
            <button class="button button-primary" type="submit">Rever escolha →</button>
          </div>
        </form>
        <button class="link-button" type="button" data-back>← Voltar às eleições</button>
      </article>`;

    el.querySelector("[data-back]").addEventListener("click", renderElections);
    el.querySelector("[data-ballot]").addEventListener("submit", (event) => {
      event.preventDefault();
      const escolhido = event.currentTarget.candidate.value;
      if (!escolhido) return ui.message(event.currentTarget.querySelector(".form-message"), "Selecione uma candidatura.");
      review(e, e.candidatosRonda.find((c) => String(c.id) === escolhido));
    });
  }

  function review(e, candidato) {
    const el = panel("elections");
    el.innerHTML = `
      <article class="dash-card ballot">
        <p class="eyebrow">BOLETIM DIGITAL · PASSO 2 DE 3</p>
        <h1>Confirme a sua escolha</h1>
        <p class="muted">Depois de depositado, o voto não pode ser alterado.</p>
        <div class="candidate-list">${candidateOption(candidato, e.candidatosRonda.indexOf(candidato), false)}</div>
        <p class="form-message" role="status" data-vote-message></p>
        <div class="ballot-foot">
          <button class="link-button" type="button" data-change>← Alterar escolha</button>
          <button class="button button-primary" type="button" data-deposit>Depositar voto →</button>
        </div>
      </article>`;

    el.querySelector("[data-change]").addEventListener("click", () => openBallot(e.id));
    el.querySelector("[data-deposit]").addEventListener("click", async (event) => {
      try {
        const res = await ui.busy(event.currentTarget, "A depositar…", () => api.votacao.votar(e.id, e.ronda.numero, candidato.id));
        const recibo = { eleicao_id: e.id, eleicao_titulo: e.titulo, ronda: e.ronda.numero, recibo: res.recibo, hash: res.hash, data: res.data };
        localReceipts.save(recibo);
        e.votou = true;
        done(e, recibo);
        renderOverview();
      } catch (error) {
        if (error.status === 409) {
          e.votou = true;
          renderOverview();
          return done(e, null);
        }
        ui.message(el.querySelector("[data-vote-message]"), error.message);
      }
    });
  }

  function done(e, recibo) {
    panel("elections").innerHTML = `
      <article class="dash-card ballot ballot-done">
        <span class="seal-icon">✓</span>
        <p class="eyebrow">VOTO DEPOSITADO</p>
        <h1>${recibo ? "O teu voto foi registado." : "Já votaste nesta eleição."}</h1>
        <p class="muted">${recibo ? "O voto foi selado, replicado e incluído no registo eleitoral." : "Cada eleitor só pode votar uma vez por ronda."}</p>
        ${recibo ? `<div class="receipt-code"><small>RECIBO CRIPTOGRÁFICO</small><b>${escapeHtml(recibo.recibo)}</b></div>` : ""}
        <button class="button button-primary" type="button" data-go="receipts">Continuar para o recibo →</button>
      </article>`;
    loadReceipts();
  }

  // ===== Sondagem =====
  function renderPoll() {
    const el = panel("poll");
    const e = featured();
    const title = (extra = "") =>
      head("MODELO PREDITIVO · SIMULAÇÃO ACADÉMICA", "Sondagem eleitoral com IA", "Projeção experimental baseada em resultados históricos e numa amostra simulada de intenção de voto.", extra);
    if (!e) {
      el.innerHTML = title() + `<article class="dash-card">${ui.empty("Sem eleição para projetar")}</article>`;
      return;
    }
    el.innerHTML = title() + `<div data-poll-body></div>`;
    const body = el.querySelector("[data-poll-body]");
    ui.mount(body, async () => {
      const s = await api.sondagem.obter(e.id);
      el.querySelector(".page-head").insertAdjacentHTML("beforeend", `<span class="model-tag">MODELO ${escapeHtml(String(s.modelo || "TRUSTVOTE").toUpperCase())}</span>`);
      body.innerHTML = `
        <div class="poll-grid">
          <article class="dash-card">
            <div class="card-head">
              <div><p class="eyebrow">PROJEÇÃO ATUAL</p><h2>Estimativa para ${e.ano}</h2></div>
              <small class="muted" style="font-size:9px">AMOSTRA SIMULADA · N=${number(s.amostra)}</small>
            </div>
            ${(s.projecao || [])
              .map(
                (p) => `
                <div class="result-row">
                  <span class="avatar">${p.candidato_id ? escapeHtml(initials(p.nome)) : "?"}</span>
                  <span><b style="font-size:13px">${escapeHtml(p.nome)}</b></span>
                  <div class="bar"><i style="width:${Math.min(100, p.percentagem)}%"></i></div>
                  <b>${percent(p.percentagem)}</b>
                </div>`
              )
              .join("")}
            <p class="notice"><b>Intervalo de confiança estimado: ±${escapeHtml(String(s.intervalo ?? "—"))} p.p.</b>Esta projeção não representa uma sondagem oficial nem utiliza dados pessoais reais.</p>
          </article>
          <article class="dash-card">
            <p class="eyebrow">PARTICIPAÇÃO ANÓNIMA</p>
            <h2>Se a eleição fosse hoje?</h2>
            <p>A resposta é agregada à demonstração e não afeta o voto.</p>
            <form class="poll-form" data-poll-form>
              ${e.candidatosRonda.map((c) => `<label class="radio-line"><input type="radio" name="poll" value="${c.id}" required> ${escapeHtml(c.nome)}</label>`).join("")}
              <p class="form-message" role="status"></p>
              <button class="button button-primary" type="submit">Incluir na simulação</button>
            </form>
          </article>
        </div>`;
      body.querySelector("[data-poll-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = form.querySelector(".form-message");
        try {
          await ui.busy(form.querySelector("button"), "A enviar…", () => api.sondagem.responder(e.id, Number(form.poll.value)));
          ui.message(message, "Obrigado! A sua resposta foi incluída na simulação.", true);
        } catch (error) {
          ui.message(message, error.message);
        }
      });
    });
  }

  // ===== Resultados =====
  function renderResults() {
    const el = panel("results");
    const title = head("INFORMAÇÃO ELEITORAL", "Resultados", "Apuramento das eleições em curso e concluídas.");
    const comResultados = lista.filter((e) => ["em_curso", "encerrada"].includes(e.estado));
    if (!comResultados.length) {
      el.innerHTML = title + `<article class="dash-card">${ui.empty("Resultados ainda não disponíveis", "Os resultados aparecem quando uma eleição começa.")}</article>`;
      return;
    }
    el.innerHTML = title + comResultados.map((e) => `<article class="dash-card" data-result="${e.id}"></article>`).join("");
    comResultados.forEach((e) => {
      const card = el.querySelector(`[data-result="${e.id}"]`);
      ui.mount(card, async () => {
        const rondas = await api.votacao.resultados(e.id);
        card.innerHTML = `
          <div class="card-head"><div><p class="eyebrow">${e.estadoLabel}</p><h2>${escapeHtml(e.titulo)}</h2></div></div>
          ${rondas
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
            .join("")}`;
      });
    });
  }

  // ===== Recibos =====
  function loadReceipts() {
    const el = panel("receipts");
    el.innerHTML = `${head("VERIFICAÇÃO INDIVIDUAL", "Os meus recibos", "Confirma que o teu voto foi incluído sem revelar a escolha.")}<div data-receipts></div>`;
    const box = el.querySelector("[data-receipts]");
    ui.mount(box, async () => {
      let recibos;
      let aviso = "";
      try {
        recibos = await api.votacao.recibos();
      } catch (error) {
        if (!error.pending) throw error;
        recibos = localReceipts.all();
        aviso = '<p class="notice">A mostrar os recibos guardados neste dispositivo.</p>';
      }
      if (!recibos.length) {
        box.innerHTML = `<article class="dash-card">${ui.empty("Ainda não existem recibos", "O recibo é emitido quando depositas um voto.")}<div class="state-box"><button class="button button-outline" type="button" data-go="elections">Ver eleições →</button></div></article>`;
        return;
      }
      box.innerHTML =
        aviso +
        recibos
          .map(
            (r, i) => `
            <article class="dash-card receipt-card">
              <span class="seal-icon">✓</span>
              <div>
                <span class="status-pill status-plain" data-verify-status="${i}"><i></i> DEPOSITADO</span>
                <h2>${escapeHtml(r.eleicao_titulo || `Eleição #${r.eleicao_id}`)}</h2>
                <p>Depositado a ${dateTime(r.data)} · ${r.ronda === 2 ? "2.ª" : "1.ª"} volta.</p>
                <div class="receipt-code"><small>IDENTIFICADOR CRIPTOGRÁFICO</small><b>${escapeHtml(r.recibo)}</b></div>
                <div class="receipt-checks" data-verify-checks="${i}"></div>
              </div>
              <div class="receipt-actions">
                <button class="button button-primary" type="button" data-verify="${i}">Verificar</button>
                <button class="button button-outline" type="button" data-download="${i}">Descarregar recibo</button>
              </div>
            </article>`
          )
          .join("");

      box.querySelectorAll("[data-verify]").forEach((b) =>
        b.addEventListener("click", async () => {
          const r = recibos[b.dataset.verify];
          const pill = box.querySelector(`[data-verify-status="${b.dataset.verify}"]`);
          const checks = box.querySelector(`[data-verify-checks="${b.dataset.verify}"]`);
          try {
            const v = await ui.busy(b, "A verificar…", () => api.votacao.verificarRecibo(r.recibo));
            pill.classList.toggle("status-warn", !v.valido);
            pill.innerHTML = `<i></i> ${v.valido ? "INCLUÍDO E VERIFICADO" : "NÃO ENCONTRADO"}`;
            checks.innerHTML = v.valido ? `<span>✓ Assinatura válida</span><span>✓ Incluído na contagem</span><span>✓ ${v.ronda === 2 ? "2.ª" : "1.ª"} volta</span>` : "";
          } catch (error) {
            ui.toast(error.message, true);
          }
        })
      );
      box.querySelectorAll("[data-download]").forEach((b) =>
        b.addEventListener("click", () => {
          const r = recibos[b.dataset.download];
          const texto = [
            "TrustVote · Recibo de voto",
            `Eleição: ${r.eleicao_titulo || r.eleicao_id}`,
            `Ronda: ${r.ronda}`,
            `Data: ${dateTime(r.data)}`,
            `Recibo: ${r.recibo}`,
            r.hash ? `Hash: ${r.hash}` : "",
          ].filter(Boolean).join("\n");
          const link = document.createElement("a");
          link.href = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
          link.download = `recibo-${r.recibo}.txt`;
          link.click();
          URL.revokeObjectURL(link.href);
        })
      );
    });
  }

  // ===== Definições =====
  const settings = panel("settings");
  const accessibility = settings.querySelector(".dash-card");

  function renderSettings() {
    settings.querySelectorAll("[data-settings-extra]").forEach((n) => n.remove());
    const claims = session.claims() || {};
    settings.querySelector("h1").insertAdjacentHTML("afterend", '<p class="muted" data-settings-extra>Gere os teus dados de contacto e preferências de segurança.</p>');
    accessibility.insertAdjacentHTML(
      "beforebegin",
      `
      <div class="dash-grid" data-settings-extra>
        <article class="dash-card">
          <p class="eyebrow">PERFIL ELEITORAL</p>
          <h2>Informação da conta</h2>
          <label class="field-label">Nome completo<input value="${escapeHtml(user.nome)}" readonly></label>
          <label class="field-label">E-mail da conta<input value="${escapeHtml(user.email)}" readonly></label>
          <label class="field-label">Número de eleitor<input value="${escapeHtml(voterNumber(user))}" readonly></label>
          <p class="muted" style="font-size:11px">Os dados eleitorais são geridos pela instituição.</p>
        </article>
        <div>
          ${twoFactor.card(user)}
          <article class="dash-card">
            <p class="eyebrow">SESSÃO ATUAL</p>
            <h2>Sessão verificada</h2>
            <p>Iniciada às ${claims.iat ? time(new Date(claims.iat * 1000).toISOString()) : "—"} · termina às ${claims.exp ? time(new Date(claims.exp * 1000).toISOString()) : "—"}.</p>
            <button class="button button-outline" type="button" data-logout-settings>Terminar sessão →</button>
          </article>
        </div>
      </div>`
    );
    settings.querySelector("[data-logout-settings]").addEventListener("click", session.logout);
    twoFactor.wire(settings, () => {
      user = session.user;
      renderSettings();
      renderOverview();
    });
  }

  // ===== Arranque =====
  renderSettings();
  loadReceipts();
  wrap.classList.add("is-ready");

  async function loadAll() {
    lista = await loadElections();
    renderOverview();
    renderElections();
    renderPoll();
    renderResults();
  }

  panel("overview").innerHTML = ui.loading("A carregar as tuas eleições…");
  try {
    await loadAll();
  } catch (error) {
    panel("overview").innerHTML = ui.error(error);
    panel("overview").querySelector("[data-retry]").addEventListener("click", () => loadAll().catch((e) => ui.toast(e.message, true)));
  }
});
