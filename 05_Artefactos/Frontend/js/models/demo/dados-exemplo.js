/* Model · dados de exemplo usados enquanto o backend não está ligado (ver models/servidor.js) */
(function () {
  "use strict";

  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const HOUR = 36e5;
  const DAY = 864e5;

  // ===== Utilizadores =====
  const users = [
    { id: 1, nome: "Equipa Demonstração", email: "equipa@trustvote.pt", perfil: "administrador", ativo: true, totp_ativo: false, data_registo: iso(now - 400 * DAY) },
    { id: 2, nome: "Estudante Demonstração", email: "estudante@trustvote.pt", perfil: "eleitor", ativo: true, totp_ativo: false, data_registo: iso(now - 200 * DAY) },
    { id: 3, nome: "Mariana Silva", email: "mariana@trustvote.pt", perfil: "eleitor", ativo: true, totp_ativo: false, data_registo: iso(now - 150 * DAY) },
    { id: 4, nome: "João Costa", email: "joao@trustvote.pt", perfil: "eleitor", ativo: true, totp_ativo: true, data_registo: iso(now - 120 * DAY) },
    { id: 5, nome: "Inês Santos", email: "ines@trustvote.pt", perfil: "eleitor", ativo: false, totp_ativo: false, data_registo: iso(now - 90 * DAY) },
  ];

  // ===== Eleições, listas e rondas =====
  let nextId = 100;
  const cand = (id, nome, partido, descricao) => ({ id, nome, partido, descricao, ativo: true });
  const elections = [
    {
      id: 1,
      titulo: "Associação de Estudantes 2026",
      descricao: "Eleição da direção da Associação de Estudantes da Universidade Exemplo.",
      estado: "em_curso",
      criador_id: 1,
      data_criacao: iso(now - 10 * DAY),
      candidatos: [
        cand(1, "Marta Oliveira", "Lista A", "Mais salas de estudo abertas à noite"),
        cand(2, "Rui Matos", "Lista A", "Cantina com opções mais baratas"),
        cand(3, "Tiago Ramos", "Lista B", "Bolsas de apoio ao material escolar"),
        cand(4, "Sara Nunes", "Lista B", "Mais atividades desportivas"),
        cand(5, "Beatriz Lopes", "Lista C", "Apoio psicológico gratuito"),
        cand(6, "Duarte Faria", "Lista C", "Transporte noturno para o campus"),
      ],
      rondas: [{ id: 1, numero: 1, data_inicio: iso(now - 6 * HOUR), data_fim: iso(now + 2 * DAY), estado: "aberta", candidatos: [] }],
      habilitados: [1, 2, 3, 4].map((uid) => ({ uid, data: iso(now - 5 * DAY) })),
      totalHabilitados: 3200,
      votantes: 1384,
      votos: { 1: 330, 2: 290, 3: 260, 4: 214, 5: 160, 6: 130 },
    },
    {
      id: 2,
      titulo: "Representantes de curso 2026",
      descricao: "Eleição dos representantes de cada curso no conselho pedagógico.",
      estado: "rascunho",
      criador_id: 1,
      data_criacao: iso(now - 2 * DAY),
      candidatos: [],
      rondas: [],
      habilitados: [],
      totalHabilitados: 0,
      votantes: 0,
      votos: {},
    },
    {
      id: 3,
      titulo: "Núcleo de Informática 2025",
      descricao: "Eleição da direção do núcleo académico de Informática.",
      estado: "encerrada",
      criador_id: 1,
      data_criacao: iso(now - 380 * DAY),
      candidatos: [cand(7, "Carolina Reis", "Lista A", "Mais workshops práticos"), cand(8, "Pedro Alves", "Lista B", "Parcerias com empresas para estágios")],
      rondas: [{ id: 3, numero: 1, data_inicio: iso(now - 370 * DAY), data_fim: iso(now - 368 * DAY), estado: "encerrada", candidatos: [] }],
      habilitados: [1, 2, 3].map((uid) => ({ uid, data: iso(now - 375 * DAY) })),
      totalHabilitados: 420,
      votantes: 251,
      votos: { 7: 146, 8: 105 },
    },
    // Eleições anteriores da Associação de Estudantes (só a equipa as vê, para o histórico de resultados)
    {
      id: 4,
      titulo: "Associação de Estudantes 2025",
      descricao: "Eleição da direção da Associação de Estudantes da Universidade Exemplo.",
      estado: "encerrada",
      criador_id: 1,
      data_criacao: iso(now - 540 * DAY),
      candidatos: [
        cand(9, "Leonor Pinto", "Lista A", "Mais espaços de estudo no campus"),
        cand(10, "Gonçalo Ferreira", "Lista B", "Descontos nos transportes"),
        cand(11, "Catarina Sousa", "Lista C", "Feira de emprego anual"),
      ],
      rondas: [{ id: 4, numero: 1, data_inicio: iso(now - 532 * DAY), data_fim: iso(now - 530 * DAY), estado: "encerrada", candidatos: [] }],
      habilitados: [1, 3, 4].map((uid) => ({ uid, data: iso(now - 535 * DAY) })),
      totalHabilitados: 3050,
      votantes: 1612,
      votos: { 9: 702, 10: 548, 11: 362 },
    },
    {
      id: 5,
      titulo: "Associação de Estudantes 2024",
      descricao: "Eleição da direção da Associação de Estudantes da Universidade Exemplo.",
      estado: "encerrada",
      criador_id: 1,
      data_criacao: iso(now - 905 * DAY),
      candidatos: [cand(12, "Miguel Correia", "Lista A", "Bar académico aberto ao fim de semana"), cand(13, "Ana Rocha", "Lista B", "Mais bolsas de mérito")],
      rondas: [{ id: 5, numero: 1, data_inicio: iso(now - 897 * DAY), data_fim: iso(now - 895 * DAY), estado: "encerrada", candidatos: [] }],
      habilitados: [1, 3].map((uid) => ({ uid, data: iso(now - 900 * DAY) })),
      totalHabilitados: 2900,
      votantes: 1218,
      votos: { 12: 571, 13: 647 },
    },
  ];
  elections.forEach((e) => e.rondas.forEach((r) => (r.candidatos = e.candidatos.filter((c) => c.ativo))));

  // ===== Votos e recibos do estudante (guardados no browser) =====
  const RECEIPTS_KEY = "trustvote:demo-recibos";
  const loadReceipts = () => {
    try {
      return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "null");
    } catch {
      return null;
    }
  };
  const receipts = loadReceipts() || [{ eleicao_id: 3, ronda: 1, utilizador_id: 2, recibo: "TV-7QK2M9XA", data: iso(now - 369 * DAY) }];
  const saveReceipts = () => {
    try {
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
    } catch {}
  };

  // ===== Registo de atividade: cada alteração feita na área da equipa acrescenta uma linha =====
  let nextAuditId = 1;
  const audit = [
    ["Eleição criada", "eleicao", 1, 10 * DAY],
    ["Candidato adicionado", "candidato", 6, 9 * DAY],
    ["Eleitores habilitados", "eleicao", 1, 5 * DAY],
    ["Eleição agendada", "eleicao", 1, 4 * DAY],
    ["Eleição criada", "eleicao", 2, 2 * DAY],
    ["Eleição iniciada", "eleicao", 1, 6 * HOUR],
  ].map(([acao, entidade, entidade_id, ago]) => ({ id: nextAuditId++, data: iso(now - ago), acao, entidade, entidade_id, utilizador_id: 1 }));
  const log = (acao, entidade, entidade_id) =>
    audit.push({ id: nextAuditId++, data: iso(Date.now()), acao, entidade, entidade_id, utilizador_id: me().id });

  // Quem está "ligado": a equipa na área da equipa, o estudante nas outras páginas
  const me = () => (document.body && document.body.dataset.page === "admin" ? users[0] : users[1]);

  (window.TrustVote = window.TrustVote || {}).demo = { iso, HOUR, users, elections, receipts, saveReceipts, audit, log, me, cand, novoId: () => nextId++ };
})();
