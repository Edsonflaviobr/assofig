(function () {
  const form = document.getElementById('credential-validation-form');
  const input = document.getElementById('credential-code');
  const error = document.getElementById('credential-code-error');
  const loading = document.getElementById('validation-loading');
  const result = document.getElementById('validation-result');

  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function setFieldError(message) {
    error.textContent = message || '';
    error.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function resultDetails(data) {
    const labels = AssofigCredentials.credentialLabels(data.type);
    const category = data.type === 'carteira' && data.category
      ? '<div><dt>Categoria</dt><dd>' + escapeHtml(data.category) + '</dd></div>'
      : '';
    return '<dl><div><dt>' + labels.entityLabel + '</dt><dd>' + escapeHtml(data.name || 'Não informado') +
      '</dd></div>' + category + '<div><dt>Situação</dt><dd>' +
      escapeHtml(data.situation || 'Não informada') + '</dd></div><div><dt>Validade</dt><dd>' +
      escapeHtml(data.validityYear || 'Não informada') + '</dd></div></dl>';
  }

  function showResult(data) {
    result.className = 'validation-result';
    if (!data.found) {
      result.classList.add('is-invalid');
      result.innerHTML = '<span class="validation-result-icon" aria-hidden="true">×</span><div><h2>Credencial não localizada</h2>' +
        '<p>Credencial não localizada.</p></div>';
      result.hidden = false;
      return;
    }

    const labels = AssofigCredentials.credentialLabels(data.type);
    if (data.valid) {
      result.classList.add('is-valid');
      result.innerHTML = '<span class="validation-result-icon" aria-hidden="true">✓</span><div><h2>' +
        labels.validTitle + '</h2>' + resultDetails(data) + '</div>';
    } else {
      result.classList.add('is-warning');
      const title = data.situation === 'Suspensa'
        ? 'Credencial suspensa'
        : data.situation === 'Vencida' ? 'Credencial vencida' : 'Credencial inválida';
      const message = data.message || (data.situation === 'Suspensa'
        ? 'Esta credencial está temporariamente suspensa.'
        : data.situation === 'Vencida' ? 'Esta credencial está vencida.' : 'Esta credencial não está válida.');
      result.innerHTML = '<span class="validation-result-icon" aria-hidden="true">!</span><div><h2>' +
        escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p>' + resultDetails(data) + '</div>';
    }
    result.hidden = false;
  }

  input.addEventListener('input', () => {
    const normalized = AssofigCredentials.normalizeVerificationInput(input.value);
    if (input.value !== normalized) input.value = normalized;
    setFieldError('');
    result.hidden = true;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const code = AssofigCredentials.normalizeVerificationInput(input.value);
    input.value = code;
    setFieldError('');
    result.hidden = true;

    if (!AssofigCredentials.isVerificationCode(code)) {
      setFieldError('Informe um código válido com oito letras ou números.');
      input.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Verificando...';
    loading.hidden = false;

    try {
      const response = await AssofigAPI.validateCredential(code);
      showResult(AssofigCredentials.normalizeValidationResult(response));
    } catch {
      result.className = 'validation-result is-invalid';
      result.innerHTML = '<span class="validation-result-icon" aria-hidden="true">×</span><div>' +
        '<h2>Não foi possível verificar</h2><p>Não foi possível verificar a credencial neste momento. Tente novamente.</p></div>';
      result.hidden = false;
    } finally {
      loading.hidden = true;
      button.disabled = false;
      button.innerHTML = 'Verificar <span>→</span>';
    }
  });
})();
