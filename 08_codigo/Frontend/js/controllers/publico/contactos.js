/* Controller · formulário de contacto (Ajuda → Contactos)
   A mensagem é enviada à API (POST /contactos) e a comissão lê-a no separador "Mensagens" da área da equipa.
   Se o servidor não responder, abre a aplicação de e-mail com a mensagem já escrita (mailto:), para não se perder.
   A validação dos campos é a de comum/validacao.js. */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const { ui, api } = TV;
  const form = document.querySelector("[data-contact-form]");

  // Copiar o endereço
  document.querySelectorAll("[data-contact-copy]").forEach((b) =>
    b.addEventListener("click", () => ui.copy(b.dataset.contactCopy, "Endereço copiado."))
  );

  if (!form) return;
  const mensagem = form.elements.mensagem;
  const contador = form.querySelector("[data-contact-count]");
  const aviso = form.querySelector("[data-contact-message]");

  // Contador de caracteres da mensagem
  const contar = () => {
    contador.textContent = `${mensagem.value.length} / ${mensagem.maxLength}`;
  };
  mensagem.addEventListener("input", contar);
  contar();

  const dados = () => ({
    nome: form.elements.nome.value.trim(),
    email: form.elements.email.value.trim(),
    assunto: form.elements.assunto.value,
    mensagem: mensagem.value.trim(),
  });

  // Plano B: a aplicação de e-mail da pessoa, com tudo preenchido
  const porEmail = (d) => {
    const corpo = `${d.mensagem}\n\n—\n${d.nome}\n${d.email}`;
    window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`[TrustVote] ${d.assunto}`)}&body=${encodeURIComponent(corpo)}`;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const d = dados();
    ui.message(aviso, "");
    try {
      await ui.busy(form.querySelector('[type="submit"]'), "A enviar…", () => api.contactos.enviar(d));
      form.innerHTML = `
        <div class="contact-sent" tabindex="-1">
          <span class="seal-icon seal-stamp">${TV.icon("check")}</span>
          <h2>Mensagem enviada</h2>
          <p>Obrigado, ${TV.format.escapeHtml(d.nome.split(" ")[0])}. A comissão eleitoral responde para <b>${TV.format.escapeHtml(d.email)}</b>.</p>
          <a class="link-button" href="ajuda.html#contactos" data-contact-again>Enviar outra mensagem</a>
        </div>`;
      form.querySelector(".contact-sent").focus();
      form.querySelector("[data-contact-again]").addEventListener("click", () => window.location.reload());
    } catch (error) {
      // Servidor em baixo: segue por e-mail. Erros de validação ou limite de envios: mostra a mensagem.
      if (!error.status || error.status >= 500) {
        ui.toast("O servidor não respondeu. A abrir a sua aplicação de e-mail…", true);
        porEmail(d);
      } else {
        ui.message(aviso, error.message);
      }
    }
  });
});
