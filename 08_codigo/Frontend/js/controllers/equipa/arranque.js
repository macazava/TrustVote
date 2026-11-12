/* Controller · arranque da área da equipa: confirma a sessão, preenche o cabeçalho e carrega os separadores */
document.addEventListener("DOMContentLoaded", async () => {
  const TV = window.TrustVote;
  const { session, ui, team } = TV;
  const { escapeHtml, initials } = TV.format;
  const { panel, go } = TV.panels;

  const wrap = document.querySelector(".dashboard-wrap");

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
  const chip = document.querySelector("[data-user-chip]");
  chip.title = user.nome;
  chip.innerHTML =
    `<span class="avatar">${escapeHtml(initials(user.nome))}</span><span><b>${escapeHtml(user.nome)}</b><small>ADMINISTRADOR</small></span>`;
  document.querySelector("[data-logout]").addEventListener("click", session.logout);

  // Botões data-go="separador" dentro do conteúdo (ex.: "Ver todos os resultados")
  document.querySelector(".dashboard-content").addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) go(target.dataset.go);
  });

  // ===== Separadores =====
  wrap.classList.add("is-ready");
  team.renderSettings();

  const loaders = {
    overview: team.renderOverview,
    elections: team.renderElectionList,
    candidates: team.renderCandidates,
    voters: team.renderVoters,
    results: team.renderResults,
    messages: team.renderMessages,
    audit: team.renderAudit,
  };
  Object.entries(loaders).forEach(([name, load]) => ui.mount(panel(name), load));

  // Volta a carregar a vista quando é aberta no menu (menos Eleições, para não perder o formulário aberto)
  document.querySelectorAll(".panel-nav [data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      const load = loaders[button.dataset.view];
      if (load && button.dataset.view !== "elections") ui.mount(panel(button.dataset.view), load);
    })
  );

  // ===== Visão geral sempre atualizada =====
  // Ao vivo: quando entra um voto, o servidor avisa (Server-Sent Events) e a visão geral volta a carregar.
  // Sem ligação ao vivo, continua a atualizar a cada 20 s como antes.
  const atualizar = () => {
    if (panel("overview").classList.contains("active") && !document.hidden) team.renderOverview().catch(() => { });
  };
  let votos = null;
  let espera = 0;
  TV.live.subscribe((dados) => {
    const agora = dados ? `${dados.eleicao_id}:${dados.votos}:${dados.estado}` : null;
    if (votos !== null && agora !== votos) {
      clearTimeout(espera);
      espera = setTimeout(atualizar, 800); // junta vários votos seguidos numa só atualização
    }
    votos = agora;
  });
  setInterval(() => {
    if (!TV.live.ligado()) atualizar();
  }, 20000);
});
