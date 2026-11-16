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
  // el: onde desenhar (por omissão, dentro do formulário da eleição; o separador "Candidatos" passa o seu)
  // onChange: chamado depois de cada alteração, com a eleição atualizada
  team.renderCandidatesCard = function renderCandidatesCard(e, el = box("candidates"), onChange) {
    el.innerHTML = TV.teamView.candidatesCard(e);

    const reload = async () => {
      const atual = elections.view(await api.eleicoes.detalhe(e.id));
      renderCandidatesCard(atual, el, onChange);
      onChange?.(atual);
    };

    const editor = el.querySelector("[data-cand-editor]");
    const form = el.querySelector("[data-cand-form]");
    const preview = el.querySelector("[data-cand-preview]");
    const novo = el.querySelector("[data-cand-new]");

    // Dados do formulário, no formato da API
    const ler = () => ({
      nome: form.nome.value.trim(),
      partido: form.partido.value.trim() || null,
      orgao: form.orgao.value,
      curso: form.curso.value.trim() || null,
      ano: form.ano.value ? Number(form.ano.value) : null,
      descricao: form.descricao.value.trim() || null,
    });

    const atualizarPreview = () => {
      if (!form) return;
      preview.innerHTML = TV.teamView.candidatePreview(ler());
      form.querySelector("[data-desc-count]").textContent = `${form.descricao.value.length} / 5000`;
    };

    // Abre o editor vazio (novo) ou com os dados de um candidato (editar)
    function abrir(c) {
      form.reset();
      form.candidato.value = c ? c.id : "";
      if (c) {
        form.nome.value = c.nome;
        form.partido.value = c.partido || "";
        form.orgao.value = c.orgao;
        form.curso.value = c.curso || "";
        form.ano.value = c.ano || "";
        form.descricao.value = c.descricao || "";
      }
      form.querySelector("[data-cand-form-title]").textContent = c ? `Editar ${c.nome}` : "Novo candidato";
      form.querySelector("[data-cand-submit]").innerHTML = c ? "Guardar alterações" : `Adicionar candidato ${TV.icon("arrow-right")}`;
      editor.hidden = false;
      if (novo) novo.hidden = true;
      atualizarPreview();
      editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      form.nome.focus({ preventScroll: true });
    }

    function fechar() {
      if (!(e.candidatos || []).length) return form.reset(), atualizarPreview();
      editor.hidden = true;
      if (novo) novo.hidden = false;
    }

    if (form) {
      atualizarPreview();
      form.addEventListener("input", atualizarPreview);
      form.addEventListener("change", atualizarPreview);
      novo?.addEventListener("click", () => abrir(null));
      el.querySelector("[data-cancel-cand]").addEventListener("click", fechar);
      form.addEventListener("keydown", (event) => event.key === "Escape" && fechar());

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.candidato.value;
        const dados = ler();
        await safely(async () => {
          await ui.busy(form.querySelector("[data-cand-submit]"), id ? "A guardar…" : "A adicionar…", () =>
            id ? api.eleicoes.atualizarCandidato(e.id, id, dados) : api.eleicoes.criarCandidato(e.id, dados)
          );
          ui.toast(id ? "Candidato atualizado." : `${dados.nome} adicionado.`);
          await reload();
        })();
      });
    }

    el.querySelectorAll("[data-edit-cand]").forEach((b) =>
      b.addEventListener("click", () => abrir(e.candidatos.find((x) => String(x.id) === b.dataset.editCand)))
    );

    // Interruptor ativo / inativo: muda logo no ecrã e grava no servidor
    el.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", safely(async () => {
        const ativo = b.dataset.ativo !== "true";
        b.setAttribute("aria-checked", String(ativo));
        b.closest("[data-cand-tile]").classList.toggle("is-off", !ativo);
        b.disabled = true;
        try {
          await api.eleicoes.atualizarCandidato(e.id, b.dataset.toggle, { ativo });
        } finally {
          await reload();
        }
      }))
    );

    // Remover: o cartão desaparece logo e há 6 s para "Desfazer" antes de apagar no servidor
    el.querySelectorAll("[data-remove-cand]").forEach((b) =>
      b.addEventListener("click", () => {
        const c = e.candidatos.find((x) => String(x.id) === b.dataset.removeCand);
        ui.undoable({
          text: `Candidato "${c ? c.nome : ""}" removido.`,
          hide: [b.closest("[data-cand-tile]")],
          commit: () => api.eleicoes.apagarCandidato(e.id, b.dataset.removeCand),
          after: reload,
        });
      })
    );

    // Pesquisa e filtro por órgão
    const pesquisa = el.querySelector("[data-cand-search]");
    const filtros = [...el.querySelectorAll("[data-cand-filter]")];
    let orgao = "";
    function filtrar() {
      const termo = (pesquisa?.value || "").trim().toLowerCase();
      let visiveis = 0;
      el.querySelectorAll("[data-cand-tile]").forEach((t) => {
        const ok = (!orgao || t.dataset.orgao === orgao) && (!termo || t.dataset.search.includes(termo));
        t.classList.toggle("is-filtered", !ok);
        visiveis += ok ? 1 : 0;
      });
      const vazio = el.querySelector("[data-cand-empty]");
      if (vazio) vazio.hidden = visiveis > 0;
    }
    pesquisa?.addEventListener("input", filtrar);
    filtros.forEach((f) =>
      f.addEventListener("click", () => {
        orgao = f.dataset.candFilter;
        filtros.forEach((x) => x.setAttribute("aria-pressed", String(x === f)));
        filtrar();
      })
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
        b.addEventListener("click", () =>
          ui.undoable({
            text: "Eleitor retirado do caderno eleitoral.",
            hide: [b.closest("tr")],
            commit: () => api.eleicoes.desabilitar(e.id, b.dataset.unvoter),
            after: reload,
          })
        )
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
        const abrir = b.dataset.roundAction === "abrir";
        const volta = b.dataset.round === "2" ? "2.ª volta" : "1.ª volta";
        const ok = await ui.confirm({
          title: `${abrir ? "Abrir" : "Encerrar"} a ${volta}?`,
          text: abrir ? "Os eleitores habilitados passam a poder votar nesta volta." : "A votação desta volta fecha e já não é possível votar.",
          ok: abrir ? "Abrir volta" : "Encerrar volta",
          danger: !abrir,
        });
        if (!ok) return;
        await api.eleicoes.acaoRonda(e.id, b.dataset.round, b.dataset.roundAction);
        team.renderElectionForm(e.id);
        // O apuramento é feito pelo worker logo a seguir: volta a ler para mostrar "APURADA"
        if (!abrir) setTimeout(() => team.renderElectionForm(e.id), 2000);
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
