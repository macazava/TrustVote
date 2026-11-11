/* Controller · validação dos formulários enquanto se escreve (todas as páginas com formulários)
   - Depois de sair de um campo, o erro aparece logo por baixo dele e atualiza-se a cada tecla.
   - Ao submeter com erros, o pedido não segue: todos os erros aparecem e o foco vai para o primeiro.
   - As regras são as do próprio HTML (required, type="email", minlength, pattern + title…).
   Formulários com escolha obrigatória por rádio (boletim, sondagem) e janelas (<form method="dialog">) ficam como estavam. */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const FIELDS = "input:not([type=hidden]):not([type=radio]):not([type=submit]):not([type=button]), select, textarea";
  let next = 0;

  const managed = (form) => form && form.tagName === "FORM" && form.method !== "dialog" && !form.querySelector("input[type=radio][required]");
  const hasRules = (field) =>
    field.required || field.pattern || field.minLength > 0 || field.maxLength > 0 || ["email", "url", "number"].includes(field.type) || field.min || field.max;

  // Regras que o HTML não sabe fazer sozinho
  function customRules(field) {
    if (field.name === "confirm" && field.form?.elements.password) {
      const differs = field.value && field.value !== field.form.elements.password.value;
      field.setCustomValidity(differs ? "As palavras-passe não coincidem." : "");
    }
  }

  function messageFor(field) {
    const v = field.validity;
    if (v.valueMissing) return field.type === "checkbox" ? "Tem de aceitar para continuar." : "Este campo é obrigatório.";
    if (v.typeMismatch && field.type === "email") return "Introduza um e-mail válido, por exemplo nome@exemplo.pt.";
    if (v.typeMismatch) return "O formato não é válido.";
    if (v.tooShort) return `Use pelo menos ${field.minLength} caracteres (tem ${field.value.length}).`;
    if (v.tooLong) return `Use no máximo ${field.maxLength} caracteres.`;
    if (v.patternMismatch) return field.title || "O formato não é válido.";
    if (v.rangeUnderflow) return `O valor mínimo é ${field.min}.`;
    if (v.rangeOverflow) return `O valor máximo é ${field.max}.`;
    if (v.badInput) return "Valor inválido.";
    return field.validationMessage;
  }

  // Onde fica a mensagem: no fim do <label> que contém o campo (ou logo a seguir, nas caixas de escolha)
  function messageBox(field) {
    if (field._tvMsg && field._tvMsg.isConnected) return field._tvMsg;
    const box = document.createElement("small");
    box.className = "field-error";
    box.id = `erro-campo-${++next}`;
    box.hidden = true;
    const label = field.closest("label");
    if (!label) field.insertAdjacentElement("afterend", box);
    else if (field.type === "checkbox") label.insertAdjacentElement("afterend", box);
    else label.append(box);
    field.setAttribute("aria-describedby", [field.getAttribute("aria-describedby"), box.id].filter(Boolean).join(" "));
    field._tvMsg = box;
    return box;
  }

  function check(field) {
    if (!hasRules(field) && field.name !== "confirm") return true;
    customRules(field);
    const ok = field.validity.valid; // (checkValidity() voltaria a lançar "invalid")
    field.setAttribute("aria-invalid", String(!ok));
    field.classList.toggle("is-valid", ok && !!field.value && field.type !== "checkbox");
    if (!ok || field._tvMsg) {
      const box = messageBox(field);
      box.hidden = ok;
      box.innerHTML = ok ? "" : `${TV.icon("circle-alert")}<span>${TV.format.escapeHtml(messageFor(field))}</span>`;
    }
    return ok;
  }

  document.addEventListener("focusout", (event) => {
    const field = event.target;
    if (!field.matches?.(FIELDS) || !managed(field.form)) return;
    // Campo vazio e nunca preenchido: só se queixa ao submeter
    if (!field.value && !field.dataset.touched && field.type !== "checkbox") return;
    field.dataset.touched = "";
    check(field);
  });

  ["input", "change"].forEach((type) =>
    document.addEventListener(type, (event) => {
      const field = event.target;
      if (!field.matches?.(FIELDS) || !managed(field.form)) return;
      customRules(field);
      if ("touched" in field.dataset || field.getAttribute("aria-invalid") === "true") check(field);
      // A confirmação depende da palavra-passe: volta a verificar quando esta muda
      const confirm = field.name === "password" && field.form.elements.confirm;
      if (confirm) {
        customRules(confirm);
        if ("touched" in confirm.dataset) check(confirm);
      }
    })
  );

  // Ao submeter, o browser valida e lança "invalid" em cada campo com erro (pela ordem do formulário).
  // Em vez da bolha do browser, mostra a mensagem junto de cada campo e põe o foco no primeiro.
  let firstInvalid = null;
  document.addEventListener(
    "invalid",
    (event) => {
      const field = event.target;
      if (!field.matches?.(FIELDS) || !managed(field.form)) return;
      event.preventDefault();
      field.dataset.touched = "";
      check(field);
      if (firstInvalid) return;
      firstInvalid = field;
      requestAnimationFrame(() => {
        firstInvalid.focus();
        firstInvalid = null;
      });
    },
    true
  );
})();
