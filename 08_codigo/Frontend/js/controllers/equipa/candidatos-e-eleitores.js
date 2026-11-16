/* Controller · área da equipa, separadores "Candidatos" (por eleição) e "Eleitores" (contas) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, session, elections } = TV;
  const { panel, go } = TV.panels;
  const team = (TV.team = TV.team || {});

  // ===== Candidatos: separadores por eleição e grelha de cartões (a mesma da gestão da eleição) =====
  team.renderCandidates = async function renderCandidates() {
    const el = panel("candidates");
    const lista = await api.eleicoes.listar();
    const detalhes = await Promise.all(lista.map((e) => api.eleicoes.detalhe(e.id).then(elections.view)));
    // Abre na eleição que ainda se pode preparar; senão, na primeira
    const inicial = detalhes.find((e) => ["rascunho", "agendada"].includes(e.estado)) || detalhes.find((e) => e.estado === "em_curso") || detalhes[0];
    el.innerHTML = TV.teamView.candidatesPage(detalhes, inicial && inicial.id);
    if (!inicial) return;

    const tabs = [...el.querySelectorAll("[data-cand-election]")];
    const strip = el.querySelector("[data-cand-strip]");
    const board = el.querySelector("[data-cand-board]");

    // Depois de cada alteração, o contador do separador acompanha
    const contar = (e) => {
      const n = (e.candidatos || []).filter((c) => c.ativo).length;
      const badge = el.querySelector(`[data-cand-tab-count="${e.id}"]`);
      if (badge) badge.textContent = n;
    };

    function mostrar(e) {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(Number(t.dataset.candElection) === e.id)));
      strip.innerHTML = TV.teamView.candidatesStrip(e);
      strip.querySelector("[data-manage]").addEventListener("click", () => {
        go("elections");
        team.renderElectionForm(e.id);
      });
      team.renderCandidatesCard(e, board, contar);
    }

    tabs.forEach((t) =>
      t.addEventListener("click", () =>
        ui.mount(board, async () => mostrar(elections.view(await api.eleicoes.detalhe(Number(t.dataset.candElection)))))
      )
    );
    // Setas esquerda/direita entre separadores
    el.querySelector("[role=tablist]").addEventListener("keydown", (event) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
    mostrar(inicial);
  };

  // ===== Eleitores: indicadores, pesquisa e filtros, ações por conta =====
  const POR_PAGINA = 40;

  // Fecha os menus de ações ao clicar fora ou com Esc (um só ouvinte para a página)
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".row-menu[open]").forEach((m) => !m.contains(event.target) && m.removeAttribute("open"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".row-menu[open]").forEach((m) => {
      m.removeAttribute("open");
      m.querySelector("summary").focus();
    });
  });

  team.renderVoters = async function renderVoters() {
    const el = panel("voters");
    el.innerHTML = TV.teamView.votersPage();
    const statsBox = el.querySelector("[data-voter-stats]");
    const usersBox = el.querySelector("[data-users]");
    const enrolledBox = el.querySelector("[data-enrolled]");

    let contas = [];
    let inscritos = null;
    const atualizarStats = () => (statsBox.innerHTML = TV.teamView.voterStats(contas, inscritos));

    // Lista de contas: carrega tudo uma vez e filtra no browser
    const loadUsers = () =>
      ui.mount(usersBox, async () => {
        contas = await api.utilizadores.listar();
        atualizarStats();
        usersBox.innerHTML = TV.teamView.usersToolbar(contas);

        const lista = usersBox.querySelector("[data-user-list]");
        const mais = usersBox.querySelector("[data-user-more]");
        const pesquisa = usersBox.querySelector("[data-user-search]");
        const chips = [...usersBox.querySelectorAll("[data-user-filter]")];
        let filtro = "";
        let limite = POR_PAGINA;

        function desenhar() {
          const termo = pesquisa.value.trim().toLowerCase();
          const visiveis = contas.filter(
            (u) =>
              TV.teamView.usersFilter(u, filtro) &&
              (!termo || [u.nome, u.email, u.num_estudante, u.curso].filter(Boolean).join(" ").toLowerCase().includes(termo))
          );
          lista.innerHTML = TV.teamView.usersRows(visiveis.slice(0, limite), session.user);
          mais.innerHTML =
            visiveis.length > limite
              ? `<button class="button button-light" type="button" data-more>Mostrar mais (${visiveis.length - limite})</button>`
              : "";
          mais.querySelector("[data-more]")?.addEventListener("click", () => {
            limite += POR_PAGINA;
            desenhar();
          });
          ligarAcoes();
        }

        pesquisa.addEventListener("input", () => {
          limite = POR_PAGINA;
          desenhar();
        });
        chips.forEach((chip) =>
          chip.addEventListener("click", () => {
            filtro = chip.dataset.userFilter;
            limite = POR_PAGINA;
            chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
            desenhar();
          })
        );

        function ligarAcoes() {
          lista.querySelectorAll("[data-user]").forEach((b) =>
            b.addEventListener("click", async () => {
              try {
                await ui.busy(b, "…", () => api.utilizadores.atualizar(b.dataset.user, JSON.parse(b.dataset.patch)));
                ui.toast("Conta atualizada.");
                loadUsers();
              } catch (error) {
                ui.toast(error.message, true);
              }
            })
          );
          // Repor: o servidor gera uma palavra-passe temporária, mostrada uma única vez
          lista.querySelectorAll("[data-reset]").forEach((b) =>
            b.addEventListener("click", async () => {
              b.closest(".row-menu")?.removeAttribute("open");
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
                loadUsers();
              } catch (error) {
                ui.toast(error.message, true);
              }
            })
          );
        }

        desenhar();
      });

    loadUsers();
    renderEnrolled(enrolledBox, (dados) => {
      inscritos = dados;
      if (contas.length) atualizarStats();
    });
  };

  // ===== Lista oficial de inscritos: pesquisa, filtro, importação com pré-visualização =====
  function renderEnrolled(box, onLoad) {
    const reload = () => renderEnrolled(box, onLoad);
    ui.mount(box, async () => {
      const dados = await api.inscritos.listar();
      onLoad(dados);
      box.innerHTML = TV.teamView.enrolledCard(dados);
      const existentes = new Set(dados.estudantes.map((s) => s.num_estudante));

      // Pesquisa e filtro (com conta / por criar)
      const pesquisa = box.querySelector("[data-enroll-search]");
      const chips = [...box.querySelectorAll("[data-enroll-filter]")];
      let filtro = "";
      function filtrar() {
        const termo = (pesquisa?.value || "").trim().toLowerCase();
        let visiveis = 0;
        box.querySelectorAll("[data-enroll-item]").forEach((item) => {
          const ok = (!filtro || item.dataset.registado === filtro) && (!termo || item.dataset.search.includes(termo));
          item.classList.toggle("is-filtered", !ok);
          visiveis += ok ? 1 : 0;
        });
        const vazio = box.querySelector("[data-enroll-empty]");
        if (vazio) vazio.hidden = visiveis > 0;
      }
      pesquisa?.addEventListener("input", filtrar);
      chips.forEach((chip) =>
        chip.addEventListener("click", () => {
          filtro = chip.dataset.enrollFilter;
          chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
          filtrar();
        })
      );

      // Importação: o resumo atualiza-se enquanto se cola ou escolhe um ficheiro
      const form = box.querySelector("[data-enroll-form]");
      const resumo = form.querySelector("[data-enroll-parse]");
      const submeter = form.querySelector("[data-enroll-submit]");
      const message = form.querySelector(".form-message");
      let lidos = { validos: [] };
      const analisar = () => {
        lidos = TV.teamView.parseEnrolled(form.linhas.value, existentes);
        resumo.innerHTML = TV.teamView.parseSummary(lidos);
        submeter.disabled = !lidos.validos.length;
        ui.message(message, "");
      };
      form.linhas.addEventListener("input", analisar);

      const drop = form.querySelector("[data-enroll-drop]");
      const lerFicheiro = async (ficheiro) => {
        if (!ficheiro) return;
        if (ficheiro.size > 2 * 1024 * 1024) return ui.message(message, "O ficheiro é demasiado grande (máximo 2 MB).");
        const texto = await ficheiro.text();
        form.linhas.value = [form.linhas.value.trim(), texto.trim()].filter(Boolean).join("\n");
        analisar();
        ui.toast(`Ficheiro "${ficheiro.name}" lido.`);
      };
      form.querySelector("[data-enroll-file]").addEventListener("change", (event) => lerFicheiro(event.target.files[0]));
      ["dragenter", "dragover"].forEach((tipo) =>
        drop.addEventListener(tipo, (event) => {
          event.preventDefault();
          drop.classList.add("is-over");
        })
      );
      ["dragleave", "drop"].forEach((tipo) => drop.addEventListener(tipo, () => drop.classList.remove("is-over")));
      drop.addEventListener("drop", (event) => {
        event.preventDefault();
        lerFicheiro(event.dataTransfer.files[0]);
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!lidos.validos.length) return;
        try {
          const r = await ui.busy(submeter, "A acrescentar…", () => api.inscritos.adicionar(lidos.validos));
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
            hide: [b.closest("[data-enroll-item]")],
            commit: () => api.inscritos.remover(b.dataset.unenroll),
            after: reload,
          })
        )
      );
    });
  }
})();
