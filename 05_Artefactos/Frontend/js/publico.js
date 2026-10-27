/* Páginas públicas: calendário, candidaturas, resultados e transparência com dados da API */
document.addEventListener("DOMContentLoaded", () => {
  const { api, session, format, elections, ui } = window.TrustVote;
  const { escapeHtml, number, percent, dateTime, date, initials } = format;

  let resumoPromise = null;
  const resumo = () => (resumoPromise = resumoPromise || api.publico.resumo());

  // ===== Calendário =====
  const live = document.querySelector("[data-calendar-live]");
  if (live) {
    ui.mount(live, async () => {
      const dados = await resumo();
      const e = dados.eleicao;
      const now = Date.now();
      const inicio = Date.parse(e.data_inicio);
      const fim = Date.parse(e.data_fim);

      live.innerHTML = `
        <div class="heading-row">
          <div>
            <p class="eyebrow">PRÓXIMO ATO ELEITORAL</p>
            <h2>${escapeHtml(e.titulo)}</h2>
            <p>Votação de ${dateTime(e.data_inicio)} a ${dateTime(e.data_fim)}.</p>
          </div>
          <span class="status-pill"><i></i> ${elections.statusLabels[e.estado] || e.estado}</span>
        </div>`;

      const phases = {
        preparacao: now < inicio ? "A DECORRER" : "CONCLUÍDA",
        votacao: now < inicio ? `A PARTIR DE ${date(e.data_inicio).toUpperCase()}` : now < fim ? "A DECORRER" : "CONCLUÍDA",
        apuramento: e.estado === "encerrada" ? "CONCLUÍDO" : `APÓS ${date(e.data_fim).toUpperCase()}`,
      };
      Object.entries(phases).forEach(([phase, label]) => {
        const pill = document.querySelector(`[data-phase="${phase}"] .status-pill`);
        if (pill) pill.textContent = label;
      });
    });
  }

  // ===== Estatísticas =====
  const liveValues = document.querySelectorAll("[data-live]");
  if (liveValues.length) {
    resumo()
      .then((dados) =>
        liveValues.forEach((el) => {
          const value = dados[el.dataset.live];
          el.textContent = el.dataset.live === "participacao" ? percent(value) : number(value);
        })
      )
      .catch(() => {});
  }

  // ===== Candidaturas =====
  const grid = document.querySelector("[data-candidates]");
  if (grid) {
    resumo()
      .then((dados) => {
        const lista = dados.candidatos || [];
        if (!lista.length) {
          grid.outerHTML = ui.empty("Ainda não existem candidaturas publicadas.");
          return;
        }
        grid.innerHTML = lista
          .map(
            (c) => `
              <article>
                <span class="candidate-badge">${escapeHtml(initials(c.nome))}</span>
                <h2>${escapeHtml(c.nome)}</h2>
                <p>${escapeHtml([c.partido, c.descricao].filter(Boolean).join(" · ") || "Candidatura registada")}</p>
                <span class="status-pill">${escapeHtml(dados.eleicao.titulo.toUpperCase())}</span>
              </article>`
          )
          .join("");
        const notice = grid.parentElement.querySelector(".notice");
        if (notice) notice.textContent = "Lista das candidaturas admitidas, obtida em tempo real a partir da plataforma.";
      })
      .catch((error) => {
        grid.outerHTML = ui.error(error, false);
      });
  }

  // ===== Resultados =====
  const results = document.querySelector("[data-results]");
  if (results) {
    ui.mount(results, async () => {
      if (!session.token()) {
        let resumoHtml = "";
        try {
          const dados = await resumo();
          resumoHtml = `
            <article class="dash-card">
              <p class="eyebrow">PARTICIPAÇÃO EM TEMPO REAL</p>
              <h2>${escapeHtml(dados.eleicao.titulo)}</h2>
              <div class="facts">
                <div><b>${number(dados.eleitores)}</b><small>eleitores</small></div>
                <div><b>${number(dados.votos)}</b><small>votos</small></div>
                <div><b>${percent(dados.participacao)}</b><small>participação</small></div>
              </div>
            </article>`;
        } catch { }
        results.innerHTML = `
          ${resumoHtml}
          <article class="dash-card">
            <h2>Resultados detalhados</h2>
            <p>Os resultados por candidatura estão disponíveis na área reservada.</p>
            <a class="button button-primary" href="login.html?area=eleitor">Iniciar sessão →</a>
          </article>`;
        return;
      }

      const lista = (await api.eleicoes.listar()).filter((e) => ["em_curso", "encerrada"].includes(e.estado));
      if (!lista.length) {
        results.innerHTML = ui.empty("Ainda não existem resultados.", "Os resultados aparecem quando uma eleição começa.");
        return;
      }
      const blocos = await Promise.all(
        lista.map(async (e) => {
          const { data, error } = await api.votacao.resultados(e.id).then(
            (d) => ({ data: d, error: null }),
            (err) => ({ data: null, error: err })
          );
          return resultsCard(e, data, error);
        })
      );
      results.innerHTML = blocos.join("");
    });
  }

  function resultsCard(eleicao, rondas, error) {
    const body = error
      ? `<p class="form-message">${escapeHtml(error.message)}</p>`
      : (rondas || [])
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
    return `
      <article class="dash-card">
        <div class="heading-row">
          <h2>${escapeHtml(eleicao.titulo)}</h2>
          <span class="status-pill"><i></i> ${elections.statusLabels[eleicao.estado] || eleicao.estado}</span>
        </div>
        ${body}
      </article>`;
  }

  // ===== Transparência: estado dos servidores =====
  const status = document.querySelector("[data-transparency]");
  if (status) {
    ui.mount(status, async () => {
      const amostras = [];
      for (let i = 0; i < 4; i++) amostras.push(await api.health());
      const instancias = [...new Set(amostras.map((a) => a.data && a.data.instance).filter(Boolean))];
      const ok = amostras.every((a) => a.ok);
      const media = Math.round(amostras.reduce((s, a) => s + a.latency, 0) / amostras.length);
      status.innerHTML = `
        <div class="audit-list">
          <p><i>${ok ? "✓" : "!"}</i> API ${ok ? "disponível" : "com falhas"} · ${media} ms de latência média</p>
          <p><i>${instancias.length > 1 ? "✓" : "!"}</i> ${instancias.length || "—"} instância(s) a responder: ${escapeHtml(instancias.join(", ") || "—")}</p>
          <p><i>${amostras.some((a) => a.data && a.data.database === "ok") ? "✓" : "!"}</i> Base de dados ${amostras.some((a) => a.data && a.data.database === "ok") ? "ligada" : "sem resposta"}</p>
        </div>`;
    });
  }
});
