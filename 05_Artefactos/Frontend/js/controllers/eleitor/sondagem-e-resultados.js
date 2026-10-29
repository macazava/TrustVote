/* Controller · área do eleitor, separadores "Sondagem IA" e "Resultados" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // ===== Sondagem =====
  voter.renderPoll = function renderPoll() {
    const el = panel("poll");
    const view = TV.voterView;
    const e = voter.featured();
    if (!e) {
      el.innerHTML = view.pollHead() + view.emptyCard("Sem eleição para projetar");
      return;
    }
    el.innerHTML = view.pollHead() + `<div data-poll-body></div>`;
    const body = el.querySelector("[data-poll-body]");
    ui.mount(body, async () => {
      const s = await api.sondagem.obter(e.id);
      el.querySelector(".page-head").insertAdjacentHTML("beforeend", view.modelTag(s));
      body.innerHTML = view.pollBody(e, s);
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
  };

  // ===== Resultados: um cartão por eleição em curso ou encerrada =====
  voter.renderResults = function renderResults() {
    const el = panel("results");
    const view = TV.voterView;
    const comResultados = voter.state.lista.filter((e) => ["em_curso", "encerrada"].includes(e.estado));
    if (!comResultados.length) {
      el.innerHTML = view.resultsHead() + view.emptyCard("Resultados ainda não disponíveis", "Os resultados aparecem quando uma eleição começa.");
      return;
    }
    el.innerHTML = view.resultsHead() + comResultados.map(view.resultsSlot).join("");
    comResultados.forEach((e) => {
      const card = el.querySelector(`[data-result="${e.id}"]`);
      ui.mount(card, async () => {
        card.innerHTML = view.resultsCard(e, await api.votacao.resultados(e.id));
      });
    });
  };
})();
