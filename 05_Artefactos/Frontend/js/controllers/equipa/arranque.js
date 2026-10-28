/* Controller · arranque da área da equipa: confirma a sessão, preenche o cabeçalho e carrega os separadores */
document.addEventListener("DOMContentLoaded", async () => {
  const TV = window.TrustVote;
  const { session, ui, team } = TV;
  const { escapeHtml, time, initials } = TV.format;
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
  const exp = (session.claims() || {}).exp;
  document.querySelector("[data-session-chip]").textContent = exp ? `SESSÃO ATÉ ${time(new Date(exp * 1000).toISOString())}` : "SESSÃO SEGURA";
  document.querySelector("[data-user-chip]").innerHTML =
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

  // Atualiza a visão geral a cada 20 s
  setInterval(() => {
    if (panel("overview").classList.contains("active") && !document.hidden) team.renderOverview().catch(() => { });
  }, 20000);
});
