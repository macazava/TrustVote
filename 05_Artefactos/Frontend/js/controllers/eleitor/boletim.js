/* Controller · área do eleitor, boletim de voto: escolher → rever → depositar */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, localReceipts } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // ===== Rascunho do voto =====
  // A escolha marcada fica neste separador do navegador (sessionStorage) até depositar ou sair.
  // Se a sessão expirar a meio, ao voltar a entrar o boletim abre com a mesma opção marcada.
  const RASCUNHO = "trustvote:rascunho-voto";
  const rascunho = {
    ler(eleicaoId) {
      try {
        const r = JSON.parse(sessionStorage.getItem(RASCUNHO) || "null");
        return r && r.eleicao === eleicaoId ? r.candidato : null;
      } catch {
        return null;
      }
    },
    guardar(eleicaoId, candidatoId) {
      try {
        sessionStorage.setItem(RASCUNHO, JSON.stringify({ eleicao: eleicaoId, candidato: candidatoId }));
      } catch { }
    },
    apagar() {
      try {
        sessionStorage.removeItem(RASCUNHO);
      } catch { }
    },
  };

  // Passo 1: escolher (escolhidoId mantém a opção marcada ao voltar de "Alterar escolha")
  voter.openBallot = function openBallot(id, escolhidoId = null) {
    const e = voter.state.lista.find((x) => x.id === id);
    const el = panel("elections");
    if (!e || !e.aberta) return voter.renderElections();
    window.scrollTo({ top: 0, behavior: "smooth" });

    const guardado = rascunho.ler(e.id);
    const recuperado = escolhidoId === null ? e.candidatosRonda.find((c) => String(c.id) === String(guardado)) : null;
    el.innerHTML = TV.voterView.ballotPage(e, recuperado ? recuperado.id : escolhidoId);
    if (recuperado) ui.message(el.querySelector("[data-ballot] .form-message"), "Recuperámos a opção que tinhas marcado antes de a sessão terminar.", true);

    el.querySelector("[data-back]").addEventListener("click", voter.renderElections);
    el.querySelector("[data-ballot]").addEventListener("change", (event) => {
      if (event.target.name === "candidate") rascunho.guardar(e.id, event.target.value);
    });
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
    rascunho.apagar();
    panel("elections").innerHTML = TV.voterView.donePage(recibo);
    voter.loadReceipts();
    voter.renderProfile();
  }
})();
