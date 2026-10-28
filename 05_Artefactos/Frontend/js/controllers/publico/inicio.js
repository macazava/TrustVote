/* Controller · página inicial: números e eleição em tempo real */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, format, elections, publicView } = window.TrustVote;
  const { number, percent, dateTime, escapeHtml } = format;

  const [resumo, health] = await Promise.all([
    api.publico.resumo().catch(() => null),
    api.health().catch(() => null),
  ]);
  const online = !!(health && health.ok);
  const eleicao = resumo && resumo.eleicao;

  // ===== Aviso da próxima eleição =====
  const alert = document.querySelector(".election-alert");
  if (alert && eleicao) {
    const aberta = eleicao.estado === "em_curso";
    alert.querySelector("small").textContent = aberta ? "VOTAÇÃO A DECORRER" : "PRÓXIMA ELEIÇÃO";
    alert.querySelector("b").textContent = aberta
      ? `Votação aberta até ${dateTime(eleicao.data_fim)}`
      : `${eleicao.titulo} · início a ${dateTime(eleicao.data_inicio)}`;
  }

  // ===== Métricas =====
  const metrics = document.querySelector(".metrics");
  if (metrics) metrics.innerHTML = publicView.metrics(resumo, online);

  // ===== Cartão da eleição =====
  const hub = document.querySelector("[data-hub-election]");
  if (hub) {
    const pill = hub.querySelector(".status-pill");
    if (eleicao) {
      pill.innerHTML = `<i></i> ${elections.statusLabels[eleicao.estado] || eleicao.estado}`;
      hub.querySelector("h3").textContent = eleicao.titulo;
      hub.querySelector("[data-hub-copy]").textContent =
        `Votação online aberta a ${number(resumo.eleitores)} estudantes inscritos · ${dateTime(eleicao.data_inicio)} — ${dateTime(eleicao.data_fim)}.`;
      hub.querySelector("[data-hub-turnout]").textContent = percent(resumo.participacao);
      hub.querySelector("[data-hub-bar]").style.width = `${Math.min(100, resumo.participacao || 0)}%`;
      hub.querySelector("[data-hub-votes]").textContent = `${number(resumo.votos)} votos registados`;
    } else {
      pill.classList.add("status-warn");
      pill.innerHTML = `<i></i> ${online ? "SEM DADOS PÚBLICOS" : "SERVIDOR INDISPONÍVEL"}`;
      hub.querySelector("[data-hub-copy]").textContent = online
        ? "Inicie sessão para consultar as eleições em que está habilitado."
        : "Não foi possível contactar o servidor TrustVote.";
    }
  }

  // ===== Dados da simulação =====
  document.querySelectorAll("[data-live]").forEach((el) => {
    const key = el.dataset.live;
    const value = resumo ? resumo[key] : null;
    el.innerHTML = escapeHtml(key === "participacao" ? percent(value) : number(value));
  });
});
