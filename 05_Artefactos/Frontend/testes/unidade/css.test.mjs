// Verificação estática do CSS: impede que se acumulem regras mortas ou repetidas.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (p) => readFileSync(p, "utf8");
const ficheiros = (pasta, ext) =>
  readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n);
    return statSync(p).isDirectory() ? ficheiros(p, ext) : p.endsWith(ext) ? [p] : [];
  });

// O nosso CSS, sem o tailwind.css (gerado) nem a entrada do Tailwind
const CSS = ficheiros(join(FRONTEND, "css"), ".css").filter((p) => !p.endsWith("tailwind.css") && !p.includes(join("css", "tailwind")));
const PAGINAS_E_JS = [...ficheiros(join(FRONTEND, "pages"), ".html"), ...ficheiros(join(FRONTEND, "js"), ".js")].map(ler).join("\n");
const nome = (p) => relative(FRONTEND, p).replaceAll("\\", "/");

// Regras de um ficheiro: { contexto (@media…), seletor, declarações [[propriedade, valor]] }
function regras(texto) {
  const lista = [];
  const semComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, "");
  (function percorrer(bloco, contexto) {
    let i = 0;
    for (;;) {
      const m = /([^{}]+)\{/.exec(bloco.slice(i));
      if (!m) return;
      const cabecalho = m[1].trim().replace(/\s+/g, " ");
      let j = i + m.index + m[0].length;
      const inicio = j;
      for (let nivel = 1; nivel && j < bloco.length; j++) nivel += bloco[j] === "{" ? 1 : bloco[j] === "}" ? -1 : 0;
      const corpo = bloco.slice(inicio, j - 1);
      if (/^@(media|supports)/.test(cabecalho)) percorrer(corpo, cabecalho);
      else if (!cabecalho.startsWith("@")) {
        const declaracoes = corpo.split(";").map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]);
        lista.push({ contexto, seletor: cabecalho, declaracoes });
      }
      i = j;
    }
  })(semComentarios, "");
  return lista;
}

// Ordem real do CSS: a dos @import do style.css
const ORDEM = [...ler(join(FRONTEND, "css", "style.css")).matchAll(/@import url\("([^"?]+)/g)].map((m) => join(FRONTEND, "css", m[1]));

test("todos os ficheiros de CSS estão ligados ao style.css", () => {
  const fora = CSS.filter((p) => !p.endsWith("style.css") && !ORDEM.includes(p)).map(nome);
  assert.deepEqual(fora, []);
});

test("nenhuma classe do CSS fica sem uso nas páginas ou no JavaScript", () => {
  const usadas = new Set(PAGINAS_E_JS.match(/[A-Za-z0-9_-]+/g));
  const semUso = new Set();
  for (const p of CSS) {
    for (const r of regras(ler(p))) {
      for (const [, classe] of r.seletor.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) if (!usadas.has(classe)) semUso.add(`${nome(p)}: .${classe}`);
    }
  }
  assert.deepEqual([...semUso], []);
});

test("nenhuma propriedade é sempre substituída por outra regra com o mesmo seletor", () => {
  // Mesmo seletor, mesmo @media: a regra que vem depois ganha sempre, por isso a
  // propriedade repetida na anterior nunca tem efeito.
  const vistas = new Map();
  const mortas = [];
  const todas = ORDEM.flatMap((p) => regras(ler(p)).map((r) => ({ ...r, ficheiro: nome(p) })));
  for (let i = todas.length - 1; i >= 0; i--) {
    const r = todas[i];
    const seletores = r.seletor.split(",").map((x) => x.trim());
    const depois = seletores.map((s) => vistas.get(`${r.contexto}|${s}`) || new Set());
    // Numa regra com vários seletores ("estilo comum"), só está morta se for substituída em todos
    for (const [prop, valor] of r.declaracoes) {
      if (depois.every((d) => d.has(prop)) && !valor.includes("!important")) mortas.push(`${r.ficheiro}: ${r.seletor} { ${prop} }`);
    }
    seletores.forEach((s, k) => {
      r.declaracoes.forEach(([prop]) => depois[k].add(prop));
      vistas.set(`${r.contexto}|${s}`, depois[k]);
    });
  }
  assert.deepEqual(mortas, []);
});

test("nenhuma regra fica vazia nem declara a mesma propriedade duas vezes", () => {
  const problemas = [];
  for (const p of CSS) {
    for (const r of regras(ler(p))) {
      if (!r.declaracoes.length) problemas.push(`${nome(p)}: ${r.seletor} vazia`);
      const props = r.declaracoes.map(([x]) => x);
      const repetidas = props.filter((x, i) => props.indexOf(x) !== i);
      if (repetidas.length) problemas.push(`${nome(p)}: ${r.seletor} repete ${repetidas.join(", ")}`);
    }
  }
  assert.deepEqual(problemas, []);
});
