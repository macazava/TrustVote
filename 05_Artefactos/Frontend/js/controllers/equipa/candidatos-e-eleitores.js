/* Controller · área da equipa, separadores "Candidatos" (por eleição) e "Eleitores" (contas) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, session } = TV;
  const { panel, go } = TV.panels;
  const team = (TV.team = TV.team || {});

  // ===== Candidatos: escolhe a eleição e mostra a tabela =====
  team.renderCandidates = async function renderCandidates() {
    const el = panel("candidates");
    const lista = await api.eleicoes.listar();
    el.innerHTML = TV.teamView.candidatesPage(lista);

    const select = el.querySelector("[data-cand-election]");
    if (!select) return;
    const table = el.querySelector("[data-cand-table]");
    const load = () =>
      ui.mount(table, async () => {
        table.innerHTML = TV.teamView.candidatesTable(await api.eleicoes.detalhe(select.value));
        table.querySelector("[data-manage]").addEventListener("click", () => {
          go("elections");
          team.renderElectionForm(Number(select.value));
        });
      });
    select.addEventListener("change", load);
    load();
  };

  // ===== Eleitores: filtra por perfil, suspende/reativa e muda o perfil =====
  team.renderVoters = async function renderVoters() {
    const el = panel("voters");
    el.innerHTML = TV.teamView.votersPage();

    const select = el.querySelector("[data-profile]");
    const box = el.querySelector("[data-users]");
    const load = () =>
      ui.mount(box, async () => {
        const lista = await api.utilizadores.listar(select.value || undefined);
        box.innerHTML = TV.teamView.usersTable(lista, session.user);
        box.querySelectorAll("[data-user]").forEach((b) =>
          b.addEventListener("click", async () => {
            try {
              await ui.busy(b, "…", () => api.utilizadores.atualizar(b.dataset.user, JSON.parse(b.dataset.patch)));
              ui.toast("Conta atualizada.");
              load();
            } catch (error) {
              ui.toast(error.message, true);
            }
          })
        );
      });
    select.addEventListener("change", load);
    load();
  };
})();
