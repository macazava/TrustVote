/* Controller · página inicial: estado da eleição, números e eleição em tempo real */
document.addEventListener("DOMContentLoaded", () => {
  const { api, format, elections, publicView, ui } = window.TrustVote;
  const { number, percent, dateTime, escapeHtml } = format;

  const alert = document.querySelector(".election-alert");
  const metrics = document.querySelector(".metrics");
  const hub = document.querySelector("[data-hub-election]");
  const news = document.querySelector("[data-news]");

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
    pill.classList.toggle("status-warn", !eleicao);
    if (eleicao) {
      pill.innerHTML = `<i></i> ${elections.statusLabels[eleicao.estado] || eleicao.estado}`;
      hub.querySelector("h3").textContent = eleicao.titulo;
      hub.querySelector("[data-hub-copy]").textContent =
        `Votação online para ${number(resumo.eleitores)} estudantes inscritos · ${dateTime(eleicao.data_inicio)} — ${dateTime(eleicao.data_fim)}.`;
      hub.querySelector("[data-hub-turnout]").textContent = percent(resumo.participacao);
      hub.querySelector("[data-hub-bar]").style.width = `${Math.min(100, resumo.participacao || 0)}%`;
      hub.querySelector("[data-hub-votes]").textContent = `${number(resumo.votos)} votos registados`;
    } else {
      pill.innerHTML = `<i></i> ${online ? "SEM DADOS PÚBLICOS" : "SERVIDOR INDISPONÍVEL"}`;
      hub.querySelector("[data-hub-copy]").textContent = online
        ? "Inicie sessão para consultar as eleições em que está habilitado."
        : "Não foi possível contactar o servidor TrustVote. Tente novamente dentro de momentos.";
    }
  }

  // ===== Pedido à API (repete-se com "Tentar novamente") =====
  async function carregar() {
    const [resumo, health] = await Promise.all([api.publico.resumo().catch(() => null), api.health().catch(() => null)]);
    const online = !!(health && health.ok);

    showAlert(resumo && resumo.eleicao, online);
    showHub(resumo, online);
    if (news) news.innerHTML = resumo ? publicView.notices(resumo) : ui.empty("Sem avisos de momento");

    if (metrics) {
      metrics.innerHTML = publicView.metrics(resumo, online);
      if (!resumo) {
        metrics.querySelector("p").insertAdjacentHTML("beforeend", ' <button class="link-button" type="button" data-retry>Tentar novamente</button>');
        metrics.querySelector("[data-retry]").addEventListener("click", (event) => {
          event.currentTarget.disabled = true;
          event.currentTarget.textContent = "A tentar…";
          carregar();
        });
      }
    }

    // Dados da simulação
    document.querySelectorAll("[data-live]").forEach((el) => {
      const key = el.dataset.live;
      const value = resumo ? resumo[key] : null;
      el.innerHTML = escapeHtml(key === "participacao" ? percent(value) : number(value));
    });
  }

  carregar();
});
