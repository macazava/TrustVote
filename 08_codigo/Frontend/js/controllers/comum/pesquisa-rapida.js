/* Controller · pesquisa rápida (Ctrl+K ou ⌘K) nas áreas do eleitor e da equipa
   Uma janela para saltar para qualquer separador, eleição ou eleitor, ou fazer uma ação, só com o teclado.
   Setas para escolher, Enter para abrir, Esc para fechar. Também abre pelo botão [data-palette] do cabeçalho. */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const nav = document.querySelector(".panel-nav");
  if (!nav) return;
  const { escapeHtml } = TV.format;
  const equipa = document.body.dataset.page === "admin";
  const go = (view) => TV.panels.go(view);

  const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // ===== Janela =====
  const dialog = document.createElement("dialog");
  dialog.className = "palette";
  dialog.setAttribute("aria-label", "Pesquisa rápida");
  dialog.innerHTML = `
    <div class="palette-input">
      ${TV.icon("search")}
      <input type="text" role="combobox" aria-expanded="true" aria-controls="palette-lista" aria-autocomplete="list"
        aria-label="Pesquisa rápida" autocomplete="off" spellcheck="false"
        placeholder="${equipa ? "Procurar separadores, eleições, eleitores…" : "Procurar separadores, eleições, ações…"}">
      <kbd>Esc</kbd>
    </div>
    <ul class="palette-list" id="palette-lista" role="listbox" aria-label="Resultados"></ul>
    <footer><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer>`;
  document.body.appendChild(dialog);
  const input = dialog.querySelector("input");
  const lista = dialog.querySelector("ul");

  // ===== Comandos =====
  // { grupo, titulo, detalhe, icone, palavras, run }
  const fixos = () => [
    ...[...nav.querySelectorAll("[data-view]")].map((b) => ({
      grupo: "Separadores",
      // Só o texto do botão (sem o número de mensagens por ler)
      titulo: [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/s+/g, " ").trim(),
      icone: "arrow-right",
      run: () => b.click(),
    })),
    { grupo: "Ações", titulo: TV.prefs.isDark() ? "Mudar para o modo claro" : "Mudar para o modo escuro", icone: TV.prefs.isDark() ? "sun" : "moon", palavras: "tema escuro claro", run: () => document.querySelector("[data-theme-toggle]")?.click() },
    { grupo: "Ações", titulo: "Verificar um recibo", detalhe: "Página pública", icone: "shield-check", palavras: "voto recibo codigo", run: () => (window.location.href = "verificar.html") },
    { grupo: "Ações", titulo: "Abrir o portal público", icone: "house", palavras: "inicio site", run: () => (window.location.href = "inicio.html") },
    { grupo: "Ações", titulo: "Terminar sessão", icone: "log-out", palavras: "sair logout", run: () => TV.session.logout() },
  ];

  // Dados que vêm do servidor (lidos sempre que a janela abre, para estarem atualizados)
  async function dados() {
    if (equipa) {
      const [eleicoes, contas] = await Promise.all([TV.api.eleicoes.listar().catch(() => []), TV.api.utilizadores.listar().catch(() => [])]);
      return [
        { grupo: "Ações", titulo: "Criar nova eleição", icone: "vote", palavras: "nova adicionar", run: () => (go("elections"), TV.team.renderElectionForm(null)) },
        ...eleicoes.map((e) => ({
          grupo: "Eleições",
          titulo: e.titulo,
          detalhe: TV.elections.statusLabels[e.estado] || e.estado,
          icone: "vote",
          run: () => (go("elections"), TV.team.renderElectionForm(e.id)),
        })),
        ...contas.map((u) => ({
          grupo: "Eleitores",
          titulo: u.nome,
          detalhe: u.email,
          icone: "user-check",
          palavras: `${u.email} ${TV.format.voterNumber(u)} ${u.curso || ""}`,
          run: () => (go("voters"), TV.tables.search("utilizadores", u.email)),
        })),
      ];
    }
    const voter = TV.voter;
    return (voter.state.lista || []).map((e) => ({
      grupo: "Eleições",
      titulo: e.aberta && !e.votou ? `Votar: ${e.titulo}` : e.titulo,
      detalhe: e.votou ? "Já votou" : e.aberta ? "Votação aberta" : e.periodo,
      icone: "vote",
      run: () => (go("elections"), e.aberta && !e.votou ? voter.openBallot(e.id) : voter.openDetails(e.id)),
    }));
  }

  // ===== Pesquisa e lista =====
  let todos = [];
  let visiveis = [];
  let atual = 0;

  function filtrar() {
    const termos = normalizar(input.value).split(/\s+/).filter(Boolean);
    const porGrupo = {};
    visiveis = todos.filter((c) => {
      const texto = normalizar(`${c.titulo} ${c.detalhe || ""} ${c.palavras || ""} ${c.grupo}`);
      if (!termos.every((t) => texto.includes(t))) return false;
      porGrupo[c.grupo] = (porGrupo[c.grupo] || 0) + 1;
      return porGrupo[c.grupo] <= 8; // no máximo 8 por grupo
    });
    atual = 0;
    desenhar();
  }

  function desenhar() {
    if (!visiveis.length) {
      lista.innerHTML = `<li class="palette-empty" role="presentation">Sem resultados para "${escapeHtml(input.value)}"</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    let grupo = "";
    lista.innerHTML = visiveis
      .map((c, i) => {
        const cabeca = c.grupo !== grupo ? `<li class="palette-heading" role="presentation">${escapeHtml((grupo = c.grupo))}</li>` : "";
        return `${cabeca}<li role="option" id="palette-op-${i}" data-i="${i}" aria-selected="${i === atual}">
          <span class="palette-icon">${TV.icon(c.icone || "arrow-right")}</span>
          <span><b>${escapeHtml(c.titulo)}</b>${c.detalhe ? `<small>${escapeHtml(c.detalhe)}</small>` : ""}</span>
          ${i === atual ? `<span class="palette-enter">${TV.icon("corner-down-left")}</span>` : ""}
        </li>`;
      })
      .join("");
    input.setAttribute("aria-activedescendant", `palette-op-${atual}`);
    lista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }

  function executar(i) {
    const c = visiveis[i];
    if (!c) return;
    dialog.close();
    c.run();
  }

  async function abrir() {
    if (dialog.open) return;
    input.value = "";
    todos = fixos();
    filtrar();
    dialog.showModal();
    input.focus();
    const extra = await dados();
    if (!dialog.open) return;
    // Separadores e ações primeiro; depois eleições e eleitores
    todos = [...fixos(), ...extra].sort((a, b) => ordem(a.grupo) - ordem(b.grupo));
    filtrar();
  }
  const ordem = (g) => ["Separadores", "Eleições", "Eleitores", "Ações"].indexOf(g);

  // ===== Teclado e rato =====
  input.addEventListener("input", filtrar);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      atual = (atual + (event.key === "ArrowDown" ? 1 : -1) + visiveis.length) % Math.max(1, visiveis.length);
      desenhar();
    } else if (event.key === "Enter") {
      event.preventDefault();
      executar(atual);
    }
  });
  lista.addEventListener("click", (event) => {
    const li = event.target.closest("[data-i]");
    if (li) executar(Number(li.dataset.i));
  });
  lista.addEventListener("mousemove", (event) => {
    const li = event.target.closest("[data-i]");
    if (li && Number(li.dataset.i) !== atual) {
      atual = Number(li.dataset.i);
      desenhar();
    }
  });
  // Clicar fora da caixa fecha
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dialog.open ? dialog.close() : abrir();
    }
  });
  document.querySelectorAll("[data-palette]").forEach((b) => b.addEventListener("click", abrir));

  TV.palette = { open: abrir };
});
