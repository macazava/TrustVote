/* Controller · descarregar ficheiros gerados no browser (CSV dos relatórios, recibo de voto em texto) */
(function () {
  "use strict";

  function ficheiro(nome, conteudo, tipo) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    link.download = nome;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // CSV que abre bem no Excel: separador ";" e BOM para os acentos
  function csv(nome, cabecalho, linhas) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const texto = [cabecalho, ...linhas].map((l) => l.map(cell).join(";")).join("\n");
    ficheiro(`${nome}-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + texto, "text/csv");
  }

  window.TrustVote.download = { ficheiro, csv };
})();
