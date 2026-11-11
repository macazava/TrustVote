/* View · boletim de demonstração da página "Como funciona" (TrustVote.demoView)
   Os mesmos três passos do boletim real (escolher, rever, depositar), com candidaturas fictícias.
   Nada é enviado ao servidor: é só para quem nunca votou online perder o receio. */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml } = TV.format;

  const candidaturas = [
    { id: "a", sigla: "A", nome: "Lista A · Campus Vivo", info: "Mais espaços de estudo e eventos ao fim de semana" },
    { id: "b", sigla: "B", nome: "Lista B · Estudantes em Movimento", info: "Transportes, alojamento e bolsas" },
    { id: "c", sigla: "C", nome: "Lista C · Voz Académica", info: "Mais participação dos estudantes nas decisões" },
  ];
  const branco = { id: "branco", sigla: "—", nome: "Voto em branco", info: "Conta para a participação, não para as listas" };
  const opcao = (id) => candidaturas.find((c) => c.id === id) || branco;

  // Indicador 1 Escolher · 2 Rever · 3 Depositar (mesmo desenho do boletim real)
  const passos = (atual) => {
    const nomes = ["Escolher", "Rever", "Depositar"];
    return `<div class="steps-track ballot-steps" aria-label="Passo ${atual} de 3">${nomes
      .map((nome, i) => {
        const n = i + 1;
        const estado = n < atual || atual === 3 ? "is-done" : n === atual ? "is-current" : "";
        return `<span class="${estado}"${n === atual ? ' aria-current="step"' : ""}><i>${estado === "is-done" ? TV.icon("check") : n}</i><b>${nome}</b></span>`;
      })
      .join("<hr>")}</div>`;
  };

  const etiqueta = (c, i, comRadio, marcado) => `
    <label${comRadio ? "" : ' class="is-static"'}>
      <span class="avatar" aria-hidden="true">${escapeHtml(c.sigla)}</span>
      <span>
        <small>${c.id === "branco" ? "OPÇÃO EM BRANCO" : `OPÇÃO ${String(i + 1).padStart(2, "0")}`}</small>
        <b>${escapeHtml(c.nome)}</b>
        <small>${escapeHtml(c.info)}</small>
      </span>
      ${comRadio ? `<input type="radio" name="demo-escolha" value="${c.id}" aria-label="${escapeHtml(c.nome)}"${marcado ? " checked" : ""}>` : ""}
    </label>`;

  const aviso = `<p class="demo-flag">${TV.icon("info")} Demonstração: candidaturas fictícias, nada é enviado.</p>`;

  // Passo 1
  const escolher = (escolhido) => `
    ${passos(1)}
    ${aviso}
    <h3 tabindex="-1">Escolha uma candidatura</h3>
    <p class="muted">Selecione uma opção. Pode rever a escolha antes de a depositar.</p>
    <form data-demo-form>
      <div class="candidate-list">${[...candidaturas, branco].map((c, i) => etiqueta(c, i, true, c.id === escolhido)).join("")}</div>
      <p class="form-message" role="status"></p>
      <div class="ballot-foot">
        <small>O seu voto é secreto</small>
        <button class="button button-primary" type="submit">Rever escolha ${TV.icon("arrow-right")}</button>
      </div>
    </form>`;

  // Passo 2
  const rever = (id) => `
    ${passos(2)}
    ${aviso}
    <h3 tabindex="-1">Confirme a sua escolha</h3>
    <p class="muted">Este é o boletim que entraria na urna. Depois de depositado, o voto não pode ser alterado.</p>
    <div class="ballot-paper">
      <header>
        <span class="ballot-paper-mark">${TV.icon("check")}</span>
        <div><small>BOLETIM DE VOTO · DEMONSTRAÇÃO</small><b>Direção da Associação de Estudantes</b></div>
      </header>
      <div class="candidate-list">${etiqueta(opcao(id), candidaturas.indexOf(opcao(id)), false)}</div>
      <footer>${TV.icon("lock")} Antes de entrar na urna, o boletim é separado da sua identidade.</footer>
    </div>
    <label class="check-label ballot-confirm">
      <input type="checkbox" data-demo-confirm>
      Confirmo que esta é a minha escolha e sei que não a posso alterar depois de depositar.
    </label>
    <div class="ballot-foot">
      <button class="link-button" type="button" data-demo-change>${TV.icon("arrow-left")} Alterar escolha</button>
      <button class="button button-primary" type="button" data-demo-deposit disabled>Depositar voto ${TV.icon("arrow-right")}</button>
    </div>`;

  // Passo 3
  const selado = (codigo) => `
    <div class="ballot-done">
      ${passos(3)}
      <span class="seal-icon seal-stamp">${TV.icon("check")}</span>
      <p class="eyebrow">VOTO DEPOSITADO E SELADO</p>
      <h3 tabindex="-1">Assim termina um voto no TrustVote.</h3>
      <p class="muted">No voto real recebe um recibo como este. Com ele confirma, na página pública, que o voto foi contado sem revelar a escolha.</p>
      <div class="receipt-code"><small>RECIBO DE DEMONSTRAÇÃO (NÃO É VÁLIDO)</small><b>${escapeHtml(codigo)}</b></div>
      <div class="demo-actions">
        <button class="button button-outline" type="button" data-demo-restart>Experimentar outra vez</button>
        <a class="button button-primary" href="login.html?area=eleitor" data-voter-link>Entrar para votar ${TV.icon("arrow-right")}</a>
      </div>
    </div>`;

  TV.demoView = { escolher, rever, selado };
})();
