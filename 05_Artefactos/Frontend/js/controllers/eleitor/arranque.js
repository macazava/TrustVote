/* Controller · arranque da área do eleitor: confirma a sessão, preenche o cabeçalho e carrega as eleições */
document.addEventListener("DOMContentLoaded", async () => {
  const TV = window.TrustVote;
  const { session, ui, elections, voter } = TV;
  const { escapeHtml, time, initials, countdown } = TV.format;
  const { panel, go } = TV.panels;

  const wrap = document.querySelector(".dashboard-wrap");

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
  const exp = (session.claims() || {}).exp;
  document.querySelector("[data-session-chip]").textContent = exp ? `SESSÃO ATÉ ${time(new Date(exp * 1000).toISOString())}` : "SESSÃO SEGURA";
  const year = user.data_registo ? new Date(user.data_registo).getFullYear() : "";
  document.querySelector("[data-user-chip]").innerHTML =
    `<span class="avatar">${escapeHtml(initials(user.nome))}</span><span><b>${escapeHtml(user.nome)}</b><small>ELEITOR${year ? ` · ${year}` : ""}</small></span>`;
  document.querySelector("[data-logout]").addEventListener("click", session.logout);

  // Botões data-go="separador" dentro do conteúdo (ex.: "Ver recibo")
  document.querySelector(".dashboard-content").addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) go(target.dataset.go);
    const copiar = event.target.closest("[data-copy]");
    if (copiar) ui.copy(copiar.dataset.copy);
  });

  // Contagens decrescentes ("Termina em 01d : 23h : 59m")
  setInterval(() => {
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      el.textContent = countdown(el.dataset.countdown);
    });
  }, 30000);

  // ===== Separadores =====
  voter.renderProfile();
  voter.loadReceipts();
  wrap.classList.add("is-ready");

  async function loadAll() {
    voter.state.lista = await elections.loadForVoter();
    voter.renderOverview();
    voter.renderElections();
    voter.renderPoll();
    voter.renderResults();
    voter.renderProfile();
    renderHelp();
  }

  // ===== Ajuda: eleição em destaque e regras lidas da API =====
  const config = TV.api.publico.configuracao().catch(() => null);
  async function renderHelp() {
    panel("help").innerHTML = TV.voterView.helpPage({
      e: voter.featured(),
      config: await config,
      fimSessao: exp ? time(new Date(exp * 1000).toISOString()) : null,
    });
    voter.bindVoteButtons(panel("help"));
  }

  panel("overview").innerHTML = ui.loading("A carregar as suas eleições…");
  panel("help").innerHTML = ui.loading();
  try {
    await loadAll();
  } catch (error) {
    renderHelp();
    panel("overview").innerHTML = ui.error(error);
    panel("overview").querySelector("[data-retry]").addEventListener("click", () => loadAll().catch((e) => ui.toast(e.message, true)));
  }
});
