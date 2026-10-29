/* Model · servidor simulado: responde aos pedidos da API com os dados de exemplo (models/demo/dados-exemplo.js) */
(function () {
  "use strict";

  const { iso, HOUR, users, elections, receipts, saveReceipts, audit, log, me, cand, novoId } = window.TrustVote.demo;

  // ===== Respostas =====
  let instance = 0;
  const pub = (u) => ({ ...u });
  const eOut = ({ candidatos, rondas, habilitados, totalHabilitados, votantes, votos, ...e }) => e;
  const eDetail = (e) => ({ ...eOut(e), candidatos: e.candidatos, rondas: e.rondas });
  const visible = (e) => me().perfil === "administrador" || (e.estado !== "rascunho" && e.habilitados.some((h) => h.uid === me().id));
  const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

  function results(e) {
    const total = Object.values(e.votos).reduce((a, b) => a + b, 0);
    return e.rondas.map((rd) => ({
      ronda: rd.numero,
      candidatos: rd.candidatos.map((c) => ({ id: c.id, nome: c.nome, total_votos: e.votos[c.id] || 0, percentagem: pct(e.votos[c.id] || 0, total) })),
    }));
  }

  function handle(method, url, body) {
    const p = url.pathname;
    const q = url.searchParams;
    const ok = (data) => [200, data];
    const user = me();
    const admin = user.perfil === "administrador";
    let m;

    if (p === "/health") return ok({ status: "ok", instance: `servidor${(instance++ % 2) + 1}`, database: "ok" });
    if (p === "/auth/login" || p === "/auth/registo") return [401, { detail: "Login desativado no modo de demonstração." }];
    if (p === "/publico/resumo") {
      const e = elections[0];
      return ok({
        eleicao: { id: e.id, titulo: e.titulo, estado: e.estado, data_inicio: e.rondas[0].data_inicio, data_fim: e.rondas[0].data_fim },
        eleitores: e.totalHabilitados,
        votos: e.votantes,
        participacao: pct(e.votantes, e.totalHabilitados),
        candidatos: e.candidatos.map(({ id, nome, partido, descricao }) => ({ id, nome, partido, descricao })),
      });
    }

    if (p === "/auth/eu") return ok(pub(user));
    if (p === "/auth/totp/configurar") return ok({ segredo: "JBSWY3DPEHPK3PXP", uri: `otpauth://totp/TrustVote:${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=TrustVote` });
    if ((m = p.match(/^\/auth\/totp\/(ativar|desativar)$/))) {
      if (!/^\d{6}$/.test(body.codigo || "")) return [422, { detail: "Código TOTP inválido" }];
      user.totp_ativo = m[1] === "ativar";
      return [204];
    }

    if (p === "/utilizadores") return ok(users.filter((u) => !q.get("perfil") || u.perfil === q.get("perfil")).map(pub));
    if ((m = p.match(/^\/utilizadores\/(\d+)$/))) {
      log("ativo" in body ? (body.ativo ? "Conta reativada" : "Conta suspensa") : "Perfil da conta alterado", "utilizador", +m[1]);
      return ok(Object.assign(users.find((u) => u.id === +m[1]), body));
    }

    if (p === "/recibos") {
      return ok(
        receipts
          .filter((r) => r.utilizador_id === user.id)
          .map((r) => ({ eleicao_id: r.eleicao_id, eleicao_titulo: elections.find((e) => e.id === r.eleicao_id)?.titulo, ronda: r.ronda, recibo: r.recibo, data: r.data }))
      );
    }
    if ((m = p.match(/^\/recibos\/(.+)\/verificar$/))) {
      const found = receipts.find((r) => r.recibo === decodeURIComponent(m[1]).trim().toUpperCase());
      return ok({ valido: !!found, incluido: !!found, ronda: found ? found.ronda : null });
    }
    if (p === "/auditoria") return ok([...audit].reverse().slice(0, +(q.get("limite") || 200)));

    if (p === "/eleicoes" && method === "GET") return ok(elections.filter((e) => visible(e) && (!q.get("estado") || e.estado === q.get("estado"))).map(eOut));
    if (p === "/eleicoes" && method === "POST") {
      const e = { id: novoId(), titulo: body.titulo, descricao: body.descricao, estado: "rascunho", criador_id: user.id, data_criacao: iso(Date.now()), candidatos: [], rondas: [], habilitados: [], totalHabilitados: 0, votantes: 0, votos: {} };
      elections.push(e);
      log("Eleição criada", "eleicao", e.id);
      return [201, eOut(e)];
    }

    if ((m = p.match(/^\/eleicoes\/(\d+)(\/.*)?$/))) {
      const e = elections.find((x) => x.id === +m[1]);
      const rest = m[2] || "";
      if (!e || !visible(e)) return [404, { detail: "Eleição não encontrada" }];
      let r;
      if (!rest && method === "GET") return ok(eDetail(e));

      if ((r = rest.match(/^\/rondas\/(\d+)\/votos$/))) {
        if (receipts.some((x) => x.eleicao_id === e.id && x.ronda === +r[1] && x.utilizador_id === user.id)) return [409, { detail: "Já votou nesta ronda" }];
        const recibo = `TV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        receipts.push({ eleicao_id: e.id, ronda: +r[1], utilizador_id: user.id, recibo, data: iso(Date.now()) });
        saveReceipts();
        e.votos[body.candidato_id] = (e.votos[body.candidato_id] || 0) + 1;
        e.votantes++;
        return [201, { recibo, hash: "c".repeat(64), data: iso(Date.now()) }];
      }
      if (rest === "/participacao") return ok({ votou: receipts.some((x) => x.eleicao_id === e.id && x.utilizador_id === user.id) });
      if (rest === "/sondagem") {
        return ok({
          modelo: "TrustVote v1.4",
          amostra: 1240,
          intervalo: 2.8,
          projecao: e.candidatos.map((c, i) => ({ candidato_id: c.id, nome: c.nome, percentagem: [24.1, 20.6, 18.3, 15.2, 11.4, 6.2][i] ?? 0 })).concat([{ candidato_id: null, nome: "Indecisos / branco", percentagem: 4.2 }]),
        });
      }
      if (rest === "/sondagem/respostas") return [201, {}];
      if (rest === "/resultados") return ok(results(e));
      if (rest === "/estatisticas") {
        // Votos por hora nas últimas 10 horas
        const perHour = [30, 60, 90, 120, 150, 180, 190, 200, 190, 174];
        return ok({
          habilitados: e.totalHabilitados,
          votantes: e.votantes,
          participacao: pct(e.votantes, e.totalHabilitados),
          serie: perHour.map((v, i) => ({ hora: iso(Date.now() - (9 - i) * HOUR), votos: Math.round((v / 1384) * e.votantes) })),
        });
      }

      if (!admin) return [403, { detail: "Apenas administradores" }];
      if (!rest && method === "PATCH") {
        log("Eleição editada", "eleicao", e.id);
        return ok(eOut(Object.assign(e, body)));
      }
      if (!rest && method === "DELETE") {
        log("Eleição apagada", "eleicao", e.id);
        elections.splice(elections.indexOf(e), 1);
        return [204];
      }
      if (rest === "/agendar") {
        if (e.candidatos.filter((c) => c.ativo).length < 2 || !e.habilitados.length || !e.rondas.length) {
          return [409, { detail: "Para agendar: ronda 1 com fim no futuro, ≥ 2 candidatos ativos e ≥ 1 eleitor habilitado" }];
        }
        e.estado = "agendada";
        e.rondas[0].candidatos = e.candidatos.filter((c) => c.ativo);
        log("Eleição agendada", "eleicao", e.id);
        return ok(eDetail(e));
      }
      if (rest === "/iniciar") {
        e.estado = "em_curso";
        if (e.rondas[0]) e.rondas[0].estado = "aberta";
        log("Eleição iniciada", "eleicao", e.id);
        return ok(eDetail(e));
      }
      if (rest === "/encerrar") {
        e.estado = "encerrada";
        e.rondas.forEach((x) => (x.estado = "encerrada"));
        log("Eleição encerrada", "eleicao", e.id);
        return ok(eDetail(e));
      }
      if (rest === "/rondas" && method === "POST") {
        const rd = { id: novoId(), numero: e.rondas.length + 1, data_inicio: body.data_inicio, data_fim: body.data_fim, estado: "agendada", candidatos: e.candidatos.filter((c) => !body.candidato_ids || body.candidato_ids.includes(c.id)) };
        e.rondas.push(rd);
        log(rd.numero === 1 ? "Datas da votação definidas" : "2.ª volta criada", "eleicao", e.id);
        return [201, rd];
      }
      if ((r = rest.match(/^\/rondas\/(\d+)$/))) {
        log("Datas da votação alteradas", "eleicao", e.id);
        return ok(Object.assign(e.rondas.find((x) => x.numero === +r[1]), body));
      }
      if ((r = rest.match(/^\/rondas\/(\d+)\/(abrir|encerrar)$/))) {
        const rd = e.rondas.find((x) => x.numero === +r[1]);
        rd.estado = r[2] === "abrir" ? "aberta" : "encerrada";
        log(r[2] === "abrir" ? "Votação aberta" : "Votação encerrada", "eleicao", e.id);
        return ok(rd);
      }
      if (rest === "/candidatos" && method === "POST") {
        const c = cand(novoId(), body.nome, body.partido, body.descricao);
        e.candidatos.push(c);
        log("Candidato adicionado", "candidato", c.id);
        return [201, c];
      }
      if ((r = rest.match(/^\/candidatos\/(\d+)$/))) {
        const c = e.candidatos.find((x) => x.id === +r[1]);
        if (method === "DELETE") {
          log("Candidato removido", "candidato", c.id);
          e.candidatos.splice(e.candidatos.indexOf(c), 1);
          return [204];
        }
        log(body.ativo === false ? "Candidato desativado" : "Candidato ativado", "candidato", c.id);
        return ok(Object.assign(c, body));
      }
      if (rest === "/habilitados" && method === "GET") {
        return ok(e.habilitados.map((h) => { const u = users.find((x) => x.id === h.uid); return { utilizador_id: u.id, nome: u.nome, email: u.email, data: h.data }; }));
      }
      if (rest === "/habilitados" && method === "POST") {
        let adicionados = 0;
        let ja = 0;
        body.utilizador_ids.forEach((id) => (e.habilitados.some((h) => h.uid === id) ? ja++ : (e.habilitados.push({ uid: id, data: iso(Date.now()) }), adicionados++)));
        if (adicionados) log(adicionados === 1 ? "Eleitor habilitado" : `${adicionados} eleitores habilitados`, "eleicao", e.id);
        return ok({ adicionados, ja_habilitados: ja });
      }
      if ((r = rest.match(/^\/habilitados\/(\d+)$/))) {
        e.habilitados = e.habilitados.filter((h) => h.uid !== +r[1]);
        log("Eleitor removido", "eleicao", e.id);
        return [204];
      }
    }
    return [404, { detail: "Not Found" }];
  }

  // Devolve uma Response como o fetch, para o resto do código funcionar igual
  window.TrustVote.servidorSimulado = async (method, url, body) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    const [status, data] = handle(method, url, body ? JSON.parse(body) : {});
    return new Response(status === 204 || data === undefined ? null : JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  };
})();
