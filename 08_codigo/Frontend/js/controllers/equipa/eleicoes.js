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
    encerrar: "A votação fecha, já não é possível votar e os votos são apurados. Os resultados passam a ser finais.",
  };

  // As tarefas automáticas do servidor correm a cada 30 s: depois da hora, espera-se um pouco mais
  const ATRASO_SERVIDOR = 35000;

  // Um só relógio por separador: cada novo ecrã cancela o anterior
  let relogio = null;
  function tick(raiz, fn, ms) {
    clearInterval(relogio);
    relogio = setInterval(() => (raiz.isConnected ? fn() : clearInterval(relogio)), ms);
  }

  // Data local no formato do <input type="datetime-local">
  const toInput = (date) => elections.toLocalInput(date.toISOString());
  // Agora + n minutos, arredondado ao minuto seguinte
  const daquiA = (min) => {
    const d = new Date(Date.now() + min * 6e4);
    d.setSeconds(0, 0);
    return new Date(d.getTime() + 6e4);
  };

  team.renderElectionList = async function renderElectionList() {
    const el = panel("elections");
    const lista = await api.eleicoes.listar();
    const detalhes = await Promise.all(lista.map((e) => api.eleicoes.detalhe(e.id).then(elections.view)));
    const stats = await Promise.all(detalhes.map((e) => (e.estado === "rascunho" ? { error: true } : attempt(api.votacao.estatisticas(e.id)))));

    el.innerHTML = TV.teamView.electionList(detalhes, stats);

    el.querySelector("[data-new]").addEventListener("click", () => team.renderElectionForm(null));
    el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => team.renderElectionForm(Number(b.dataset.edit))));

    // Contagens decrescentes; quando uma chega a zero, o servidor abre ou encerra a eleição
    // sozinho e a lista recarrega-se para mostrar o novo estado.
    const raiz = el.querySelector("[data-new]");
    let recarregar = null;
    const atualizar = () => {
      el.querySelectorAll("[data-countdown]").forEach((b) => {
        const passou = Date.parse(b.dataset.countdown) <= Date.now();
        b.textContent = passou ? "a atualizar…" : TV.format.countdown(b.dataset.countdown);
        if (passou && !recarregar)
          recarregar = setTimeout(() => raiz.isConnected && ui.mount(el, team.renderElectionList), ATRASO_SERVIDOR);
      });
    };
    atualizar();
    tick(raiz, atualizar, 15000);
  };

  team.renderElectionForm = async function renderElectionForm(id) {
    const el = panel("elections");
    clearInterval(relogio);
    el.innerHTML = ui.loading();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const e = id ? elections.view(await api.eleicoes.detalhe(id)) : null;
    const editavel = !e || ["rascunho", "agendada"].includes(e.estado);
    const r1 = e && (e.rondas || []).find((r) => r.numero === 1);

    el.innerHTML = TV.teamView.electionForm(e, { editavel, r1, next: e && transitions[e.estado] });

    el.querySelector("[data-back]").addEventListener("click", () => ui.mount(el, team.renderElectionList));

    const form = el.querySelector("[data-election-form]");
    const message = form.querySelector(".form-message");
    const preview = form.querySelector("[data-preview]");
    const autoClose = form.querySelector("[data-auto-close]");
    const range = form.querySelector("[data-quorum-range]");
    const chips = [...form.querySelectorAll("[data-duration]")];

    const isAuto = () => autoClose.getAttribute("aria-checked") === "true";
    const minutos = () => (Date.parse(form.fim.value) - Date.parse(form.inicio.value)) / 6e4;

    // Resumo ao vivo e atalho de duração ativo
    function refresh() {
      preview.innerHTML = TV.teamView.electionPreview({
        titulo: form.titulo.value.trim(),
        estado: e ? e.estado : "rascunho",
        inicio: form.inicio.value,
        fim: form.fim.value,
        quorum: form.quorum.value,
        auto: isAuto(),
      });
      const atual = minutos();
      chips.forEach((c) => c.setAttribute("aria-pressed", String(Number(c.dataset.duration) === atual)));
    }
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);

    // Atalhos de calendário: abrir daqui a 5 min, e a duração conta a partir da abertura
    form.querySelector("[data-start-now]")?.addEventListener("click", () => {
      const duracao = minutos() > 0 ? minutos() : 1440;
      const inicio = daquiA(5);
      form.inicio.value = toInput(inicio);
      form.fim.value = toInput(new Date(inicio.getTime() + duracao * 6e4));
      refresh();
    });
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        if (!form.inicio.value) form.inicio.value = toInput(daquiA(5));
        form.fim.value = toInput(new Date(Date.parse(form.inicio.value) + Number(chip.dataset.duration) * 6e4));
        refresh();
      })
    );

    // Quórum: barra e número sempre iguais
    range?.addEventListener("input", () => (form.quorum.value = range.value));
    form.quorum.addEventListener("input", () => (range.value = form.quorum.value || 0));

    autoClose.addEventListener("click", () => {
      autoClose.setAttribute("aria-checked", String(!isAuto()));
      refresh();
    });

    refresh();
    tick(form, refresh, 30000);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dados = {
        titulo: form.titulo.value.trim(),
        descricao: form.descricao.value.trim() || null,
        quorum: Number(form.quorum.value || 0),
        encerramento_automatico: isAuto(),
      };
      const datas = { data_inicio: elections.fromLocalInput(form.inicio.value), data_fim: elections.fromLocalInput(form.fim.value) };
      if (editavel) {
        if (dados.titulo.length < 3) return ui.message(message, "O título precisa de pelo menos 3 caracteres.");
        if (Date.parse(datas.data_fim) <= Date.parse(datas.data_inicio)) return ui.message(message, "A hora de fecho tem de ser depois da abertura.");
        if (Date.parse(datas.data_fim) <= Date.now()) return ui.message(message, "A hora de fecho já passou. Escolha uma data no futuro.");
      }
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
