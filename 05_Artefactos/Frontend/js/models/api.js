/* Model · todos os pedidos ao backend, agrupados por assunto (TrustVote.api) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { request } = TV;

  const get = (path, options) => request("GET", path, options);
  const post = (path, body, options) => request("POST", path, { ...options, body });
  const patch = (path, body, options) => request("PATCH", path, { ...options, body });
  const del = (path, options) => request("DELETE", path, options);

  TV.api = {
    health: () => request("GET", "/health", { auth: false, raw: true }),

    auth: {
      registo: (dados) => post("/auth/register", dados, { auth: false }),
      login: (dados) => post("/auth/login", dados, { auth: false }),
      // raw: um token já expirado não deve levar ao ecrã de "sessão terminou"
      logout: () => post("/auth/logout", undefined, { raw: true }),
      eu: () => get("/auth/eu"),
      alterarPassword: (atual, nova) => post("/auth/password", { atual, nova }),
      // Autenticação de dois fatores (TOTP): configurada no servidor, ainda sem ecrã no site
      totpConfigurar: () => post("/auth/totp/configurar"),
      totpAtivar: (codigo) => post("/auth/totp/ativar", { codigo }),
      totpDesativar: (codigo) => post("/auth/totp/desativar", { codigo }),
    },

    utilizadores: {
      listar: (perfil) => get("/utilizadores", { query: { perfil } }),
      atualizar: (id, dados) => patch(`/utilizadores/${id}`, dados),
      reporPassword: (id) => post(`/utilizadores/${id}/repor-password`),
    },

    inscritos: {
      listar: () => get("/estudantes-inscritos"),
      adicionar: (estudantes) => post("/estudantes-inscritos", { estudantes }),
      remover: (numero) => del(`/estudantes-inscritos/${encodeURIComponent(numero)}`),
    },

    eleicoes: {
      listar: (estado) => get("/eleicoes", { query: { estado } }),
      detalhe: (id) => get(`/eleicoes/${id}`),
      criar: (dados) => post("/eleicoes", dados),
      atualizar: (id, dados) => patch(`/eleicoes/${id}`, dados),
      apagar: (id) => del(`/eleicoes/${id}`),
      acao: (id, acao) => post(`/eleicoes/${id}/${acao}`),
      criarRonda: (id, dados) => post(`/eleicoes/${id}/rondas`, dados),
      atualizarRonda: (id, n, dados) => patch(`/eleicoes/${id}/rondas/${n}`, dados),
      acaoRonda: (id, n, acao) => post(`/eleicoes/${id}/rondas/${n}/${acao}`),
      criarCandidato: (id, dados) => post(`/eleicoes/${id}/candidatos`, dados),
      atualizarCandidato: (id, cid, dados) => patch(`/eleicoes/${id}/candidatos/${cid}`, dados),
      apagarCandidato: (id, cid) => del(`/eleicoes/${id}/candidatos/${cid}`),
      habilitados: (id) => get(`/eleicoes/${id}/habilitados`),
      habilitar: (id, ids) => post(`/eleicoes/${id}/habilitados`, { utilizador_ids: ids }),
      desabilitar: (id, uid) => del(`/eleicoes/${id}/habilitados/${uid}`),
    },

    votacao: {
      // candidatoId a null = voto em branco
      votar: (id, n, candidatoId) =>
        post(`/eleicoes/${id}/rondas/${n}/votos`, candidatoId === null ? { branco: true } : { candidato_id: candidatoId }),
      participacao: (id) => get(`/eleicoes/${id}/participacao`),
      // Público: qualquer pessoa com o código do recibo pode confirmar que o voto foi contado
      verificarRecibo: (codigo) => get(`/recibos/${encodeURIComponent(codigo)}/verificar`, { auth: false }),
      resultados: (id) => get(`/eleicoes/${id}/resultados`),
      estatisticas: (id) => get(`/eleicoes/${id}/estatisticas`),
      integridade: (id) => get(`/eleicoes/${id}/integridade`),
    },

    auditoria: {
      listar: (limite = 200) => get("/auditoria", { query: { limite } }),
      verificar: () => get("/auditoria/verificar"),
    },

    sondagem: {
      obter: (id) => get(`/eleicoes/${id}/sondagem`),
      responder: (id, candidatoId) => post(`/eleicoes/${id}/sondagem/respostas`, { candidato_id: candidatoId }),
    },

    publico: {
      resumo: () => get("/publico/resumo", { auth: false }),
      historico: () => get("/publico/historico", { auth: false }),
      configuracao: () => get("/publico/configuracao", { auth: false }),
    },

    // Formulário de contacto: enviar é público; ler e marcar como lida é só para a equipa
    contactos: {
      enviar: (dados) => post("/contactos", dados, { auth: false }),
      listar: () => get("/contactos"),
      marcar: (id, lida) => patch(`/contactos/${id}`, { lida }),
    },
  };
})();
