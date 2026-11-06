// Formatação (views/formatar.js), eleições (models/eleicoes.js) e resultados (models/resultados.js).
import assert from "node:assert/strict";
import { test } from "node:test";
import { carregar, normal } from "./carregar.mjs";

const base = () =>
  carregar(["views/formatar.js", "models/eleicoes.js", "models/resultados.js"], {
    TrustVote: { api: {}, localReceipts: { all: () => [] } },
  });

// ===== Formatação =====
test("escapeHtml neutraliza HTML (proteção contra XSS)", () => {
  const { format } = base();
  assert.equal(format.escapeHtml(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
  assert.equal(format.escapeHtml(null), "");
});

test("números e percentagens à portuguesa; sem valor mostra —", () => {
  const { format } = base();
  assert.equal(format.number(1234567), "1 234 567".replace(/ /g, " "));
  assert.equal(format.percent(66.666), "66,7%");
  assert.equal(format.number(null), "—");
  assert.equal(format.percent(undefined), "—");
});

test("datas: período e falta de datas", () => {
  const { format } = base();
  assert.equal(format.period(null, null), "Datas por definir");
  assert.match(format.date("2026-11-21T10:00:00Z"), /21 de novembro de 2026/);
  assert.equal(format.dateTime(null), "—");
});

test("iniciais, nomes de ficheiros e número de estudante", () => {
  const { format } = base();
  assert.equal(format.initials("Marta Sofia Oliveira"), "MO");
  assert.equal(format.initials(""), "?");
  assert.equal(format.slug("Direção da Associação 2026!"), "direcao-da-associacao-2026");
  assert.equal(format.voterNumber({ num_estudante: "a20260001" }), "a20260001");
  assert.equal(format.voterNumber({}), "—");
});

test("contagem decrescente nunca fica negativa", () => {
  const { format } = base();
  assert.equal(format.countdown("2000-01-01T00:00:00Z"), "00d : 00h : 00m");
});

// ===== Eleições =====
const agora = Date.now();
const iso = (ms) => new Date(agora + ms).toISOString();
const eleicao = (estadoRonda, inicio, fim, estado = "em_curso") => ({
  id: 1,
  titulo: "AE 2026",
  estado,
  candidatos: [{ id: 1, nome: "A", ativo: true }, { id: 2, nome: "B", ativo: false }],
  rondas: [{ numero: 1, estado: estadoRonda, data_inicio: inicio, data_fim: fim, candidatos: [] }],
});

test("eleição aberta só com a volta aberta e dentro das datas", () => {
  const { elections } = base();
  assert.equal(elections.view(eleicao("aberta", iso(-60e3), iso(60e3))).aberta, true);
  assert.equal(elections.view(eleicao("aberta", iso(60e3), iso(120e3))).aberta, false, "ainda não começou");
  assert.equal(elections.view(eleicao("aberta", iso(-120e3), iso(-60e3))).aberta, false, "já terminou");
  assert.equal(elections.view(eleicao("encerrada", iso(-60e3), iso(60e3))).aberta, false);
  assert.equal(elections.view(eleicao("aberta", iso(-60e3), iso(60e3), "agendada")).aberta, false);
});

test("candidatos do boletim: só os ativos quando a volta não tem lista própria", () => {
  const { elections } = base();
  const v = elections.view(eleicao("aberta", iso(-60e3), iso(60e3)));
  assert.deepEqual(normal(v.candidatosRonda).map((c) => c.nome), ["A"]);
  assert.equal(v.estadoLabel, "VOTAÇÃO ABERTA");
  assert.match(v.voltaLabel, /^1\.ª volta/);
});

test("volta atual: a aberta, senão a agendada, senão a última", () => {
  const { elections } = base();
  const r = (numero, estado) => ({ numero, estado });
  assert.equal(elections.currentRound({ rondas: [r(1, "apurada"), r(2, "aberta")] }).numero, 2);
  assert.equal(elections.currentRound({ rondas: [r(2, "agendada"), r(1, "apurada")] }).numero, 2);
  assert.equal(elections.currentRound({ rondas: [r(1, "apurada")] }).numero, 1);
  assert.equal(elections.currentRound({ rondas: [] }), null);
});

test("datas do formulário levam o fuso horário (exigido pela API)", () => {
  const { elections } = base();
  assert.match(elections.fromLocalInput("2026-11-21T09:30"), /^2026-11-21T09:30:00[+-]\d{2}:\d{2}$/);
  assert.equal(elections.fromLocalInput(""), null);
  assert.equal(elections.toLocalInput(""), "");
});

test("informação do candidato: órgão, curso e ano", () => {
  const { elections } = base();
  assert.deepEqual(normal(elections.candidateInfo({ orgao: "direcao", curso: "Direito", ano: 2 })), ["Direção", "Direito, 2.º ano"]);
});

// ===== Resultados =====
test("resultados ordenados do mais para o menos votado, com a lista de cada candidato", () => {
  const { results } = base();
  const ronda = { candidatos: [{ id: 1, nome: "A", total_votos: 3, percentagem: 30 }, { id: 2, nome: "B", total_votos: 7, percentagem: 70 }] };
  const linhas = results.resultRows(ronda, [{ id: 1, partido: "Lista A" }, { id: 2, partido: "Lista B" }]);
  assert.deepEqual(normal(linhas).map((l) => [l.nome, l.detalhe, l.votos]), [["B", "Lista B", 7], ["A", "Lista A", 3]]);
});

test("votos por lista somam os candidatos de cada lista", () => {
  const { results } = base();
  const listas = results.listRows([
    { nome: "A1", detalhe: "Lista A", votos: 2 },
    { nome: "A2", detalhe: "Lista A", votos: 3 },
    { nome: "B1", detalhe: "Lista B", votos: 5 },
  ]);
  assert.deepEqual(normal(listas).map((l) => [l.nome, l.votos, l.percentagem]), [["Lista A", 5, 50], ["Lista B", 5, 50]]);
});
