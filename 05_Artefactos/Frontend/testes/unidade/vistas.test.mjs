// Views (HTML gerado a partir dos dados da API): conteúdo certo e nada de HTML injetado.
import assert from "node:assert/strict";
import { test } from "node:test";
import { carregar } from "./carregar.mjs";

const vistas = () =>
  carregar(
    ["views/formatar.js", "views/componentes.js", "views/graficos.js", "models/eleicoes.js", "models/resultados.js",
      "views/publico.js", "views/eleitor/eleicoes.js"],
    { TrustVote: { api: {}, localReceipts: { all: () => [] } } }
  );

const MALICIOSO = `<script>alert("x")</script>`;

test("cartão de uma lista: candidatos e propostas, com HTML neutralizado", () => {
  const { publicView } = vistas();
  const html = publicView.listCard("Lista A", [{ nome: MALICIOSO, descricao: "Bolsas" }], "AE 2026");
  assert.ok(!html.includes("<script>"), "o nome do candidato não pode virar HTML");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(html, /Bolsas/);
  assert.match(html, /AE 2026/);
});

test("avisos da página inicial a partir da eleição em destaque", () => {
  const { publicView } = vistas();
  const html = publicView.notices({
    eleicao: { titulo: "AE 2026", estado: "em_curso", data_fim: "2026-11-21T10:00:00Z" },
    candidatos: [{ partido: "Lista A" }, { partido: "Lista A" }, { partido: "Lista B" }],
    votos: 3,
    eleitores: 20,
    participacao: 15,
  });
  assert.match(html, /Votação aberta: AE 2026/);
  assert.match(html, /2 LISTAS/);
  assert.match(html, /3 de 20 estudantes já votaram/);
});

test("título da eleição em destaque muda com o estado", () => {
  const { publicView } = vistas();
  const html = (estado) => publicView.nextElection({ titulo: "AE", estado, data_inicio: null, data_fim: null });
  assert.match(html("em_curso"), /VOTAÇÃO A DECORRER/);
  assert.match(html("agendada"), /PRÓXIMA ELEIÇÃO/);
  assert.match(html("encerrada"), /ÚLTIMA ELEIÇÃO/);
});

test("fecho da última eleição: sem dados mostra só os passos", () => {
  const { publicView } = vistas();
  assert.match(publicView.lastCount(null), /Resultados publicados/);
  const html = publicView.lastCount({
    titulo: MALICIOSO, participacao: 50, data_fim: "2026-11-21T18:00:00Z", apurada_em: "2026-11-21T18:00:05Z",
  });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /Contagem concluída/);
});

test("números da página inicial: sem servidor diz que está indisponível", () => {
  const { publicView } = vistas();
  assert.match(publicView.metrics(null, false), /Servidor indisponível/);
  assert.match(publicView.metrics({ eleitores: 21, votos: 1, participacao: 4.8 }, true), /4,8%/);
});

test("boletim: botão de votar só com a votação aberta e sem voto", () => {
  const { voterView, elections } = vistas();
  const agora = Date.now();
  const e = elections.view({
    id: 7, titulo: "AE", estado: "em_curso", candidatos: [],
    rondas: [{ numero: 1, estado: "aberta", data_inicio: new Date(agora - 6e4).toISOString(), data_fim: new Date(agora + 6e4).toISOString() }],
  });
  assert.match(voterView.electionCard(e, true), /data-vote="7"/);
  assert.match(voterView.electionCard({ ...e, votou: true }, true), /Ver recibo/);
  assert.match(voterView.electionCard({ ...e, aberta: false }, true), /Votação fechada/);
});

test("opção do boletim neutraliza o nome do candidato", () => {
  const { voterView } = vistas();
  const html = voterView.candidateOption({ id: 1, nome: MALICIOSO, partido: "Lista A" }, 0);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /OPÇÃO 01/);
});

test("estados visuais (a carregar, vazio, erro) neutralizam o texto", () => {
  const { ui } = vistas();
  assert.ok(!ui.empty(MALICIOSO).includes("<script>"));
  assert.ok(!ui.error(new Error(MALICIOSO)).includes("<script>"));
  assert.match(ui.loading(), /A carregar/);
});
