// Carrega scripts do site (que se registam em window.TrustVote) num contexto isolado do
// Node, sem browser. Cada teste recebe um TrustVote novo, com o que precisar simulado.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const JS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "js");

export function carregar(ficheiros, extra = {}) {
  const armazenamento = new Map();
  const sessionStorage = {
    getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null),
    setItem: (k, v) => armazenamento.set(k, String(v)),
    removeItem: (k) => armazenamento.delete(k),
  };
  const contexto = {
    console, URL, AbortController, performance, setTimeout, clearTimeout, Intl, Date, Math, JSON,
    sessionStorage,
    localStorage: sessionStorage,
    location: { hostname: "127.0.0.1", port: "8080", pathname: "/pages/inicio.html", href: "" },
    fetch: async () => {
      throw new Error("fetch não simulado neste teste");
    },
    ...extra,
  };
  contexto.window = contexto;
  contexto.window.TrustVote = extra.TrustVote || {};
  vm.createContext(contexto);
  for (const f of ficheiros) vm.runInContext(readFileSync(join(JS, f), "utf8"), contexto, { filename: f });
  return contexto.window.TrustVote;
}

// Resposta HTTP simulada para o fetch
export const resposta = (status, corpo) => ({
  ok: status < 400,
  status,
  text: async () => (corpo === undefined ? "" : JSON.stringify(corpo)),
});

// Os valores criados dentro do contexto isolado têm outros protótipos: converte-os
// para objetos normais antes de os comparar com deepEqual.
export const normal = (valor) => JSON.parse(JSON.stringify(valor));
