(function () {
  const form = document.querySelector('#reset-password-form');
  const message = document.querySelector('#reset-password-message');
  const success = document.querySelector('#reset-password-success');
  const token = new URLSearchParams(window.location.search).get('token')?.trim() || '';

  function showError(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function clearError() {
    message.textContent = '';
    message.hidden = true;
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    form.hidden = true;
    showError('Link de recuperação inválido ou incompleto. Solicite um novo e-mail de recuperação de senha.');
  }

  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? 'Exibir' : 'Ocultar';
      button.setAttribute('aria-label', (visible ? 'Exibir' : 'Ocultar') + ' ' + (input.id.includes('confirmation') ? 'confirmação da senha' : 'nova senha'));
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearError();
    const password = form.elements.password;
    const passwordConfirmation = form.elements.passwordConfirmation;
    const button = form.querySelector('button[type=submit]');

    password.setCustomValidity('');
    passwordConfirmation.setCustomValidity('');
    if (password.value.length < 6) {
      password.setCustomValidity('A senha deve ter pelo menos 6 caracteres.');
      password.reportValidity();
      return;
    }
    if (password.value !== passwordConfirmation.value) {
      passwordConfirmation.setCustomValidity('A confirmação deve ser igual à nova senha.');
      passwordConfirmation.reportValidity();
      return;
    }
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = 'Redefinindo...';
    try {
      await AssofigAPI.resetPassword({ token, password: password.value, passwordConfirmation: passwordConfirmation.value });
      form.reset();
      form.hidden = true;
      success.hidden = false;
      window.history.replaceState({}, document.title, '/reset-password');
    } catch (error) {
      showError(error?.message || 'Não foi possível redefinir a senha. Solicite um novo link e tente novamente.');
    } finally {
      button.disabled = false;
      button.textContent = 'Redefinir senha';
    }
  });
})();
