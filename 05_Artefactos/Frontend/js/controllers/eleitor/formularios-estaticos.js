/* Controller · formulários que já vêm escritos em eleitor.html (apoio, acessibilidade e exemplos de demonstração) */
document.addEventListener("DOMContentLoaded", () => {
  // ===== Votação de demonstração =====
  document.querySelector('[data-action="demo-vote"]')?.addEventListener("click", () => {
    const choice = document.querySelector('input[name="candidate"]:checked');
    const message = document.querySelector("#vote-message");

    if (!choice) {
      message.textContent = "Selecione uma opção de demonstração antes de rever.";
      return;
    }

    const confirmed = window.confirm(`Confirmar a opção de demonstração "${choice.value}"? Nenhum voto real será enviado.`);

    message.textContent = confirmed
      ? `Opção "${choice.value}" selecionada na demonstração. Não foi registado qualquer voto real.`
      : "Pode alterar a opção e tentar novamente.";
  });

  // ===== Sondagem de demonstração =====
  document.querySelector("#poll-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const choice = new FormData(form).get("poll");
    const message = form.querySelector(".form-message");

    if (!choice) {
      message.textContent = "Selecione uma opção.";
      return;
    }

    message.textContent = `Resposta "${choice}" validada apenas nesta interface. Não foi enviada para um servidor.`;
  });

  // ===== Formulário de apoio =====
  document.querySelector("#support-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector(".form-message");

    if (!form.reportValidity()) return;

    message.textContent =
      "Formulário de demonstração: a mensagem não foi enviada. A integração com o backend será necessária para contactar a equipa.";
  });

  // ===== Preferências de acessibilidade =====
  document.querySelector("#large-text")?.addEventListener("change", (event) => {
    document.body.classList.toggle("large-text", event.target.checked);
  });

  document.querySelector("#contrast")?.addEventListener("change", (event) => {
    document.body.classList.toggle("high-contrast", event.target.checked);
  });
});
