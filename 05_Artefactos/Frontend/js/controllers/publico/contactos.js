/* Controller · formulário de contacto (Ajuda → Contactos)
   Não há servidor de e-mail: ao enviar, abre a aplicação de e-mail da pessoa com o destinatário,
   o assunto e a mensagem já preenchidos (mailto:). A validação dos campos é a de comum/validacao.js. */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const form = document.querySelector("[data-contact-form]");

  // Copiar o endereço
  document.querySelectorAll("[data-contact-copy]").forEach((b) =>
    b.addEventListener("click", () => TV.ui.copy(b.dataset.contactCopy, "Endereço copiado."))
  );

  if (!form) return;
  const mensagem = form.elements.mensagem;
  const contador = form.querySelector("[data-contact-count]");

  // Contador de caracteres da mensagem
  const contar = () => {
    contador.textContent = `${mensagem.value.length} / ${mensagem.maxLength}`;
  };
  mensagem.addEventListener("input", contar);
  contar();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nome = form.elements.nome.value.trim();
    const email = form.elements.email.value.trim();
    const assunto = form.elements.assunto.value;
    const corpo = `${mensagem.value.trim()}\n\n—\n${nome}\n${email}`;
    window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`[TrustVote] ${assunto}`)}&body=${encodeURIComponent(corpo)}`;
    TV.ui.toast("A abrir a sua aplicação de e-mail…");
  });
});
