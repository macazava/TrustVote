/* Controller · tabelas da área da equipa: pesquisa instantânea, ordenação por coluna e páginas (TrustVote.tables)
   Basta a <table> ter data-table="texto da caixa de pesquisa". As linhas não são copiadas, só reordenadas
   e escondidas, por isso os botões de cada linha continuam a funcionar.
   data-sort numa célula dá o valor de ordenação (ex.: a data ISO quando o texto é "10/11, 14:00").
   data-table-key identifica a tabela para TrustVote.tables.search() (usado pela pesquisa rápida Ctrl+K). */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const POR_PAGINA = 20;
  const pedidos = {}; // pesquisa pedida antes de a tabela existir (data-table-key → texto)

  const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const valor = (celula) => (celula ? celula.dataset.sort ?? celula.textContent.trim() : "");
  const comparar = (a, b) => {
    const na = Number(a.replace(/\s/g, "").replace(",", "."));
    const nb = Number(b.replace(/\s/g, "").replace(",", "."));
    if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, "pt", { sensitivity: "base", numeric: true });
  };

  function melhorar(table) {
    if ("enhanced" in table.dataset || !table.tHead || !table.tBodies[0]) return;
    table.dataset.enhanced = "";
    const caixa = table.closest(".table-scroll") || table;
    const tbody = table.tBodies[0];
    const linhas = [...tbody.rows];
    const estado = { q: pedidos[table.dataset.tableKey] || "", coluna: -1, sentido: 1, pagina: 0 };
    delete pedidos[table.dataset.tableKey];

    // Barra de cima: pesquisa e contagem
    const barra = document.createElement("div");
    barra.className = "table-tools";
    barra.innerHTML = `
      <label class="table-search">${TV.icon("search")}<span class="sr-only">${TV.format.escapeHtml(table.dataset.table)}</span>
        <input type="search" placeholder="${TV.format.escapeHtml(table.dataset.table)}" autocomplete="off">
      </label>
      <span class="table-count" aria-live="polite"></span>`;
    caixa.before(barra);
    const pesquisa = barra.querySelector("input");
    const contagem = barra.querySelector(".table-count");
    pesquisa.value = estado.q;

    // Barra de baixo: páginas
    const paginas = document.createElement("div");
    paginas.className = "table-pager";
    caixa.after(paginas);

    // Cabeçalhos com texto passam a botões de ordenação
    const cabecalhos = [...table.tHead.rows[0].cells];
    cabecalhos.forEach((th, i) => {
      const texto = th.textContent.trim();
      if (!texto || texto === "Ações") return;
      th.setAttribute("aria-sort", "none");
      th.innerHTML = `<button type="button" class="th-sort">${TV.format.escapeHtml(texto)}${TV.icon("arrow-up-down", "sort-icon")}</button>`;
      th.querySelector("button").addEventListener("click", () => {
        estado.sentido = estado.coluna === i ? -estado.sentido : 1;
        estado.coluna = i;
        estado.pagina = 0;
        desenhar();
      });
    });

    function desenhar() {
      const q = normalizar(estado.q);
      let visiveis = linhas.filter((tr) => !q || normalizar(tr.textContent).includes(q));
      if (estado.coluna >= 0) {
        visiveis = [...visiveis].sort((a, b) => comparar(valor(a.cells[estado.coluna]), valor(b.cells[estado.coluna])) * estado.sentido);
        tbody.append(...visiveis, ...linhas.filter((tr) => !visiveis.includes(tr)));
      }
      cabecalhos.forEach((th, i) => {
        if (th.hasAttribute("aria-sort")) th.setAttribute("aria-sort", i !== estado.coluna ? "none" : estado.sentido > 0 ? "ascending" : "descending");
      });

      const total = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
      estado.pagina = Math.min(estado.pagina, total - 1);
      const inicio = estado.pagina * POR_PAGINA;
      const mostrar = new Set(visiveis.slice(inicio, inicio + POR_PAGINA));
      linhas.forEach((tr) => (tr.hidden = !mostrar.has(tr)));

      contagem.textContent = !visiveis.length
        ? `Nenhum resultado para "${estado.q}"`
        : visiveis.length === linhas.length
          ? `${linhas.length} ${linhas.length === 1 ? "registo" : "registos"}`
          : `${visiveis.length} de ${linhas.length}`;

      paginas.hidden = total <= 1;
      paginas.innerHTML =
        total <= 1
          ? ""
          : `<button type="button" class="link-button" data-pagina="-1"${estado.pagina === 0 ? " disabled" : ""}>${TV.icon("chevron-left")} Anterior</button>
             <span>${inicio + 1}–${Math.min(inicio + POR_PAGINA, visiveis.length)} de ${visiveis.length}</span>
             <button type="button" class="link-button" data-pagina="1"${estado.pagina >= total - 1 ? " disabled" : ""}>Seguinte ${TV.icon("chevron-right")}</button>`;
    }

    pesquisa.addEventListener("input", () => {
      estado.q = pesquisa.value;
      estado.pagina = 0;
      desenhar();
    });
    paginas.addEventListener("click", (event) => {
      const b = event.target.closest("[data-pagina]");
      if (!b) return;
      estado.pagina += Number(b.dataset.pagina);
      desenhar();
      caixa.scrollTop = 0;
    });
    table._tvSearch = (texto) => {
      pesquisa.value = estado.q = texto;
      estado.pagina = 0;
      desenhar();
      pesquisa.focus();
    };
    desenhar();
  }

  // As tabelas chegam depois, com os dados da API: procura-as sempre que o conteúdo muda
  let espera = 0;
  const procurar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => document.querySelectorAll("table[data-table]").forEach(melhorar), 30);
  };
  document.addEventListener("DOMContentLoaded", () => {
    procurar();
    new MutationObserver(procurar).observe(document.body, { childList: true, subtree: true });
  });

  // Pesquisa numa tabela; se ainda não existir, fica guardada para quando for desenhada
  TV.tables = {
    search(chave, texto) {
      const table = document.querySelector(`table[data-table-key="${chave}"][data-enhanced]`);
      if (table && table.isConnected) table._tvSearch(texto);
      else pedidos[chave] = texto;
    },
  };
})();
