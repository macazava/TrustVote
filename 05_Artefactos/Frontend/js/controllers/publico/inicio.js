/* Controller · página inicial: estado da eleição, eleição em tempo real, avisos e fecho da última eleição */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const { api, format, elections, publicView, ui } = TV;
  const { number, percent, dateTime, escapeHtml } = format;

  const alert = document.querySelector(".election-alert");
  const hub = document.querySelector("[data-hub-election]");
  const news = document.querySelector("[data-news]");
  const lastCount = document.querySelector("[data-last-count]");
  const liveTitle = document.querySelector("[data-live-title]");

  // ===== Aviso no topo: o estado da eleição fica visível logo à entrada =====
  function showAlert(eleicao, online) {
    if (!alert) return;
    const titulo = alert.querySelector("small");
    const texto = alert.querySelector("b");
    if (!eleicao) {
      titulo.textContent = online ? "ELEIÇÕES" : "SERVIDOR INDISPONÍVEL";
      texto.textContent = online ? "Consulte o calendário eleitoral" : "Não foi possível obter o estado da eleição";
      return;
    }
    const porEstado = {
      em_curso: ["VOTAÇÃO ABERTA", `${eleicao.titulo} · até ${dateTime(eleicao.data_fim)}`],
      agendada: ["PRÓXIMA ELEIÇÃO · AGENDADA", `${eleicao.titulo} · abre a ${dateTime(eleicao.data_inicio)}`],
      encerrada: ["ÚLTIMA ELEIÇÃO · ENCERRADA", `${eleicao.titulo} · terminou a ${dateTime(eleicao.data_fim)}`],
    };
    const [estado, frase] = porEstado[eleicao.estado] || [elections.statusLabels[eleicao.estado] || "ELEIÇÕES", eleicao.titulo];
    titulo.textContent = estado;
    texto.textContent = frase;
  }

  // ===== Cartão da eleição =====
  function showHub(resumo, online) {
    if (!hub) return;
    const eleicao = resumo && resumo.eleicao;
    const pill = hub.querySelector(".status-pill");
    hub.querySelector("[data-retry]")?.remove();
    if (eleicao) {
      pill.outerHTML = TV.blocks.stateBadge(eleicao.estado);
      hub.querySelector("h3").textContent = eleicao.titulo;
      hub.querySelector("[data-hub-copy]").textContent =
        `Votação online para ${number(resumo.eleitores)} estudantes inscritos · ${dateTime(eleicao.data_inicio)} — ${dateTime(eleicao.data_fim)}.`;
      hub.querySelector("[data-hub-turnout]").textContent = percent(resumo.participacao);
      hub.querySelector("[data-hub-bar]").style.width = `${Math.min(100, resumo.participacao || 0)}%`;
      hub.querySelector("[data-hub-votes]").textContent = `${number(resumo.votos)} votos registados`;
    } else {
      pill.outerHTML = TV.blocks.stateBadge("indisponivel", online ? "SEM DADOS PÚBLICOS" : "SERVIDOR INDISPONÍVEL");
      hub.querySelector("h3").textContent = online ? "Sem eleições públicas" : "Eleição indisponível";
      hub.querySelector("[data-hub-copy]").textContent = online
        ? "Inicie sessão para consultar as eleições em que está habilitado."
        : "Não foi possível contactar o servidor TrustVote. Tente novamente dentro de momentos.";
      if (!online) {
        hub.querySelector("[data-hub-copy]").insertAdjacentHTML("beforeend", ' <button class="link-button" type="button" data-retry>Tentar novamente</button>');
        hub.querySelector("[data-retry]").addEventListener("click", (event) => {
          event.currentTarget.disabled = true;
          event.currentTarget.textContent = "A tentar…";
          carregar();
        });
      }
    }
  }

  // ===== Pedido à API (repete-se com "Tentar novamente") =====
  async function carregar() {
    const [resumo, health, historico] = await Promise.all([
      api.publico.resumo().catch(() => null),
      api.health().catch(() => null),
      api.publico.historico().catch(() => []),
    ]);
    const online = !!(health && health.ok);

    if (lastCount) lastCount.innerHTML = publicView.lastCount(historico[0]);
    if (liveTitle) liveTitle.textContent = resumo ? resumo.eleicao.titulo : "Sem eleição em destaque";

    showAlert(resumo && resumo.eleicao, online);
    showHub(resumo, online);
    if (news) news.innerHTML = resumo ? publicView.notices(resumo) : ui.empty("Sem avisos de momento");

    // Dados da simulação
    document.querySelectorAll("[data-live]").forEach((el) => {
      const key = el.dataset.live;
      const value = resumo ? resumo[key] : null;
      el.innerHTML = escapeHtml(key === "participacao" ? percent(value) : number(value));
    });

    // Os dados chegaram: tira os skeletons
    document.querySelectorAll("[data-skeleton]").forEach((el) => el.removeAttribute("data-skeleton"));
    ultimoResumo = resumo;
  }

  // ===== Ao vivo: cada voto novo atualiza a participação sem recarregar (Server-Sent Events) =====
  let ultimoResumo = null;
  TV.live.subscribe((dados) => {
    if (!dados || !ultimoResumo || dados.eleicao_id !== ultimoResumo.eleicao.id) return;
    if (dados.votos === ultimoResumo.votos && dados.estado === ultimoResumo.eleicao.estado) return;
    ultimoResumo = { ...ultimoResumo, ...dados, eleicao: { ...ultimoResumo.eleicao, estado: dados.estado } };
    showHub(ultimoResumo, true);
    document.querySelectorAll("[data-live]").forEach((el) => {
      const key = el.dataset.live;
      if (key in dados) el.innerHTML = escapeHtml(key === "participacao" ? percent(dados[key]) : number(dados[key]));
    });
  });

  carregar();
});
