/* Controller · área da equipa, dentro de uma eleição: candidatos, caderno eleitoral e rondas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, elections, download } = TV;
  const { fullDate, slug } = TV.format;
  const { panel } = TV.panels;
  const team = (TV.team = TV.team || {});

  const box = (name) => panel("elections").querySelector(`[data-${name}-card]`);

  // Mostra o erro numa notificação em vez de parar a página
  const safely = (fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      ui.toast(error.message, true);
    }
  };

  // ===== Candidatos =====
  team.renderCandidatesCard = function renderCandidatesCard(e) {
    const el = box("candidates");
    el.innerHTML = TV.teamView.candidatesCard(e);

    const reload = async () => renderCandidatesCard(elections.view(await api.eleicoes.detalhe(e.id)));

    el.querySelector("[data-cand-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      await safely(async () => {
        await ui.busy(f.querySelector("button"), "A adicionar…", () =>
          api.eleicoes.criarCandidato(e.id, {
            nome: f.nome.value.trim(),
            partido: f.partido.value.trim() || null,
            descricao: f.descricao.value.trim() || null,
          })
        );
        await reload();
      })();
    });
    el.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", safely(async () => {
        await api.eleicoes.atualizarCandidato(e.id, b.dataset.toggle, { ativo: b.dataset.ativo !== "true" });
        await reload();
      }))
    );
    el.querySelectorAll("[data-remove-cand]").forEach((b) =>
      b.addEventListener("click", safely(async () => {
        await api.eleicoes.apagarCandidato(e.id, b.dataset.removeCand);
        await reload();
      }))
    );
  };

  // ===== Caderno eleitoral: quem pode votar =====
  team.renderVotersCard = async function renderVotersCard(e) {
    const el = box("voters");
    await ui.mount(el, async () => {
      const [habilitados, todos] = await Promise.all([api.eleicoes.habilitados(e.id), api.utilizadores.listar("eleitor")]);
      const ids = new Set(habilitados.map((h) => h.utilizador_id));
      const livres = todos.filter((u) => !ids.has(u.id) && u.ativo);

      el.innerHTML = TV.teamView.votersCard(habilitados, livres);

      const reload = () => renderVotersCard(e);
      // Exporta só quem pode votar (não inclui votos)
      el.querySelector("[data-voter-csv]")?.addEventListener("click", () =>
        download.csv(`caderno-eleitoral-${slug(e.titulo)}`, ["Nome", "E-mail", "Habilitado em"], habilitados.map((h) => [h.nome, h.email, fullDate(h.data)]))
      );
      el.querySelector("[data-voter-all]")?.addEventListener("click", safely(async (event) => {
        const r = await ui.busy(event.currentTarget, "A habilitar…", () => api.eleicoes.habilitar(e.id, livres.map((u) => u.id)));
        ui.toast(`${r.adicionados} eleitor(es) habilitado(s).`);
        reload();
      }));
      el.querySelector("[data-voter-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        safely(async () => {
          await api.eleicoes.habilitar(e.id, [Number(event.currentTarget.uid.value)]);
          reload();
        })();
      });
      el.querySelectorAll("[data-unvoter]").forEach((b) =>
        b.addEventListener("click", safely(async () => {
          await api.eleicoes.desabilitar(e.id, b.dataset.unvoter);
          reload();
        }))
      );
    });
  };

  // ===== Rondas: abrir, encerrar e criar a 2.ª volta =====
  team.renderRoundsCard = function renderRoundsCard(e) {
    const el = box("rounds");
    const rondas = [...(e.rondas || [])].sort((a, b) => a.numero - b.numero);
    const podeSegunda = e.estado === "em_curso" && rondas.length === 1 && rondas[0].estado !== "aberta";
    const ativos = (e.candidatos || []).filter((c) => c.ativo);

    el.innerHTML = TV.teamView.roundsCard(e, rondas, podeSegunda, ativos);

    el.querySelectorAll("[data-round]").forEach((b) =>
      b.addEventListener("click", safely(async () => {
        await api.eleicoes.acaoRonda(e.id, b.dataset.round, b.dataset.roundAction);
        team.renderElectionForm(e.id);
      }))
    );
    el.querySelector("[data-second-round]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      const ids = [...f.querySelectorAll('[name="cand"]:checked')].map((i) => Number(i.value));
      if (ids.length !== 2) return ui.toast("Escolha exatamente 2 candidatos.", true);
      await safely(async () => {
        await api.eleicoes.criarRonda(e.id, {
          data_inicio: elections.fromLocalInput(f.inicio.value),
          data_fim: elections.fromLocalInput(f.fim.value),
          candidato_ids: ids,
        });
        ui.toast("2.ª volta criada.");
        team.renderElectionForm(e.id);
      })();
    });
  };
})();
