/* Controller · formulário que já vem escrito em eleitor.html (pedido de apoio, separador "Ajuda") */
document.addEventListener("DOMContentLoaded", () => {
  // Texto maior e contraste das Definições são tratados por TrustVote.prefs (controllers/comum/pagina.js)

  // ===== Formulário de apoio =====
  document.querySelector("#support-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector(".form-message");

    if (!form.reportValidity()) return;

    message.textContent =
      "Formulário de demonstração: a mensagem não foi enviada. A integração com o backend será necessária para contactar a equipa.";
  });
});
