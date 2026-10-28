/* Controller · área do eleitor: "Visão geral", lista de eleições e detalhes de uma eleição */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { session, localReceipts } = TV;
  const { dateTime } = TV.format;
  const { panel, go } = TV.panels;

  // Estado partilhado pelos controllers do eleitor: as eleições carregadas no arranque
  const voter = (TV.voter = TV.voter || {});
  voter.state = { lista: [] };

  // A eleição a mostrar em destaque: a que está a decorrer, senão a próxima
  voter.featured = () => voter.state.lista.find((e) => e.estado === "em_curso") || voter.state.lista.find((e) => e.estado === "agendada") || null;

  // Botões "Iniciar votação" e "Ver detalhes" dentro de um bloco
  voter.bindVoteButtons = function bindVoteButtons(root) {
    root.querySelectorAll("[data-vote]").forEach((b) =>
      b.addEventListener("click", () => {
        go("elections");
        voter.openBallot(Number(b.dataset.vote));
      })
    );
    root.querySelectorAll("[data-details]").forEach((b) => b.addEventListener("click", () => voter.openDetails(Number(b.dataset.details))));
  };

  // ===== Visão geral =====
  voter.renderOverview = function renderOverview() {
    const e = voter.featured();
    const hora = new Date().getHours();
    const subtitulo = !e
      ? "Não tens eleições ativas de momento."
      : e.votou
        ? "O teu voto já foi registado. Obrigado por participares."
        : e.aberta
          ? "Tens uma eleição académica à espera do teu voto."
          : `A próxima eleição começa a ${dateTime(e.inicio)}.`;

    panel("overview").innerHTML = TV.voterView.overviewPage({
      e,
      recibos: localReceipts.all(),
      user: session.user,
      hoje: new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }),
      saudacao: hora < 12 ? "Bom dia" : hora < 20 ? "Boa tarde" : "Boa noite",
      subtitulo,
    });
    voter.bindVoteButtons(panel("overview"));
  };

  // ===== Eleições =====
  voter.renderElections = function renderElections() {
    const el = panel("elections");
    const { lista } = voter.state;
    el.innerHTML = TV.voterView.electionsPage(
      lista.filter((e) => e.estado !== "encerrada"),
      lista.filter((e) => e.estado === "encerrada")
    );
    voter.bindVoteButtons(el);
  };

  voter.openDetails = function openDetails(id) {
    const e = voter.state.lista.find((x) => x.id === id);
    const el = panel("elections");
    window.scrollTo({ top: 0, behavior: "smooth" });
    el.innerHTML = TV.voterView.detailsPage(e);
    el.querySelector("[data-back]").addEventListener("click", voter.renderElections);
    voter.bindVoteButtons(el);
  };
})();
