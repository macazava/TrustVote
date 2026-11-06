// Ligação à API (js/models/servidor.js): endereços, troca de servidor e mensagens de erro.
import assert from "node:assert/strict";
import { test } from "node:test";
import { carregar, resposta } from "./carregar.mjs";

// TrustVote com a sessão simulada e um fetch que regista os endereços pedidos
function comFetch(responder, extra = {}) {
  const pedidos = [];
  const sessao = { token: () => "token-de-teste", expire: () => (sessao.expirou = true) };
  const TV = carregar(["models/servidor.js"], {
    TrustVote: { session: sessao },
    fetch: async (url, init) => {
      pedidos.push({ url: String(url), init });
      return responder(String(url), init);
    },
    ...extra,
  });
  return { TV, pedidos, sessao };
}

test("usa a API do endereço onde a página foi aberta", async () => {
  const { TV, pedidos } = comFetch(() => resposta(200, { ok: true }));
  await TV.request("GET", "/health");
  assert.equal(pedidos[0].url, "http://127.0.0.1:8080/api/health");
});

test("página aberta no Servidor 2 (8082) começa pela API desse servidor", async () => {
  const { TV, pedidos } = comFetch(() => resposta(200, {}), {
    location: { hostname: "127.0.0.1", port: "8082", pathname: "/pages/inicio.html" },
  });
  await TV.request("GET", "/health");
  assert.equal(pedidos[0].url, "http://127.0.0.1:8082/api/health");
});

test("se o servidor não responde, passa para o seguinte e fica lá", async () => {
  const { TV, pedidos } = comFetch((url) => {
    if (url.includes(":8080")) throw new TypeError("Failed to fetch");
    return resposta(200, { instance: "servidor1" });
  });
  const r = await TV.request("GET", "/health");
  assert.equal(r.instance, "servidor1");
  assert.equal(pedidos.length, 2);
  assert.match(TV.base, /:8081\/api$/);
  await TV.request("GET", "/health");
  assert.equal(pedidos.length, 3, "o pedido seguinte vai direto ao servidor que respondeu");
});

test("uma resposta de erro (ex.: voto repetido) nunca é repetida noutro servidor", async () => {
  const { TV, pedidos } = comFetch(() => resposta(409, { detail: "Já votou nesta volta." }));
  await assert.rejects(TV.request("POST", "/eleicoes/1/rondas/1/votos", { body: {} }), (e) => {
    assert.equal(e.status, 409);
    assert.equal(e.message, "Já votou nesta volta.");
    return true;
  });
  assert.equal(pedidos.length, 1);
});

test("nenhum servidor responde: mensagem com os endereços tentados", async () => {
  const { TV } = comFetch(() => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(TV.request("GET", "/health"), /8080.*8081.*8082/);
});

test("envia o token, o JSON e pede sempre ao servidor (sem cache do browser)", async () => {
  const { TV, pedidos } = comFetch(() => resposta(200, {}));
  await TV.request("POST", "/auth/password", { body: { atual: "a", nova: "b" } });
  const { init } = pedidos[0];
  assert.equal(init.headers.Authorization, "Bearer token-de-teste");
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.equal(init.body, JSON.stringify({ atual: "a", nova: "b" }));
  assert.equal(init.cache, "no-store");
});

test("pedidos públicos não levam o token", async () => {
  const { TV, pedidos } = comFetch(() => resposta(200, {}));
  await TV.request("GET", "/publico/resumo", { auth: false });
  assert.equal(pedidos[0].init.headers.Authorization, undefined);
});

test("parâmetros vazios não vão no endereço", async () => {
  const { TV, pedidos } = comFetch(() => resposta(200, []));
  await TV.request("GET", "/utilizadores", { query: { perfil: "eleitor", vazio: "", nulo: null } });
  assert.equal(pedidos[0].url, "http://127.0.0.1:8080/api/utilizadores?perfil=eleitor");
});

test("erros de validação da API (422) viram uma frase legível", async () => {
  const detalhe = [{ loc: ["body", "email"], msg: "Value error, e-mail inválido" }];
  const { TV } = comFetch(() => resposta(422, { detail: detalhe }));
  await assert.rejects(TV.request("POST", "/auth/register", { body: {} }), { message: "email: e-mail inválido" });
});

test("401 com sessão iniciada termina a sessão", async () => {
  const { TV, sessao } = comFetch(() => resposta(401, { detail: "Token inválido" }));
  await assert.rejects(TV.request("GET", "/auth/eu"));
  assert.equal(sessao.expirou, true);
});

test("raw devolve o estado sem lançar erro (usado no /health)", async () => {
  const { TV } = comFetch(() => resposta(503, { status: "degradado" }));
  const r = await TV.request("GET", "/health", { raw: true });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.equal(r.data.status, "degradado");
});

test("endereço das páginas", () => {
  const { TV } = comFetch(() => resposta(200, {}));
  assert.equal(TV.pageUrl("login.html?area=eleitor"), "/pages/login.html?area=eleitor");
});
