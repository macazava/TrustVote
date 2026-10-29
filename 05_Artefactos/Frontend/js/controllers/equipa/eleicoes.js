/* Controller · área da equipa, separador "Eleições": lista de eleições e formulário para criar ou editar */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, elections } = TV;
  const { panel, attempt } = TV.panels;
  const team = (TV.team = TV.team || {});

  // Próximo estado de cada eleição: [ação na API, nome que aparece no menu]
  const transitions = {
    rascunho: ["agendar", "Agendada"],
    agendada: ["iniciar", "Em curso"],
    em_curso: ["encerrar", "Encerrada"],
  };
  const avisos = {
    agendar: "Os eleitores passam a ver a eleição e as datas. Os candidatos deixam de poder ser adicionados ou removidos.",
    iniciar: "A votação abre para os eleitores habilitados.",
    encerrar: "A votação fecha e já não é possível votar. Os resultados passam a ser finais.",
  };

  team.renderElectionList = async function renderElectionList() {
    const el = panel("elections");
    const lista = await api.eleicoes.listar();
    const detalhes = await Promise.all(lista.map((e) => api.eleicoes.detalhe(e.id).then(elections.view)));
    const stats = await Promise.all(detalhes.map((e) => (e.estado === "rascunho" ? { error: true } : attempt(api.votacao.estatisticas(e.id)))));

    el.innerHTML = TV.teamView.electionList(detalhes, stats);

    el.querySelector("[data-new]").addEventListener("click", () => team.renderElectionForm(null));
    el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => team.renderElectionForm(Number(b.dataset.edit))));
  };

  team.renderElectionForm = async function renderElectionForm(id) {
    const el = panel("elections");
    el.innerHTML = ui.loading();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const e = id ? elections.view(await api.eleicoes.detalhe(id)) : null;
    const editavel = !e || ["rascunho", "agendada"].includes(e.estado);
    const r1 = e && (e.rondas || []).find((r) => r.numero === 1);

    el.innerHTML = TV.teamView.electionForm(e, { editavel, r1, next: e && transitions[e.estado] });

    el.querySelector("[data-back]").addEventListener("click", () => ui.mount(el, team.renderElectionList));

    const form = el.querySelector("[data-election-form]");
    const message = form.querySelector(".form-message");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dados = { titulo: form.titulo.value.trim(), descricao: form.descricao.value.trim() || null };
      const datas = { data_inicio: elections.fromLocalInput(form.inicio.value), data_fim: elections.fromLocalInput(form.fim.value) };
      if (editavel && Date.parse(datas.data_fim) <= Date.parse(datas.data_inicio)) return ui.message(message, "O fim tem de ser depois do início.");
      // Mudar o estado (agendar, iniciar, encerrar) pede confirmação antes de gravar
      const mudanca = e && form.estado.value && transitions[e.estado];
      if (mudanca && !(await ui.confirm({ title: `Passar a eleição para "${mudanca[1]}"?`, text: avisos[mudanca[0]], ok: `Sim, ${mudanca[0]}` }))) return;
      try {
        await ui.busy(form.querySelector('[type="submit"]'), "A guardar…", async () => {
          if (!e) {
            const nova = await api.eleicoes.criar(dados);
            await api.eleicoes.criarRonda(nova.id, datas);
            id = nova.id;
          } else {
            if (editavel) {
              await api.eleicoes.atualizar(e.id, dados);
              if (r1) await api.eleicoes.atualizarRonda(e.id, 1, datas);
              else await api.eleicoes.criarRonda(e.id, datas);
            }
            if (form.estado.value) await api.eleicoes.acao(e.id, form.estado.value);
          }
        });
        ui.toast(e ? "Eleição atualizada." : "Eleição criada. Adicione candidatos e eleitores.");
        renderElectionForm(id);
      } catch (error) {
        ui.message(message, error.message);
      }
    });

    el.querySelector("[data-remove]")?.addEventListener("click", async () => {
      if (!(await ui.confirm({ title: "Apagar esta eleição?", text: "A eleição em rascunho e os seus candidatos são apagados. Esta ação não pode ser desfeita.", ok: "Apagar", danger: true }))) return;
      try {
        await api.eleicoes.apagar(e.id);
        ui.toast("Eleição apagada.");
        ui.mount(el, team.renderElectionList);
      } catch (error) {
        ui.message(message, error.message);
      }
    });

    // Os três cartões de baixo estão em eleicao-detalhes.js
    if (e) {
      team.renderCandidatesCard(e);
      team.renderVotersCard(e);
      team.renderRoundsCard(e);
    }
  };
})();
