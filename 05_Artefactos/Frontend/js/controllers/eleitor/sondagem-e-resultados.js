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
    let marcado = false;
    const carregar = () =>
      ui.mount(body, async () => {
        const s = await api.sondagem.obter(e.id);
        if (!marcado) el.querySelector(".page-head").insertAdjacentHTML("beforeend", view.modelTag(s));
        marcado = true;
        body.innerHTML = view.pollBody(e, s);
        body.querySelector("[data-poll-form]")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const message = form.querySelector(".form-message");
          try {
            await ui.busy(form.querySelector("button"), "A enviar…", () => api.sondagem.responder(e.id, Number(form.poll.value)));
            ui.toast("Obrigado! A sua resposta foi incluída na projeção.");
            carregar();
          } catch (error) {
            ui.message(message, error.message);
          }
        });
      });
    carregar();
  };

  // ===== Resultados: um quadro por eleição em curso ou encerrada (views/resultados.js) =====
  voter.renderResults = function renderResults() {
    const el = panel("results");
    const view = TV.voterView;
    const quadro = TV.resultsView;
    const comResultados = voter.state.lista.filter((e) => ["em_curso", "encerrada"].includes(e.estado));
    if (!comResultados.length) {
      el.innerHTML = view.resultsHead() + view.emptyCard("Resultados ainda não disponíveis", "Os resultados aparecem quando uma eleição começa.");
      return;
    }
    // Primeiro as que já têm resultados (encerradas), depois as que estão a decorrer
    comResultados.sort((a, b) => (a.estado === "encerrada" ? 0 : 1) - (b.estado === "encerrada" ? 0 : 1));
    el.innerHTML = view.resultsHead() + comResultados.map((e) => `<div data-result="${e.id}"></div>`).join("");
    // Participação ao vivo da eleição em destaque (pública), mostrada enquanto os resultados não saem
    const aoVivo = api.publico.resumo().catch(() => null);
    comResultados.forEach((e) => {
      const slot = el.querySelector(`[data-result="${e.id}"]`);
      ui.mount(slot, async () => {
        try {
          slot.innerHTML = quadro.board(e, await api.votacao.resultados(e.id));
        } catch (error) {
          // 409: a votação ainda está aberta (aviso normal); outros erros mostram "Tentar novamente"
          if (error.status !== 409) throw error;
          const dados = await aoVivo;
          slot.innerHTML = quadro.pending(e, { aoVivo: dados && dados.eleicao.id === e.id ? dados : null });
        }
      });
    });
  };
})();
