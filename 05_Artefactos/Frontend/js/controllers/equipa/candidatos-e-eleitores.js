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
        // Repor: o servidor gera uma palavra-passe temporária, mostrada uma única vez
        box.querySelectorAll("[data-reset]").forEach((b) =>
          b.addEventListener("click", async () => {
            const ok = await ui.confirm({
              title: `Repor a palavra-passe de ${b.dataset.nome}?`,
              text: "A palavra-passe atual deixa de funcionar.",
              ok: "Repor",
              danger: true,
            });
            if (!ok) return;
            try {
              const r = await ui.busy(b, "…", () => api.utilizadores.reporPassword(b.dataset.reset));
              await ui.confirm({
                title: "Palavra-passe temporária",
                text: `Entregue ao estudante: ${r.password_temporaria} — não volta a ser mostrada. Peça-lhe que a altere no Perfil.`,
                ok: "Fechar",
              });
              load();
            } catch (error) {
              ui.toast(error.message, true);
            }
          })
        );
      });
    select.addEventListener("change", load);
    load();
    renderEnrolled(el.querySelector("[data-enrolled]"));
  };

  // ===== Lista oficial de inscritos =====
  function renderEnrolled(box) {
    const reload = () => renderEnrolled(box);
    ui.mount(box, async () => {
      box.innerHTML = TV.teamView.enrolledCard(await api.inscritos.listar());

      const form = box.querySelector("[data-enroll-form]");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = form.querySelector(".form-message");
        const estudantes = form.linhas.value
          .split(/\r?\n/)
          .map((linha) => linha.split(/[;,\t]/).map((parte) => parte.trim()))
          .filter(([numero]) => numero)
          .map(([num_estudante, nome, curso]) => ({ num_estudante, nome: nome || null, curso: curso || null }));
        try {
          const r = await ui.busy(form.querySelector("button"), "A acrescentar…", () => api.inscritos.adicionar(estudantes));
          ui.toast(`${r.adicionados} acrescentado(s), ${r.ja_existiam} já existia(m).`);
          reload();
        } catch (error) {
          ui.message(message, error.message);
        }
      });
      box.querySelectorAll("[data-unenroll]").forEach((b) =>
        b.addEventListener("click", () =>
          ui.undoable({
            text: `Estudante ${b.dataset.unenroll} removido da lista.`,
            hide: [b.closest("tr")],
            commit: () => api.inscritos.remover(b.dataset.unenroll),
            after: reload,
          })
        )
      );
    });
  }
})();
