/* Controller · área do eleitor, boletim de voto: escolher → rever → depositar */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, localReceipts } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // Passo 1: escolher (escolhidoId mantém a opção marcada ao voltar de "Alterar escolha")
  voter.openBallot = function openBallot(id, escolhidoId = null) {
    const e = voter.state.lista.find((x) => x.id === id);
    const el = panel("elections");
    if (!e || !e.aberta) return voter.renderElections();
    window.scrollTo({ top: 0, behavior: "smooth" });

    el.innerHTML = TV.voterView.ballotPage(e, escolhidoId);

    el.querySelector("[data-back]").addEventListener("click", voter.renderElections);
    el.querySelector("[data-ballot]").addEventListener("submit", (event) => {
      event.preventDefault();
      const escolhido = event.currentTarget.candidate.value;
      if (!escolhido) return ui.message(event.currentTarget.querySelector(".form-message"), "Seleciona uma candidatura.");
      review(e, e.candidatosRonda.find((c) => String(c.id) === escolhido));
    });
  };

  // Passo 2: rever e depositar
  function review(e, candidato) {
    const el = panel("elections");
    el.innerHTML = TV.voterView.reviewPage(e, candidato);

    el.querySelector("[data-change]").addEventListener("click", () => voter.openBallot(e.id, candidato.id));
    el.querySelector("[data-deposit]").addEventListener("click", async (event) => {
      try {
        const res = await ui.busy(event.currentTarget, "A depositar…", () => api.votacao.votar(e.id, e.ronda.numero, candidato.id));
        const recibo = { eleicao_id: e.id, eleicao_titulo: e.titulo, ronda: e.ronda.numero, recibo: res.recibo, hash: res.hash, data: res.data };
        localReceipts.save(recibo);
        e.votou = true;
        done(recibo);
        voter.renderOverview();
      } catch (error) {
        // 409: este eleitor já tinha votado (ex.: pedido repetido) — o voto não conta duas vezes
        if (error.status === 409) {
          e.votou = true;
          voter.renderOverview();
          return done(null);
        }
        ui.message(el.querySelector("[data-vote-message]"), error.message);
      }
    });
  }

  // Passo 3: voto depositado
  function done(recibo) {
    panel("elections").innerHTML = TV.voterView.donePage(recibo);
    voter.loadReceipts();
  }
})();
