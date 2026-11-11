/* Controller · página pública "Verificar o meu voto": confirma, com o código do recibo, que o voto foi contado.
   O código pode vir no endereço (verificar.html?codigo=TV-…), por exemplo a partir do separador Recibos. */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const { api, ui, icon } = TV;
  const { escapeHtml } = TV.format;

  const form = document.querySelector("[data-verify-form]");
  const result = document.querySelector("[data-verify-result]");
  if (!form || !result) return;
  const input = form.elements.codigo;

  const { volta } = window.TrustVote.format;
  const check = (ok, text) => `<li class="${ok ? "is-ok" : "is-bad"}">${icon(ok ? "circle-check" : "circle-alert")} ${text}</li>`;

  // Três respostas possíveis: incluído, encontrado mas alterado, ou não encontrado
  function render(codigo, r) {
    const estado = !r.valido ? "missing" : r.incluido ? "ok" : "bad";
    const textos = {
      ok: ["circle-check", "O seu voto foi contado", "O recibo corresponde a um voto registado e com o selo de integridade correto."],
      bad: ["circle-alert", "Voto encontrado, mas alterado", "O selo de integridade não confere, por isso o voto foi excluído da contagem. Contacte a comissão eleitoral."],
      missing: ["circle-alert", "Recibo não encontrado", "Confirme se copiou o código completo. Se o problema continuar, contacte a comissão eleitoral."],
    };
    const [ic, titulo, texto] = textos[estado];
    result.innerHTML = `
      <div class="verify-outcome is-${estado}" tabindex="-1">
        <span class="verify-seal">${icon(ic)}</span>
        <div>
          <h2>${titulo}</h2>
          <p>${texto}</p>
          ${
            r.valido
              ? `<ul class="verify-checks">
                  ${check(true, "Voto registado na urna")}
                  ${check(r.incluido, r.incluido ? "Incluído na contagem" : "Excluído da contagem")}
                  ${check(true, `Depositado na ${volta(r.ronda)}`)}
                </ul>`
              : ""
          }
          <p class="verify-code"><small>CÓDIGO VERIFICADO</small><code>${escapeHtml(codigo)}</code></p>
        </div>
      </div>`;
    result.querySelector(".verify-outcome").focus();
  }

  async function verify() {
    const codigo = input.value.trim().toUpperCase();
    input.value = codigo;
    const button = form.querySelector('[type="submit"]');
    result.innerHTML = ui.loading("A verificar o recibo…");
    try {
      const resposta = await ui.busy(button, "A verificar…", () => api.votacao.verificarRecibo(codigo));
      render(codigo, resposta);
      // O endereço passa a ter o código: pode ser guardado ou partilhado para verificar outra vez
      history.replaceState(null, "", `?codigo=${encodeURIComponent(codigo)}`);
    } catch (error) {
      result.innerHTML = ui.error(error);
      result.querySelector("[data-retry]")?.addEventListener("click", verify);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    verify();
  });

  // Código no endereço: preenche e verifica logo
  const inicial = new URLSearchParams(window.location.search).get("codigo");
  if (inicial) {
    input.value = inicial.trim().toUpperCase();
    if (input.checkValidity()) verify();
  }
});
