/* View · quadro de resultados de uma eleição, igual na página pública Resultados e na área do eleitor.
   Mostra os números da volta (participação, brancos, quórum), a classificação das candidaturas
   e, enquanto a votação está aberta, quando e como os resultados vão ser publicados. */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, dateTime, period, initials, countdown, volta, plural } = TV.format;
  const { stateBadge } = TV.blocks;


  // Aceita a eleição da API (data_inicio/data_fim) ou a já preparada pelo modelo (inicio/fim/periodo)
  const fimDe = (e) => e.fim || e.data_fim || null;
  const anoDe = (e) => e.ano || (e.data_inicio ? new Date(e.data_inicio).getFullYear() : "");
  const periodoDe = (e) => e.periodo || period(e.data_inicio, e.data_fim);

  const cabecalho = (e) => `
    <header class="results-board-head">
      <div>
        <p class="eyebrow">ELEIÇÃO${anoDe(e) ? ` · ${anoDe(e)}` : ""}</p>
        <h2>${escapeHtml(e.titulo)}</h2>
        <p class="results-period">${TV.icon("calendar")} ${escapeHtml(periodoDe(e))}</p>
      </div>
      ${stateBadge(e.estado)}
    </header>`;

  // Um número em destaque com a legenda por baixo
  const numero = (rotulo, valor, detalhe, classe = "") =>
    `<div class="${classe}"><small>${rotulo}</small><b>${valor}</b>${detalhe ? `<span>${detalhe}</span>` : ""}</div>`;

  // Barra da participação com a marca do quórum
  const barraParticipacao = (participacao, quorum) => `
    <div class="results-turnout" role="img" aria-label="Participação de ${percent(participacao)}${quorum ? `; quórum de ${percent(quorum)}` : ""}">
      <div class="results-turnout-bar"><i style="width:${Math.min(100, participacao || 0)}%"></i>${quorum ? `<em style="left:${Math.min(100, quorum)}%"></em>` : ""}</div>
      ${quorum ? `<small style="left:${Math.min(100, quorum)}%">Quórum ${percent(quorum)}</small>` : ""}
    </div>`;

  // Etiqueta do primeiro classificado: só diz "eleito" quando o apuramento é final, há quórum e maioria
  function etiquetaLider(r, lider, segundo) {
    if (!lider || !lider.total_votos || (segundo && segundo.total_votos === lider.total_votos)) return "";
    if (r.apurada && r.quorum_atingido && lider.percentagem > 50) return `<span class="results-tag is-win">${TV.icon("circle-check")} Eleito</span>`;
    return `<span class="results-tag">Mais votado</span>`;
  }

  const linhaCandidato = (c, i, lider, total, listas) => `
    <li class="${i === 0 && lider ? "is-leader" : ""}">
      <span class="results-pos">${i + 1}</span>
      <span class="avatar" aria-hidden="true">${escapeHtml(initials(c.nome))}</span>
      <div class="results-name">
        <b>${escapeHtml(c.nome)}</b>${listas.get(c.id) ? `<small>${escapeHtml(listas.get(c.id))}</small>` : ""}${i === 0 ? lider : ""}
        <div class="bar"><i style="width:${total ? Math.min(100, c.percentagem || 0) : 0}%"></i></div>
      </div>
      <div class="results-value"><b>${percent(c.percentagem)}</b><small>${plural(c.total_votos, "voto", "votos")}</small></div>
    </li>`;

  // Uma volta: números, participação e classificação
  function ronda(r, listas) {
    const candidatos = [...(r.candidatos || [])].sort((a, b) => b.total_votos - a.total_votos);
    const total = candidatos.reduce((s, c) => s + (c.total_votos || 0), 0);
    const lider = etiquetaLider(r, candidatos[0], candidatos[1]);
    const quorum = r.quorum
      ? numero("Quórum", r.quorum_atingido ? "Atingido" : "Não atingido", `mínimo de ${percent(r.quorum)}`, r.quorum_atingido ? "is-ok" : "is-warn")
      : numero("Quórum", "—", "sem mínimo definido");
    return `
      <section class="results-round">
        <div class="results-round-head">
          <h3>${volta(r.ronda)}</h3>
          <span class="results-count ${r.apurada ? "is-final" : ""}">${TV.icon(r.apurada ? "shield-check" : "clipboard-list")} ${r.apurada ? "Apuramento final" : "Contagem provisória"}</span>
        </div>
        <div class="results-figures">
          ${numero("Participação", percent(r.participacao), `${number(r.votantes)} de ${plural(r.habilitados, "eleitor", "eleitores")}`)}
          ${numero("Votos em candidaturas", number(total), "votos válidos")}
          ${numero("Votos em branco", number(r.brancos), percent(r.percentagem_brancos))}
          ${quorum}
        </div>
        ${barraParticipacao(r.participacao, r.quorum)}
        ${candidatos.length
        ? `<ol class="results-ranking">${candidatos.map((c, i) => linhaCandidato(c, i, lider, total, listas)).join("")}</ol>`
        : '<p class="muted">Esta volta não tem candidaturas.</p>'}
        ${r.invalidos
        ? `<p class="results-alert">${TV.icon("circle-alert")} ${plural(r.invalidos, "voto com selo de integridade inválido foi excluído", "votos com selo de integridade inválido foram excluídos")} da contagem.</p>`
        : ""}
      </section>`;
  }

  // Quadro completo: a volta mais recente primeiro; a anterior fica recolhida por baixo
  function board(e, rondas) {
    const ordenadas = [...(rondas || [])].sort((a, b) => b.ronda - a.ronda);
    const [atual, ...anteriores] = ordenadas;
    const listas = new Map((e.candidatos || []).map((c) => [c.id, c.partido])); // id → "Lista A"
    return `
      <article class="dash-card results-board">
        ${cabecalho(e)}
        ${atual ? ronda(atual, listas) : '<p class="muted">Ainda não há votos contados.</p>'}
        ${anteriores
        .map((r) => `<details class="results-previous"><summary>Ver resultados da ${volta(r.ronda)}</summary>${ronda(r, listas)}</details>`)
        .join("")}
        <p class="results-foot">${TV.icon("lock")} Os votos são contados sem ligação à identidade de quem votou.</p>
      </article>`;
  }

  // Votação aberta: quando ficam disponíveis, os passos até lá e, se houver, a participação ao vivo
  // aoVivo = { eleitores, votos, participacao } (opcional)
  function pending(e, { aoVivo, mensagem, acao } = {}) {
    const fim = fimDe(e);
    const aberta = e.estado === "em_curso";
    const passos = [
      ["Votação a decorrer", aberta ? "agora" : "concluída"],
      ["Encerramento", fim ? dateTime(fim) : "data por definir"],
      ["Contagem dos votos", "automática, logo após o fecho"],
      ["Publicação", "nesta página"],
    ];
    return `
      <article class="dash-card results-board">
        ${cabecalho(e)}
        <div class="results-pending">
          <span class="results-pending-icon">${TV.icon("lock")}</span>
          <div>
            <h3>Resultados disponíveis após o fecho da votação</h3>
            <p>${escapeHtml(mensagem || "Para não influenciar quem ainda não votou, os resultados por candidatura só são publicados quando a votação terminar.")}</p>
            ${aberta && fim && Date.parse(fim) > Date.now() ? `<p class="results-countdown">Termina em <b data-countdown="${fim}">${countdown(fim)}</b></p>` : ""}
          </div>
        </div>
        ${aoVivo
        ? `<div class="results-figures is-three">
              ${numero("Participação até agora", percent(aoVivo.participacao), "atualizada em tempo real")}
              ${numero("Votos registados", number(aoVivo.votos), "boletins entregues")}
              ${numero("Eleitores", number(aoVivo.eleitores), "habilitados a votar")}
            </div>
            ${barraParticipacao(aoVivo.participacao, 0)}`
        : ""}
        <ol class="results-steps">
          ${passos.map(([t, s], i) => `<li class="${i === 0 && aberta ? "is-current" : ""}"><span>${i + 1}</span><div><b>${t}</b><small>${escapeHtml(s)}</small></div></li>`).join("")}
        </ol>
        ${acao ? `<div class="results-action">${acao}</div>` : ""}
      </article>`;
  }

  TV.resultsView = { board, pending };
})();
