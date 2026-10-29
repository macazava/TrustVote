/* Controller · páginas públicas: calendário, listas, resultados e transparência com dados da API */
document.addEventListener("DOMContentLoaded", () => {
  const { api, session, format, ui, publicView: view } = window.TrustVote;
  const { number, percent, date } = format;

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

      live.innerHTML = view.nextElection(e);

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
      .catch(() => { });
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
        // Um cartão por lista (campo "partido" da API)
        const listas = new Map();
        lista.forEach((c) => {
          const nome = c.partido || c.nome;
          if (!listas.has(nome)) listas.set(nome, []);
          listas.get(nome).push(c);
        });
        grid.innerHTML = [...listas].map(([nome, membros]) => view.listCard(nome, membros, dados.eleicao.titulo)).join("");
        const notice = grid.parentElement.querySelector(".notice");
        if (notice) notice.textContent = "Listas admitidas, obtidas a partir da plataforma.";
      })
      // Sem dados do servidor ficam os exemplos da página
      .catch(() => { });
  }

  // ===== Resultados =====
  const results = document.querySelector("[data-results]");
  if (results) {
    ui.mount(results, async () => {
      // Sem sessão: só a participação e um convite para entrar
      if (!session.token()) {
        let resumoHtml = "";
        try {
          resumoHtml = view.turnoutCard(await resumo());
        } catch { }
        results.innerHTML = `${resumoHtml}${view.loginForResults()}`;
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
          return view.resultsCard(e, data, error);
        })
      );
      results.innerHTML = blocos.join("");
    });
  }

  // ===== Transparência: estado dos servidores =====
  const status = document.querySelector("[data-transparency]");
  if (status) {
    ui.mount(status, async () => {
      const amostras = [];
      for (let i = 0; i < 4; i++) amostras.push(await api.health());
      status.innerHTML = view.serverStatus({
        ok: amostras.every((a) => a.ok),
        media: Math.round(amostras.reduce((s, a) => s + a.latency, 0) / amostras.length),
        instancias: [...new Set(amostras.map((a) => a.data && a.data.instance).filter(Boolean))],
        baseDados: amostras.some((a) => a.data && a.data.database === "ok"),
      });
    });
  }
});
