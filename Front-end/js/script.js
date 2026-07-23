(function () {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const news = {
    crefito: { category: 'Institucional', title: 'CREFITO-4 MG e ASSOFIG dialogam sobre fortalecimento regional', body: '<p>O CREFITO-4 MG esteve em Guaxupé, no Sul de Minas, para uma reunião com a ASSOFIG.</p><p>A diretoria e as comissões apresentaram um plano de ações e o cronograma de atividades previstas para a região.</p><blockquote>O movimento associativista busca agregar e fortalecer profissionais por região, especialidade e área de atuação.</blockquote>' },
    corrida: { category: 'Parceria', title: 'ASSOFIG patrocina a 1ª corrida de rua da LIFOT', body: '<p>A ASSOFIG foi patrocinadora oficial do evento realizado pela LIFOT do UNIFEG.</p><p>A corrida aconteceu em 28 de setembro, em Guaxupé, e também marcou um encontro de fisioterapeutas e terapeutas ocupacionais.</p>' },
    retomada: { category: 'Associação', title: 'Assembleia marca a grande retomada da instituição', body: '<p>No final de setembro de 2025, a ASSOFIG realizou assembleia extraordinária para marcar a retomada da instituição.</p><p>O encontro mobilizou profissionais e estruturou uma nova etapa de atuação da associação.</p>' },
    fundacao: { category: 'Nossa história', title: 'O encontro que colocou a ASSOFIG no papel', body: '<p>Em 30 de junho de 2017, fisioterapeutas e terapeutas ocupacionais da Baixa Mogiana se reuniram para a leitura e aprovação do estatuto.</p><blockquote>O encontro transformou mobilização em uma associação organizada.</blockquote>' }
  };

  const memberFields = [
    { name: 'name', label: 'Nome completo', required: true },
    { name: 'email', label: 'E-mail', type: 'email', required: true },
    { name: 'document', label: 'CPF ou CNPJ', required: true },
    { name: 'phone', label: 'Telefone' },
    { name: 'profession', label: 'Profissão', type: 'profession', required: true },
    { name: 'registry', label: 'CREFITO / Matrícula' },
    { name: 'city', label: 'Cidade', required: true },
    { name: 'status', label: 'Situação', type: 'status', required: true }
  ];

  let privateState = { profile: null, access: null, members: [], adminPartners: [], adminEvents: [], loginResponse: null };

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function unwrap(response) {
    if (response == null) return null;
    return response.data?.user || response.data?.profile || response.data?.member ||
      response.user || response.profile || response.member || response.data || response;
  }

  function toArray(response, keys) {
    if (Array.isArray(response)) return response;
    for (const key of keys) {
      if (Array.isArray(response?.[key])) return response[key];
      if (Array.isArray(response?.data?.[key])) return response.data[key];
    }
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  function normalizeProfileResponse(response) {
    const payload = response && typeof response === 'object' && !Array.isArray(response) ? response : {};
    const root = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload;
    const userCandidate = root.user ?? payload.user ?? root;
    const user = userCandidate && typeof userCandidate === 'object' && !Array.isArray(userCandidate)
      ? userCandidate
      : {};
    const member = root.member ?? payload.member ?? null;
    const associado = root.associado ?? payload.associado ?? null;
    const profileEntity = root.profile ?? payload.profile ?? null;
    const permissionCandidate = root.permissions ?? payload.permissions ?? user.permissions ?? {};
    const permissions = permissionCandidate && typeof permissionCandidate === 'object' && !Array.isArray(permissionCandidate)
      ? permissionCandidate
      : {};
    const associadoId = user.associadoId ?? user.associationId ?? user.memberId ??
      member?.id ?? associado?.id ?? profileEntity?.id ?? null;

    return {
      user,
      permissions,
      member,
      associado,
      profile: profileEntity,
      associadoId,
      role: user.role ?? user.perfil ?? user.tipo ?? root.role ?? payload.role ?? '',
      mustChangePassword: Boolean(
        user.mustChangePassword ?? user.must_change_password ??
        root.mustChangePassword ?? root.must_change_password ??
        payload.mustChangePassword ?? payload.must_change_password
      )
    };
  }
  function normalizeMember(raw) {
    const source = unwrap(raw) || {};
    return {
      id: source.id ?? source.memberId ?? source.associadoId,
      name: source.name ?? source.nome ?? '',
      email: source.email ?? '',
      document: source.document ?? source.documento ?? source.cpfCnpj ?? '',
      phone: source.phone ?? source.telefone ?? '',
      profession: source.profession ?? source.profissao ?? '',
      registry: source.registry ?? source.crefito ?? source.matricula ?? '',
      city: source.city ?? source.cidade ?? '',
      status: source.status ?? source.situacao ?? 'active',
      role: source.role ?? source.perfil ?? source.tipo ?? '',
      associadoId: source.associadoId ?? source.associationId ?? source.memberId ?? source.associado?.id ?? null,
      permissions: source.permissions || null,
      mustChangePassword: Boolean(source.mustChangePassword ?? source.must_change_password)
    };
  }

  function normalizeMemberProfile(response) {
    const normalized = normalizeProfileResponse(response);
    const user = normalized.user;
    const member = normalized.member ?? normalized.associado ?? normalized.profile ?? {};
    const merged = {
      ...user,
      ...member,
      name: member.name ?? member.nome ?? user.name ?? user.nome ?? '',
      email: member.email ?? user.email ?? ''
    };
    const profile = normalizeMember(merged);
    const memberStatus = member.status ?? member.situacao ?? user.status ?? user.situacao;

    profile.associadoId = normalized.associadoId;
    profile.role = normalized.role || profile.role;
    profile.status = memberStatus ?? '';
    return profile;
  }
  function normalizeDefault(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      id: source.id ?? source.inadimplenciaId,
      status: source.status ?? source.situacao ?? 'pending',
      reference: source.reference ?? source.referencia ?? '-',
      referenceMonth: source.referenceMonth ?? source.reference_month ?? source.mesReferencia ?? '',
      amount: Number(source.amount ?? source.valor ?? 0),
      dueDate: source.dueDate ?? source.vencimento ?? source.due_date ?? '',
      proofSentAt: source.proofSentAt ?? source.proof_sent_at ?? source.comprovanteEnviadoEm ?? source.sentAt ?? ''
    };
  }

  function normalizePix(response) {
    const data = unwrap(response) || {};
    return {
      key: 'xxxxxxxxx',
      beneficiary: data.beneficiary ?? data.favoredName ?? data.favorecido ?? data.nomeFavorecido ?? ''
    };
  }

  function normalizePartner(raw) {
    const source = unwrap(raw) || {};
    return {
      id: source.id ?? source.partnerId,
      name: source.name ?? source.nome ?? '',
      email: source.email ?? '',
      document: source.document ?? source.documento ?? source.cpfCnpj ?? '',
      phone: source.phone ?? source.telefone ?? '',
      activity: source.activity ?? source.atividade ?? '',
      city: source.city ?? source.cidade ?? '',
      status: source.status ?? source.situacao ?? 'active'
    };
  }

  function normalizeEvent(raw) {
    const source = unwrap(raw) || {};
    return {
      id: source.id ?? source.eventId,
      name: source.name ?? source.nome ?? '',
      eventDate: source.eventDate ?? source.event_date ?? source.date ?? source.data ?? '',
      description: source.description ?? source.descricao ?? '',
      producer: source.producer ?? source.produtor ?? '',
      city: source.city ?? source.cidade ?? '',
      registrationStatus: source.registrationStatus ?? source.registration_status ?? source.status ?? '',
      registrationRequested: Boolean(
        source.registrationRequested ?? source.registration_requested ?? source.requested ?? false
      )
    };
  }

  function registrationStatusLabel(status) {
    return roleValue(status) === 'registration_open' ? 'Inscrições abertas' : 'Aguardando abertura das inscrições';
  }

  function eventIsPast(item) {
    if (!item.eventDate) return false;
    const eventDate = new Date(String(item.eventDate).slice(0, 10) + 'T23:59:59');
    return !Number.isNaN(eventDate.getTime()) && eventDate < new Date();
  }
  const roleValue = value => String(value || '').trim().toLowerCase();
  const isDirectorRole = value => ['admin', 'director', 'diretor', 'diretora', 'diretoria', 'board', 'administrator', 'administrador', 'administradora'].includes(roleValue(value));
  function permissionValue(sources, key) {
    for (const source of sources) {
      if (typeof source?.[key] === 'boolean') return source[key];
    }
    return null;
  }

  function requiresPasswordChange(response) {
    return normalizeProfileResponse(response).mustChangePassword;
  }

  function buildAccessContext(profileResponse, loginResponse) {
    const profileData = normalizeProfileResponse(profileResponse);
    const loginData = normalizeProfileResponse(loginResponse);
    const profile = normalizeMemberProfile(profileResponse);
    const memberPermission = permissionValue(
      [profileData.permissions, loginData.permissions],
      'canAccessMemberArea'
    );
    const adminPermission = permissionValue(
      [profileData.permissions, loginData.permissions],
      'canAccessAdminArea'
    );
    const associadoId = profileData.associadoId ?? loginData.associadoId ?? null;
    const role = profileData.role || loginData.role || profile.role;

    profile.associadoId = associadoId;
    return {
      canAccessMemberArea: memberPermission === null ? Boolean(associadoId) : memberPermission,
      canAccessAdminArea: adminPermission === null ? isDirectorRole(role) : adminPermission,
      associadoId,
      role,
      profile
    };
  }
  const firstName = name => String(name || 'Associado').trim().split(/\s+/)[0];
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function dateBr(value) {
    if (!value) return '-';
    const date = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
  }

  function normalizePublicEvent(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      id: source.id ?? '',
      name: source.name ?? '',
      eventDate: source.eventDate ?? '',
      description: source.description ?? ''
    };
  }

  function publicEventsHtml(events) {
    if (!events.length) {
      return '<p class="public-events-empty">Em breve, novas capacitações, encontros e ações regionais.</p>';
    }

    return '<div class="public-events-list">' + events.map((item, index) => {
      const buttonId = 'public-event-button-' + index;
      const detailsId = 'public-event-details-' + index;
      const eventName = item.name || 'Evento';
      return '<article class="public-event-item"><button class="public-event-toggle" id="' + buttonId +
        '" type="button" aria-expanded="false" aria-controls="' + detailsId +
        '" aria-label="Ver detalhes do evento ' + escapeHtml(eventName) + '"><span class="public-event-summary"><strong class="public-event-name">' +
        escapeHtml(eventName) + '</strong><time datetime="' + escapeHtml(String(item.eventDate || '').slice(0, 10)) + '">' +
        escapeHtml(dateBr(item.eventDate)) + '</time></span><span class="public-event-plus" aria-hidden="true">+</span></button>' +
        '<div class="public-event-details" id="' + detailsId + '" role="region" aria-labelledby="' + buttonId +
        '" aria-hidden="true"><div class="public-event-details-inner"><p class="public-event-description">' +
        escapeHtml(item.description || 'Descrição não informada.') + '</p><p class="public-event-contact">Dúvidas? Entre em contato com a ASSOFIG.</p>' +
        '</div></div></article>';
    }).join('') + '</div>';
  }

  function bindPublicEventsAccordion(container) {
    const items = $$('.public-event-item', container);
    const closeItem = item => {
      const button = $('.public-event-toggle', item);
      const details = $('.public-event-details', item);
      const name = $('.public-event-name', item)?.textContent || 'evento';
      item.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Ver detalhes do evento ' + name);
      details.setAttribute('aria-hidden', 'true');
    };

    items.forEach(item => $('.public-event-toggle', item).addEventListener('click', () => {
      const shouldOpen = !item.classList.contains('open');
      items.forEach(closeItem);
      if (!shouldOpen) return;
      const button = $('.public-event-toggle', item);
      const details = $('.public-event-details', item);
      const name = $('.public-event-name', item)?.textContent || 'evento';
      item.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'Fechar detalhes do evento ' + name);
      details.setAttribute('aria-hidden', 'false');
    }));
  }

  async function loadPublicEvents() {
    const container = $('#public-events');
    if (!container) return;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<div class="public-events-status"><span class="public-events-spinner" aria-hidden="true"></span><p>Carregando próximos eventos...</p></div>';
    try {
      const response = await AssofigAPI.listPublicEvents();
      const events = toArray(response, ['events', 'eventos', 'items']).map(normalizePublicEvent);
      container.innerHTML = publicEventsHtml(events);
      if (events.length) bindPublicEventsAccordion(container);
    } catch (error) {
      container.innerHTML = '<div class="public-events-status is-error" role="alert"><p>' +
        escapeHtml(friendlyError(error, 'Não foi possível carregar os próximos eventos.')) +
        '</p><button type="button" data-retry-public-events>Tentar novamente</button></div>';
      $('[data-retry-public-events]', container)?.addEventListener('click', loadPublicEvents);
    } finally {
      container.setAttribute('aria-busy', 'false');
    }
  }
  function statusLabel(status) {
    const value = roleValue(status);
    if (['active', 'ativo', 'paid', 'regular'].includes(value)) return 'Em dia';
    if (['late', 'inadimplente', 'overdue', 'pending_payment'].includes(value)) return 'Inadimplente';
    if (['pending', 'pendente'].includes(value)) return 'Pendente';
    if (['regularized', 'regularizado'].includes(value)) return 'Regularizada';
    return status || 'Não informado';
  }

  function statusClass(status) {
    return ['late', 'inadimplente', 'overdue', 'pending_payment'].includes(roleValue(status)) ? 'late' : 'active';
  }

  function defaultIsOpen(item) {
    return !['regularized', 'regularizado', 'paid', 'pago'].includes(roleValue(item.status));
  }

  function defaultClass(item) {
    return defaultIsOpen(item) ? 'late' : 'active';
  }

  function defaultReference(item) {
    const value = String(item.referenceMonth || item.reference || '').trim();
    if (!value || value === '-') return 'Não informada';
    const isoMatch = value.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) return isoMatch[2] + '/' + isoMatch[1];
    const brMatch = value.match(/^(\d{2})\/(\d{4})$/);
    if (brMatch) return value;
    return value;
  }

  function memberDefaultStatus(status) {
    const value = roleValue(status).replace(/[\s-]+/g, '_');
    if (['open', 'opened', 'em_aberto', 'pending', 'pendente', 'late', 'overdue', 'pending_payment', 'inadimplente'].includes(value)) {
      return 'Em aberto';
    }
    if (['proof_sent', 'comprovante_enviado', 'awaiting_review', 'under_review', 'aguardando_conferencia'].includes(value)) {
      return 'Comprovante enviado — aguardando conferência';
    }
    if (['paid', 'pago', 'quitada', 'regularized', 'regularizado', 'resolved'].includes(value)) return 'Quitada';
    return statusLabel(status);
  }

  function memberDefaultIsOpen(item) {
    const value = roleValue(item.status).replace(/[\s-]+/g, '_');
    return ['open', 'opened', 'em_aberto', 'pending', 'pendente', 'late', 'overdue', 'pending_payment', 'inadimplente'].includes(value);
  }

  function memberDefaultClass(item) {
    const label = memberDefaultStatus(item.status);
    if (label === 'Em aberto') return 'late';
    if (label.startsWith('Comprovante enviado')) return 'pending';
    return 'active';
  }

  function fileSizeLabel(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' KB';
    return (bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB';
  }

  function proofFileError(file) {
    if (!file) return 'Selecione um arquivo para continuar.';
    const extension = String(file.name || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedExtensions.includes(extension) || (file.type && !allowedTypes.includes(file.type))) {
      return 'Formato inválido. Envie um arquivo PDF, JPG, JPEG ou PNG.';
    }
    if (file.size > 10 * 1024 * 1024) return 'O arquivo deve ter no máximo 10 MB.';
    return '';
  }

  function friendlyError(error, fallback) {
    const candidates = [error?.message, error?.data?.message, error?.data?.error?.message, error?.data?.error];
    const message = candidates.find(value => typeof value === 'string' && value.trim());
    return message && message !== '[object Object]' ? message : fallback;
  }
  const documentDigits = value => String(value || '').replace(/\D/g, '');

  function validCPF(value) {
    const d = documentDigits(value);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const digit = (base, factor) => {
      let sum = 0;
      for (const n of base) sum += Number(n) * factor--;
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return digit(d.slice(0, 9), 10) === Number(d[9]) && digit(d.slice(0, 10), 11) === Number(d[10]);
  }

  function validCNPJ(value) {
    const d = documentDigits(value);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (base, weights) => {
      const sum = Array.from(base).reduce((total, n, i) => total + Number(n) * weights[i], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    return calc(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[12]) &&
      calc(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[13]);
  }

  function validDocument(value) {
    const d = documentDigits(value);
    return d.length === 11 ? validCPF(d) : d.length === 14 ? validCNPJ(d) : false;
  }

  function formatDocument(value) {
    const d = documentDigits(value).slice(0, 14);
    if (d.length <= 11) {
      return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }
  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => element.classList.remove('show'), 4200);
  }

  function openModal(id) {
    $$('.modal').forEach(modal => { modal.hidden = true; });
    const modal = $('#' + id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => $('.modal-close', modal)?.focus(), 10);
  }

  function closeModals() {
    $$('.modal').forEach(modal => { modal.hidden = true; });
    if ($('#access-portal').hidden && $('#member-portal').hidden && $('#admin-portal').hidden) document.body.classList.remove('modal-open');
  }

  function dynamicModal(content, className) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="modal-backdrop"></div><div class="modal-panel ' + escapeHtml(className || '') + '"><button class="modal-close" type="button" aria-label="Fechar">×</button>' + content + '</div>';
    document.body.appendChild(modal);
    const onKeyDown = event => { if (event.key === 'Escape') close(); };
    const close = () => {
      document.removeEventListener('keydown', onKeyDown);
      modal.remove();
    };
    $('.modal-close', modal).addEventListener('click', close);
    $('.modal-backdrop', modal).addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    setTimeout(() => $('.modal-close', modal)?.focus(), 10);
    return { modal, close };
  }

  function setAssociationMode(enabled, forceAssociate) {
    const field = $('#association-document-field');
    const input = $('[name=document]', field);
    const subject = $('#contact-form [name=subject]');
    field.hidden = !enabled;
    input.required = enabled;
    if (enabled) {
      if (forceAssociate) subject.value = 'Quero me associar';
      setTimeout(() => input.focus(), 550);
    } else {
      input.value = '';
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    }
  }

  function setProfessionOtherMode(value) {
    const field = $('#profession-other-field');
    const input = $('#contact-profession-other');
    const enabled = value === 'Outro';
    field.hidden = !enabled;
    input.required = enabled;
    if (!enabled) input.value = '';
  }

  function setContactFieldError(form, name, message) {
    const errorName = name === 'professionOther' ? 'profession' : name;
    const error = $('#contact-' + errorName + '-error');
    const field = form.elements.namedItem(name) || form.elements.namedItem(errorName);
    if (error) {
      error.textContent = message || '';
      error.hidden = !message;
    }
    if (message) field?.setAttribute('aria-invalid', 'true');
    else field?.removeAttribute('aria-invalid');
  }

  function clearContactErrors(form) {
    ['name', 'email', 'profession', 'professionOther', 'phone', 'city', 'subject', 'message'].forEach(name =>
      setContactFieldError(form, name, '')
    );
  }

  function contactPayload(form) {
    clearContactErrors(form);
    const values = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      profession: form.elements.profession.value.trim(),
      professionOther: form.elements.professionOther.value.trim(),
      phone: form.elements.phone.value.trim(),
      city: form.elements.city.value.trim(),
      subject: form.elements.subject.value.trim(),
      message: form.elements.message.value.trim()
    };
    let valid = true;
    const invalidate = (name, message) => {
      setContactFieldError(form, name, message);
      valid = false;
    };

    if (!values.name) invalidate('name', 'Informe seu nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) invalidate('email', 'Informe um e-mail válido.');
    if (!values.profession) invalidate('profession', 'Selecione sua profissão.');
    if (values.profession === 'Outro' && !values.professionOther) {
      invalidate('professionOther', 'Informe sua profissão.');
    }
    const phoneDigits = values.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) invalidate('phone', 'Informe um telefone válido.');
    if (!values.city) invalidate('city', 'Informe sua cidade.');
    if (!['Dúvida', 'Quero me associar', 'Eventos', 'Parcerias'].includes(values.subject)) {
      invalidate('subject', 'Selecione um assunto válido.');
    }
    if (!values.message) invalidate('message', 'Escreva sua mensagem.');
    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return null;
    }

    return {
      name: values.name,
      email: values.email,
      profession: values.profession === 'Outro' ? 'Outro - ' + values.professionOther : values.profession,
      phone: values.phone,
      city: values.city,
      subject: values.subject,
      message: values.message || ''
    };
  }
  function loadingContent(title) {
    return '<div class="portal-loading"><span class="loading-spinner" aria-hidden="true"></span><h2>' + escapeHtml(title || 'Carregando dados') + '</h2><p>Aguarde um instante.</p></div>';
  }

  function portalLayout(role, profile, content) {
    const director = role === 'admin';
    const name = profile?.name || (director ? 'Diretoria' : 'Associado');
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
    const nav = director
      ? '<button class="active" data-portal-target="admin-overview">▦ Visão geral</button><button data-portal-target="member-management">♙ Associados</button><button data-portal-target="partner-management">◇ Parceiros ou Benefícios</button><button data-portal-target="event-management">◫ Eventos</button>'
      : '<button class="active" data-portal-target="member-overview">▦ Visão geral</button><button data-portal-target="my-data">♙ Meus dados</button><button data-portal-target="my-defaults">! Pendências</button><button data-portal-target="member-partners">◇ Parceiros ou Benefícios</button><button data-portal-target="member-events">◫ Próximos eventos</button>';
    const switchAction = privateState.access?.canAccessMemberArea && privateState.access?.canAccessAdminArea
      ? '<button class="portal-switch" type="button" data-switch-area>⇄ Trocar de área</button>'
      : '';

    return '<div class="portal-shell"><aside class="portal-sidebar"><div class="portal-logo"><img src="img/assofig.jpg" alt=""><strong>ASSOFIG<small>' +
      (director ? 'Painel da diretoria' : 'Portal do associado') + '</small></strong></div><div class="portal-user"><div class="avatar">' +
      escapeHtml(initials) + '</div><div><strong>' + escapeHtml(name) + '</strong><small>' +
      escapeHtml(director ? 'Diretoria' : profile?.profession || 'Associado') + '</small></div></div><nav class="portal-nav">' +
      nav + '</nav>' + switchAction + '<button class="portal-logout" type="button">← Sair da área privativa</button></aside><main class="portal-main">' +
      content + '</main></div>';
  }

  function bindPortalCommon(portal) {
    $('.portal-logout', portal)?.addEventListener('click', logout);
    $('[data-switch-area]', portal)?.addEventListener('click', showAccessHub);
    if (portal.id === 'member-portal' && !$('[data-portal-target="my-credential"]', portal)) {
      $('[data-portal-target="my-data"]', portal)?.insertAdjacentHTML(
        'afterend', '<button data-portal-target="my-credential">▣ Credencial digital</button>'
      );
    }
    $$('[data-portal-target]', portal).forEach(button => button.addEventListener('click', () => {
      $('#' + button.dataset.portalTarget, portal)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  function hidePrivateAreas() {
    ['access-portal', 'member-portal', 'admin-portal'].forEach(id => { $('#' + id).hidden = true; });
  }

  function logout() {
    localStorage.removeItem('assofig_token');
    privateState = { profile: null, access: null, members: [], adminPartners: [], adminEvents: [], loginResponse: null };
    hidePrivateAreas();
    document.body.classList.remove('modal-open');
    toast('Sessão encerrada.');
  }

  function showSessionExpired() {
    privateState = { profile: null, access: null, members: [], adminPartners: [], adminEvents: [], loginResponse: null };
    hidePrivateAreas();
    document.body.classList.remove('modal-open');
    openModal('login-modal');
    toast('Sua sessão expirou. Entre novamente.');
  }

  function accessCard(area, title, description, icon) {
    return '<button class="access-card" type="button" data-access-area="' + area + '"><span class="access-card-icon" aria-hidden="true">' +
      icon + '</span><strong>' + title + '</strong><span>' + description + '</span><em>Acessar <b>→</b></em></button>';
  }

  function showAccessHub() {
    const access = privateState.access;
    if (!access) return;
    hidePrivateAreas();
    const portal = $('#access-portal');
    const cards = [];
    if (access.canAccessMemberArea) {
      cards.push(accessCard('member', 'Área do Associado', 'Consulte seus dados, mensalidades e pendências.', '♙'));
    }
    if (access.canAccessAdminArea) {
      cards.push(accessCard('admin', 'Painel Administrativo', 'Gerencie associados e informações financeiras.', '▦'));
    }
    const content = cards.length
      ? '<div class="access-options">' + cards.join('') + '</div>'
      : '<div class="access-denied"><strong>Acesso não autorizado</strong><p>Seu usuário não possui uma área liberada. Entre em contato com a ASSOFIG.</p></div>';

    portal.innerHTML = '<div class="access-hub"><header class="access-hub-header"><img src="img/assofig.jpg" alt="ASSOFIG"><div><span>Área privativa</span><h1>Escolha uma área</h1><p>Olá, ' +
      escapeHtml(firstName(privateState.profile?.name)) + '. Selecione como deseja continuar.</p></div></header>' + content +
      '<button class="access-logout" type="button">← Sair da área privativa</button></div>';
    portal.hidden = false;
    document.body.classList.add('modal-open');
    $$('[data-access-area]', portal).forEach(button => button.addEventListener('click', () => {
      if (button.dataset.accessArea === 'admin') enterAdminArea();
      else enterMemberArea();
    }));
    $('.access-logout', portal).addEventListener('click', logout);
  }

  async function enterMemberArea() {
    if (!privateState.access?.canAccessMemberArea) {
      toast('Acesso não autorizado à Área do Associado.');
      showAccessHub();
      return;
    }
    hidePrivateAreas();
    const portal = $('#member-portal');
    portal.hidden = false;
    try {
      const profileResponse = await AssofigAPI.getProfile();
      const refreshedAccess = buildAccessContext(profileResponse, privateState.loginResponse);
      if (!refreshedAccess.canAccessMemberArea) {
        const accessError = new Error('Acesso não autorizado à Área do Associado.');
        accessError.status = 403;
        throw accessError;
      }
      privateState.access = refreshedAccess;
      privateState.profile = refreshedAccess.profile;
      await renderMemberPortal(refreshedAccess.profile);
    } catch (error) {
      if (error.status === 403) {
        portal.hidden = true;
        showAccessHub();
        toast('Acesso não autorizado a este recurso da Área do Associado.');
        return;
      }
      if (error.status !== 401) toast(error.message || 'Não foi possível carregar a Área do Associado.');
    }
  }

  async function enterAdminArea() {
    if (!privateState.access?.canAccessAdminArea) {
      toast('Acesso não autorizado ao Painel Administrativo.');
      showAccessHub();
      return;
    }
    hidePrivateAreas();
    const portal = $('#admin-portal');
    portal.hidden = false;
    try {
      await renderAdminPortal(privateState.profile);
    } catch (error) {
      if (error.status === 403) {
        portal.hidden = true;
        showAccessHub();
        toast('Acesso não autorizado ao Painel Administrativo.');
        return;
      }
      if (error.status !== 401) toast(error.message || 'Não foi possível carregar o Painel Administrativo.');
    }
  }

  async function initializeRestrictedArea(loginResponse) {
    if (!localStorage.getItem('assofig_token')) {
      openModal('login-modal');
      toast('Entre para acessar a área privativa.');
      return;
    }

    hidePrivateAreas();
    const portal = $('#access-portal');
    portal.innerHTML = '<div class="access-hub">' + loadingContent('Validando seu acesso') + '</div>';
    portal.hidden = false;
    document.body.classList.add('modal-open');

    try {
      const response = await AssofigAPI.getProfile();
      if (requiresPasswordChange(response) || requiresPasswordChange(loginResponse)) {
        portal.hidden = true;
        openModal('mandatory-password-modal');
        return;
      }
      privateState.loginResponse = loginResponse || privateState.loginResponse;
      privateState.access = buildAccessContext(response, privateState.loginResponse);
      privateState.profile = privateState.access.profile;
      showAccessHub();
    } catch (error) {
      portal.hidden = true;
      document.body.classList.remove('modal-open');
      if (error.status === 403) {
        portal.innerHTML = '<div class="access-hub"><div class="access-denied"><strong>Acesso não autorizado</strong><p>Não foi possível consultar as permissões deste usuário.</p><button class="btn btn-blue access-logout" type="button">Sair</button></div></div>';
        portal.hidden = false;
        document.body.classList.add('modal-open');
        $('.access-logout', portal).addEventListener('click', logout);
      }
      if (error.status !== 401) toast(error.message || 'Não foi possível validar seu acesso.');
    }
  }

  function profileDataHtml(profile) {
    return memberFields.map(field => {
      let value = profile[field.name];
      if (field.name === 'document') value = formatDocument(value);
      if (field.name === 'phone') value = formatPhone(value);
      if (field.name === 'status') value = statusLabel(value);
      return '<div><small>' + escapeHtml(field.label) + '</small><strong>' + escapeHtml(value || 'Não informado') + '</strong></div>';
    }).join('');
  }

  function defaultsHtml(defaults) {
    const guidance = '<div class="default-guidance"><p>Os pagamentos pendentes da ASSOFIG podem ser regularizados por PIX. Após realizar o pagamento, envie o comprovante correspondente à inadimplência pelo botão disponível abaixo.</p>' +
      '<p>O comprovante será encaminhado ao setor financeiro da ASSOFIG para conferência. O envio do arquivo não representa quitação automática. A situação será atualizada pela Diretoria após a confirmação do pagamento.</p></div>';
    if (!defaults.length) {
      return guidance + '<div class="empty-state"><span>✓</span><strong>Você não possui inadimplências pendentes.</strong></div>';
    }
    return guidance + '<div class="member-defaults-list">' + defaults.map(item => {
      const inputId = 'proof-file-' + escapeHtml(item.id);
      const proofDate = item.proofSentAt
        ? '<div><small>Comprovante enviado em</small><strong>' + escapeHtml(dateBr(item.proofSentAt)) + '</strong></div>'
        : '';
      const upload = memberDefaultIsOpen(item) && item.id != null
        ? '<div class="proof-upload"><input class="visually-hidden proof-file-input" id="' + inputId + '" data-proof-input="' +
          escapeHtml(item.id) + '" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby="proof-help-' +
          escapeHtml(item.id) + '"><label class="btn btn-blue proof-upload-label" for="' + inputId + '" tabindex="0" role="button">Enviar comprovante</label>' +
          '<small id="proof-help-' + escapeHtml(item.id) + '">PDF, JPG, JPEG ou PNG — máximo de 10 MB.</small>' +
          '<p class="proof-card-error" data-proof-error="' + escapeHtml(item.id) + '" role="alert" hidden></p></div>'
        : '';
      return '<article class="member-default-card"><div class="member-default-data"><div><small>Referência</small><strong>' +
        escapeHtml(defaultReference(item)) + '</strong></div><div><small>Valor</small><strong>' + escapeHtml(money(item.amount)) +
        '</strong></div><div><small>Vencimento</small><strong>' + escapeHtml(dateBr(item.dueDate)) +
        '</strong></div><div><small>Situação</small><span class="status-pill ' + memberDefaultClass(item) + '">' +
        escapeHtml(memberDefaultStatus(item.status)) + '</span></div>' + proofDate + '</div>' + upload + '</article>';
    }).join('') + '</div>';
  }

  function openProofConfirmation(item, file, refresh) {
    const dialog = dynamicModal(
      '<span class="eyebrow">Comprovante</span><h2>Confirmar envio</h2><p>Confira o arquivo e a inadimplência antes de enviar.</p>' +
      '<form class="proof-confirmation-form"><div class="proof-summary"><div><small>Arquivo</small><strong>' + escapeHtml(file.name) +
      '</strong></div><div><small>Tamanho</small><strong>' + escapeHtml(fileSizeLabel(file.size)) +
      '</strong></div><div><small>Referência</small><strong>' + escapeHtml(defaultReference(item)) +
      '</strong></div><div><small>Valor</small><strong>' + escapeHtml(money(item.amount)) +
      '</strong></div><div><small>Vencimento</small><strong>' + escapeHtml(dateBr(item.dueDate)) +
      '</strong></div></div><p class="proof-confirmation-error" role="alert" hidden></p><div class="proof-confirmation-actions">' +
      '<button class="btn btn-secondary" type="button" data-cancel-proof>Cancelar</button>' +
      '<button class="btn btn-blue" type="submit">Enviar comprovante</button></div></form>',
      'proof-confirmation-panel'
    );
    dialog.modal.setAttribute('role', 'dialog');
    dialog.modal.setAttribute('aria-modal', 'true');
    $('[data-cancel-proof]', dialog.modal).addEventListener('click', dialog.close);
    $('.proof-confirmation-form', dialog.modal).addEventListener('submit', async event => {
      event.preventDefault();
      const button = $('button[type=submit]', event.currentTarget);
      const alert = $('.proof-confirmation-error', event.currentTarget);
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Enviando comprovante...';
      alert.hidden = true;
      try {
        await AssofigAPI.uploadMyDefaultProof(item.id, file);
        dialog.close();
        toast('Comprovante enviado com sucesso. Seu pagamento será conferido pela Diretoria.');
        await refresh();
      } catch (error) {
        alert.textContent = friendlyError(error, 'Não foi possível enviar o comprovante. Tente novamente.');
        alert.hidden = false;
        button.disabled = false;
        button.textContent = 'Enviar comprovante';
      }
    });
  }

  function bindMemberProofUploads(portal, defaults) {
    const items = Array.isArray(defaults) ? defaults : [];
    $$('[data-proof-input]', portal).forEach(input => {
      const item = items.find(candidate => String(candidate.id) === String(input.dataset.proofInput));
      const label = $('label[for="' + input.id + '"]', portal);
      label?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      });
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        const error = proofFileError(file);
        const alert = $('[data-proof-error="' + input.dataset.proofInput + '"]', portal);
        input.value = '';
        if (error || !item) {
          alert.textContent = error || 'Não foi possível identificar a inadimplência selecionada.';
          alert.hidden = false;
          return;
        }
        alert.hidden = true;
        openProofConfirmation(item, file, () => renderMemberPortal(privateState.profile));
      });
    });
  }

  function pixHtml(pix) {
    if (!pix.key) {
      return '<div class="empty-state"><strong>Informações de pagamento indisponíveis.</strong><span>Entre em contato com a tesouraria.</span></div>';
    }
    return '<div class="pix-payment"><p>Realize o pagamento utilizando a chave PIX abaixo.</p><div class="pix-box"><small>Chave PIX</small><strong class="pix-key">' +
      escapeHtml(pix.key) + '</strong><small>Favorecido</small><strong>' +
      escapeHtml(pix.beneficiary || 'Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região') +
      '</strong></div><button class="btn btn-blue" type="button" data-copy-pix>Copiar chave PIX</button></div>';
  }

  function memberPartnersHtml(partners) {
    if (!partners.length) {
      return '<div class="empty-state"><strong>Nenhum parceiro ou benefício disponível no momento.</strong></div>';
    }
    return '<div class="catalog-card-grid">' + partners.map(partner =>
      '<article class="catalog-card"><div class="catalog-card-heading"><span class="catalog-icon">◇</span><div><h3>' +
      escapeHtml(partner.name || 'Parceiro') + '</h3><p>' + escapeHtml(partner.activity || 'Atividade não informada') +
      '</p></div></div><dl><div><dt>Cidade</dt><dd>' + escapeHtml(partner.city || 'Não informada') +
      '</dd></div><div><dt>Telefone</dt><dd>' + escapeHtml(formatPhone(partner.phone) || 'Não informado') +
      '</dd></div><div><dt>E-mail</dt><dd>' + escapeHtml(partner.email || 'Não informado') +
      '</dd></div>' + (partner.document ? '<div><dt>CPF ou CNPJ</dt><dd>' + escapeHtml(formatDocument(partner.document)) +
      '</dd></div>' : '') + '</dl><button class="btn btn-blue" type="button" data-partner-question="' +
      escapeHtml(partner.id) + '">Tenho uma dúvida</button></article>'
    ).join('') + '</div>';
  }

  function memberEventsHtml(events) {
    if (!events.length) {
      return '<div class="empty-state"><strong>Não há próximos eventos disponíveis no momento.</strong></div>';
    }
    return '<div class="catalog-card-grid">' + events.map(item => {
      let action;
      if (item.registrationRequested) {
        action = '<button class="btn btn-secondary" type="button" disabled>Solicitação feita</button>';
      } else if (roleValue(item.registrationStatus) === 'registration_open') {
        action = '<button class="btn btn-blue" type="button" data-register-event="' + escapeHtml(item.id) +
          '">Solicitar inscrição</button>';
      } else {
        action = '<span class="registration-waiting">Inscrições ainda não liberadas</span>';
      }
      return '<article class="catalog-card event-card"><div class="catalog-card-heading"><span class="catalog-icon">◫</span><div><h3>' +
        escapeHtml(item.name || 'Evento') + '</h3><p>' + escapeHtml(dateBr(item.eventDate)) + '</p></div></div><p class="catalog-description">' +
        escapeHtml(item.description || 'Descrição não informada') + '</p><dl><div><dt>Produtor</dt><dd>' +
        escapeHtml(item.producer || 'Não informado') + '</dd></div><div><dt>Cidade</dt><dd>' +
        escapeHtml(item.city || 'Não informada') + '</dd></div><div><dt>Inscrições</dt><dd>' +
        escapeHtml(registrationStatusLabel(item.registrationStatus)) + '</dd></div></dl><div class="catalog-card-action">' + action + '</div></article>';
    }).join('') + '</div>';
  }

  function openPartnerQuestion(partner) {
    const dialog = dynamicModal(
      '<span class="eyebrow">Parceiros ou Benefícios</span><h2>Tenho uma dúvida</h2><p>Mensagem sobre <strong>' +
      escapeHtml(partner.name) + '</strong> — ' + escapeHtml(partner.activity || 'benefício') + '.</p>' +
      '<form class="catalog-message-form"><label for="partner-question-message">Sua dúvida</label>' +
      '<textarea id="partner-question-message" name="message" rows="5" maxlength="5000" required></textarea>' +
      '<p class="catalog-form-error" role="alert" hidden></p><div class="catalog-form-actions">' +
      '<button class="btn btn-secondary" type="button" data-cancel-question>Cancelar</button>' +
      '<button class="btn btn-blue" type="submit">Enviar mensagem</button></div></form>',
      'catalog-editor-panel'
    );
    $('[data-cancel-question]', dialog.modal).addEventListener('click', dialog.close);
    $('.catalog-message-form', dialog.modal).addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = form.elements.message.value.trim();
      const errorBox = $('.catalog-form-error', form);
      const button = $('button[type=submit]', form);
      if (!message) {
        errorBox.textContent = 'Escreva sua dúvida.';
        errorBox.hidden = false;
        return;
      }
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Enviando...';
      errorBox.hidden = true;
      try {
        await AssofigAPI.sendPartnerQuestion(partner.id, message);
        dialog.close();
        toast('Mensagem enviada. Aguarde as instruções da Diretoria por e-mail.');
      } catch (error) {
        errorBox.textContent = friendlyError(error, 'Não foi possível enviar sua mensagem. Tente novamente.');
        errorBox.hidden = false;
        button.disabled = false;
        button.textContent = 'Enviar mensagem';
      }
    });
  }

  function bindMemberPartners(portal, partners) {
    $$('[data-partner-question]', portal).forEach(button => button.addEventListener('click', () => {
      const partner = partners.find(item => String(item.id) === String(button.dataset.partnerQuestion));
      if (partner) openPartnerQuestion(partner);
    }));
  }

  async function reloadMemberEvents(portal) {
    const container = $('[data-member-events-content]', portal);
    if (!container) return;
    container.innerHTML = loadingContent('Atualizando próximos eventos');
    try {
      const response = await AssofigAPI.listUpcomingEvents();
      const events = toArray(response, ['events', 'eventos', 'items']).map(normalizeEvent);
      container.innerHTML = memberEventsHtml(events);
      bindMemberEvents(portal, events);
    } catch (error) {
      container.innerHTML = '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(error, 'Não foi possível carregar os próximos eventos.')) + '</strong></div>';
    }
  }

  function bindMemberEvents(portal, events) {
    $$('[data-register-event]', portal).forEach(button => button.addEventListener('click', async () => {
      const item = events.find(event => String(event.id) === String(button.dataset.registerEvent));
      if (!item || button.disabled) return;
      if (!window.confirm('Deseja solicitar inscrição em ' + item.name + '?')) return;
      button.disabled = true;
      button.textContent = 'Solicitando...';
      try {
        await AssofigAPI.requestEventRegistration(item.id);
        toast('Solicitação realizada. Aguarde a confirmação da Diretoria pelo seu e-mail.');
        await reloadMemberEvents(portal);
      } catch (error) {
        if (error.status === 409 && /já foi solicitada/i.test(error.message || '')) {
          button.textContent = 'Solicitação feita';
          button.disabled = true;
          toast('A inscrição para este evento já foi solicitada.');
          return;
        }
        toast(friendlyError(error, 'Não foi possível solicitar a inscrição. Tente novamente.'));
        button.disabled = false;
        button.textContent = 'Solicitar inscrição';
      }
    }));
  }
  function credentialStatusText(credential) {
    if (credential.status === 'suspensa') return 'Suspensa';
    if (credential.status === 'vencida') return 'Vencida';
    return credential.type === 'certificado' ? 'Ativa' : 'Ativo';
  }

  function credentialStatusClass(credential) {
    if (credential.status === 'suspensa') return 'late';
    if (credential.status === 'vencida') return 'late';
    return 'active';
  }

  function credentialFieldHtml(name, value, spec, preferredLength, minimumScale) {
    if (value == null || value === '') return '';
    const scale = AssofigCredentials.fitScale(value, preferredLength, minimumScale);
    return '<span class="credential-field credential-field-' + name + '" style="left:' +
      (spec.x * 100) + '%;top:' + (spec.y * 100) + '%;width:' + (spec.width * 100) +
      '%;height:' + (spec.height * 100) + '%;--credential-fit:' + scale + '">' +
      escapeHtml(value) + '</span>';
  }

  function credentialArtHtml(template, credential) {
    const spec = AssofigCredentials.TEMPLATE_SPECS[template];
    const category = credential.category === 'Terap. Ocupacional'
      ? 'Terapeuta Ocupacional'
      : credential.category;
    const values = {
      name: credential.displayName,
      category,
      validity: credential.validityYear == null ? '' : String(credential.validityYear),
      code: credential.verificationCode
    };
    const fieldOptions = template === 'certificado'
      ? { name: [42, 0.46], validity: [4, 1], code: [9, 0.8] }
      : { name: [27, 0.56], category: [22, 0.58], validity: [4, 1], code: [9, 0.78] };

    return '<div class="credential-art credential-art-' + template + '">' +
      '<img src="' + spec.src + '" alt="' + escapeHtml(spec.alt) + '">' +
      Object.entries(spec.fields).map(([field, fieldSpec]) => {
        const options = fieldOptions[field] || [20, 0.5];
        return credentialFieldHtml(field, values[field], fieldSpec, options[0], options[1]);
      }).join('') + '</div>';
  }

  function credentialPanelHtml(profile, credential, loadError) {
    if (loadError) {
      return '<div class="credential-heading"><div><h2>Credencial digital</h2><p>Documento exclusivo do associado.</p></div></div>' +
        '<div class="credential-message error" role="alert"><strong>Não foi possível carregar sua credencial neste momento.</strong>' +
        '<button class="btn-small" type="button" data-retry-credential>Tentar novamente</button></div>';
    }

    const type = AssofigCredentials.credentialTypeFor(profile, credential);
    const labels = AssofigCredentials.credentialLabels(type);
    if (!credential.available) {
      return '<div class="credential-heading"><div><h2>' + labels.title + '</h2>' +
        '<p>' + labels.availableText + '</p></div><span class="credential-lock" aria-hidden="true">✓</span></div>' +
        '<div class="credential-issue-state"><p>Emissão imediata e exclusiva para seu cadastro.</p>' +
        '<button class="btn btn-blue" type="button" data-issue-credential>' + labels.issue + ' <span>→</span></button>' +
        '<p class="credential-action-message" data-credential-message role="status" aria-live="polite"></p></div>';
    }

    return '<div class="credential-heading"><div><h2>' + labels.title + '</h2>' +
      '<p>Sua credencial digital já foi emitida e está disponível.</p></div><span class="status-pill ' +
      credentialStatusClass(credential) + '">' + credentialStatusText(credential) + '</span></div>' +
      '<div class="credential-summary"><div><small>Código de verificação</small><strong>' +
      escapeHtml(credential.verificationCode || 'Não informado') + '</strong></div>' +
      '<div><small>Validade</small><strong>' + escapeHtml(credential.validityYear || 'Não informada') + '</strong></div></div>' +
      '<div class="credential-actions"><button class="btn btn-blue" type="button" data-view-credential>' +
      labels.view + '</button><button class="btn btn-secondary" type="button" data-download-credential>' +
      labels.download + '</button><a class="btn btn-secondary" href="/validar" target="_blank" rel="noopener">Verificar autenticidade</a>' +
      '<button class="btn btn-secondary" type="button" data-copy-credential>Copiar código</button></div>' +
      '<p class="credential-action-message" data-credential-message role="status" aria-live="polite"></p>';
  }

  function openCredentialViewer(credential) {
    const labels = AssofigCredentials.credentialLabels(credential.type);
    const isCard = credential.type === 'carteira';
    const tabs = isCard
      ? '<div class="credential-tabs" role="tablist" aria-label="Lados da carteira">' +
        '<button class="active" type="button" role="tab" aria-selected="true" data-credential-tab="frente">Frente</button>' +
        '<button type="button" role="tab" aria-selected="false" data-credential-tab="verso">Verso</button></div>'
      : '';
    const art = isCard
      ? '<div data-credential-face="frente">' + credentialArtHtml('frente', credential) + '</div>' +
        '<div data-credential-face="verso" hidden>' + credentialArtHtml('verso', credential) + '</div>'
      : credentialArtHtml('certificado', credential);
    const dialog = dynamicModal('<span class="eyebrow">Credencial digital</span><h2>' + labels.title + '</h2>' +
      tabs + '<div class="credential-viewer-art">' + art + '</div><div class="credential-viewer-footer"><span>Código: <strong>' +
      escapeHtml(credential.verificationCode) + '</strong></span><button class="btn btn-blue" type="button" data-viewer-download>' +
      labels.download + '</button></div><p class="credential-viewer-message" role="status" aria-live="polite"></p>', 'credential-viewer-panel');

    $$('[data-credential-tab]', dialog.modal).forEach(button => button.addEventListener('click', () => {
      $$('[data-credential-tab]', dialog.modal).forEach(tab => {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      $$('[data-credential-face]', dialog.modal).forEach(face => {
        face.hidden = face.dataset.credentialFace !== button.dataset.credentialTab;
      });
    }));

    $('[data-viewer-download]', dialog.modal)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const message = $('.credential-viewer-message', dialog.modal);
      button.disabled = true;
      button.textContent = 'Preparando PDF...';
      try {
        await AssofigCredentials.downloadCredentialPdf(credential);
        message.textContent = 'Download preparado com sucesso.';
      } catch {
        message.textContent = 'Não foi possível gerar o PDF neste momento. Tente novamente.';
      } finally {
        button.disabled = false;
        button.textContent = labels.download;
      }
    });
  }

  async function reloadCredentialSection(portal, profile) {
    const container = $('[data-credential-content]', portal);
    if (!container) return;
    container.innerHTML = loadingContent('Carregando sua credencial');
    try {
      const credential = AssofigCredentials.normalizeCredential(await AssofigAPI.getMyCredential());
      container.innerHTML = credentialPanelHtml(profile, credential, null);
      bindCredentialActions(portal, profile, credential);
    } catch (error) {
      if (error.status === 401 || error.status === 403) throw error;
      container.innerHTML = credentialPanelHtml(profile, { available: false, type: '' }, error);
      bindCredentialActions(portal, profile, { available: false, type: '' }, error);
    }
  }

  function bindCredentialActions(portal, profile, credential, loadError) {
    $('[data-retry-credential]', portal)?.addEventListener('click', () => reloadCredentialSection(portal, profile));

    $('[data-issue-credential]', portal)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (button.disabled) return;
      const message = $('[data-credential-message]', portal);
      button.disabled = true;
      button.textContent = 'Emitindo...';
      message.textContent = '';
      try {
        const issued = AssofigCredentials.normalizeCredential(await AssofigAPI.issueMyCredential());
        const container = $('[data-credential-content]', portal);
        container.innerHTML = credentialPanelHtml(profile, issued, null);
        bindCredentialActions(portal, profile, issued);
        toast('Credencial emitida com sucesso.');
      } catch {
        message.textContent = 'Não foi possível emitir sua credencial neste momento. Tente novamente.';
        button.disabled = false;
        const type = AssofigCredentials.credentialTypeFor(profile, credential);
        button.textContent = AssofigCredentials.credentialLabels(type).issue;
      }
    });

    $('[data-view-credential]', portal)?.addEventListener('click', () => openCredentialViewer(credential));
    $('[data-copy-credential]', portal)?.addEventListener('click', () => {
      copyText(credential.verificationCode, 'Código de verificação copiado');
    });
    $('[data-download-credential]', portal)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const labels = AssofigCredentials.credentialLabels(credential.type);
      const message = $('[data-credential-message]', portal);
      button.disabled = true;
      button.textContent = 'Preparando PDF...';
      message.textContent = '';
      try {
        await AssofigCredentials.downloadCredentialPdf(credential);
        message.textContent = 'Download preparado com sucesso.';
      } catch {
        message.textContent = 'Não foi possível gerar o PDF neste momento. Tente novamente.';
      } finally {
        button.disabled = false;
        button.textContent = labels.download;
      }
    });

    if (loadError) return;
  }
  async function renderMemberPortal(profile) {
    const portal = $('#member-portal');
    portal.innerHTML = portalLayout('member', profile, loadingContent('Carregando seu perfil'));
    bindPortalCommon(portal);

    const results = await Promise.allSettled([
      AssofigAPI.getMyDefaults(), AssofigAPI.getPixInfo(),
      AssofigAPI.listMemberPartners(), AssofigAPI.listUpcomingEvents(), AssofigAPI.getMyCredential()
    ]);
    const forbidden = results.find(result => result.status === 'rejected' && result.reason?.status === 403);
    if (forbidden) throw forbidden.reason;
    const defaultsLoaded = results[0].status === 'fulfilled';
    const defaultsError = defaultsLoaded ? null : results[0].reason;
    const defaults = defaultsLoaded
      ? toArray(results[0].value, ['defaults', 'inadimplencias']).map(normalizeDefault)
      : [];
    const pix = results[1].status === 'fulfilled' ? normalizePix(results[1].value) : { key: 'xxxxxxxxx', beneficiary: '' };
    const partnersLoaded = results[2].status === 'fulfilled';
    const partners = partnersLoaded
      ? toArray(results[2].value, ['partners', 'parceiros', 'items']).map(normalizePartner)
      : [];
    const eventsLoaded = results[3].status === 'fulfilled';
    const events = eventsLoaded
      ? toArray(results[3].value, ['events', 'eventos', 'items']).map(normalizeEvent)
      : [];
    const credentialLoaded = results[4].status === 'fulfilled';
    const credential = credentialLoaded
      ? AssofigCredentials.normalizeCredential(results[4].value)
      : { available: false, type: '' };
    const late = defaults.some(defaultIsOpen);

    const content = '<header class="portal-top" id="member-overview"><div><h1>Olá, ' +
      escapeHtml(firstName(profile.name)) + '</h1><p>Acompanhe seus dados, mensalidade e situação financeira.</p></div>' +
      '<span class="status-pill ' + (late ? 'late' : 'active') + '">' +
      (late ? 'Pendência financeira' : 'Sem pendências') + '</span></header>' +
      '<div class="member-private-grid"><section class="panel" id="my-data"><h2>Meus dados</h2><div class="profile-data">' +
      profileDataHtml(profile) + '</div></section><section class="panel" id="monthly-payment"><h2>Pagamento da mensalidade</h2>' +
      pixHtml(pix) + '</section></div><section class="panel" id="my-defaults"><h2>Inadimplências</h2>' +
      (defaultsLoaded ? defaultsHtml(defaults) : '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(defaultsError, 'Não foi possível carregar suas inadimplências. Tente novamente.')) + '</strong></div>') + '</section>' +
      '<section class="panel credential-section" id="my-credential"><div data-credential-content>' +
      credentialPanelHtml(profile, credential, credentialLoaded ? null : results[4].reason) + '</div></section>' +
      '<section class="panel catalog-section" id="member-partners"><div class="catalog-section-heading"><div><h2>Parceiros ou Benefícios</h2><p>Conheça os parceiros ativos disponíveis para associados.</p></div></div><div data-member-partners-content>' +
      (partnersLoaded ? memberPartnersHtml(partners) : '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(results[2].reason, 'Não foi possível carregar os parceiros ou benefícios.')) + '</strong></div>') + '</div></section>' +
      '<section class="panel catalog-section" id="member-events"><div class="catalog-section-heading"><div><h2>Próximos eventos</h2><p>Eventos atuais e futuros disponibilizados pela ASSOFIG.</p></div></div><div data-member-events-content>' +
      (eventsLoaded ? memberEventsHtml(events) : '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(results[3].reason, 'Não foi possível carregar os próximos eventos.')) + '</strong></div>') + '</div></section>' +
      '<section class="panel portal-shortcuts"><h2>Documentos e contato</h2>' +
      '<div class="history-list"><a class="history-item" href="docs/Estatuto ASSOFIG_registrado.pdf" download><span>↓</span>' +
      '<div><strong>Estatuto ASSOFIG</strong><small>Baixar PDF</small></div></a>' +
      '<a class="history-item" href="mailto:contato@assofig.com"><span>✉</span><div><strong>Falar com a associação</strong>' +
      '<small>contato@assofig.com</small></div></a></div></section>';

    $('.portal-main', portal).innerHTML = content;
    bindPortalCommon(portal);
    if (defaultsLoaded) bindMemberProofUploads(portal, defaults);
    if (partnersLoaded) bindMemberPartners(portal, partners);
    if (eventsLoaded) bindMemberEvents(portal, events);
    bindCredentialActions(portal, profile, credential, credentialLoaded ? null : results[4].reason);
    $('[data-copy-pix]', portal)?.addEventListener('click', () => copyText(pix.key, 'Chave PIX copiada'));

    if (results[0].status === 'rejected' && ![401, 403, 404].includes(results[0].reason?.status)) {
      toast('Não foi possível carregar as pendências.');
    }
  }

  function copyText(value, successMessage) {
    const fallback = () => {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    };
    const task = navigator.clipboard?.writeText ? navigator.clipboard.writeText(value) : Promise.resolve(fallback());
    Promise.resolve(task).then(() => toast(successMessage)).catch(() => {
      fallback();
      toast(successMessage);
    });
  }

  function memberRow(member) {
    return '<tr data-member-row="' + escapeHtml(member.id) + '"><td><strong>' +
      escapeHtml(member.name || 'Sem nome') + '</strong><br><small>' + escapeHtml(member.email || '-') +
      '</small></td><td>' + escapeHtml(member.profession || '-') + '</td><td>' +
      escapeHtml(member.city || '-') + '</td><td><span class="status-pill ' +
      statusClass(member.status) + '">' + escapeHtml(statusLabel(member.status)) +
      '</span></td><td><div class="table-actions"><button data-edit-member="' +
      escapeHtml(member.id) + '">Alterar dados</button><button data-defaults-member="' +
      escapeHtml(member.id) + '">Inadimplência</button><button data-delete-member="' +
      escapeHtml(member.id) + '">Excluir</button></div></td></tr>';
  }

  function adminPartnersHtml(partners) {
    if (!partners.length) return '<div class="empty-state"><strong>Nenhum parceiro ou benefício cadastrado.</strong></div>';
    return '<div class="admin-catalog-grid">' + partners.map(partner =>
      '<article class="admin-catalog-card ' + (roleValue(partner.status) === 'inactive' ? 'is-inactive' : '') + '"><header><div><h3>' +
      escapeHtml(partner.name) + '</h3><p>' + escapeHtml(partner.activity) + '</p></div><span class="status-pill ' +
      (roleValue(partner.status) === 'active' ? 'active' : 'inactive') + '">' +
      (roleValue(partner.status) === 'active' ? 'Ativo' : 'Inativo') + '</span></header><dl><div><dt>E-mail</dt><dd>' +
      escapeHtml(partner.email) + '</dd></div><div><dt>CPF ou CNPJ</dt><dd>' + escapeHtml(formatDocument(partner.document)) +
      '</dd></div><div><dt>Telefone</dt><dd>' + escapeHtml(formatPhone(partner.phone)) + '</dd></div><div><dt>Cidade</dt><dd>' +
      escapeHtml(partner.city) + '</dd></div></dl><div class="catalog-actions"><button type="button" data-edit-partner="' +
      escapeHtml(partner.id) + '">Editar</button><button type="button" data-toggle-partner="' + escapeHtml(partner.id) + '">' +
      (roleValue(partner.status) === 'active' ? 'Inativar' : 'Ativar') + '</button><button type="button" class="danger" data-delete-partner="' +
      escapeHtml(partner.id) + '">Excluir</button></div></article>'
    ).join('') + '</div>';
  }

  function adminEventsHtml(events) {
    if (!events.length) return '<div class="empty-state"><strong>Nenhum evento cadastrado.</strong></div>';
    return '<div class="admin-catalog-grid">' + events.map(item => {
      const past = eventIsPast(item);
      return '<article class="admin-catalog-card event-admin-card ' + (past ? 'is-past' : 'is-future') + '"><header><div><h3>' +
        escapeHtml(item.name) + '</h3><p>' + escapeHtml(dateBr(item.eventDate)) + '</p></div><span class="event-time-badge ' +
        (past ? 'past' : 'future') + '">' + (past ? 'Realizado' : 'Futuro') + '</span></header><p class="catalog-description">' +
        escapeHtml(item.description) + '</p><dl><div><dt>Produtor</dt><dd>' + escapeHtml(item.producer) +
        '</dd></div><div><dt>Cidade</dt><dd>' + escapeHtml(item.city) + '</dd></div><div><dt>Inscrições</dt><dd>' +
        escapeHtml(registrationStatusLabel(item.registrationStatus)) + '</dd></div></dl><div class="catalog-actions">' +
        '<button type="button" data-edit-event="' + escapeHtml(item.id) + '">Editar</button>' +
        '<button type="button" class="danger" data-delete-event="' + escapeHtml(item.id) + '">Excluir</button></div></article>';
    }).join('') + '</div>';
  }

  async function loadAdminPartners(portal) {
    const container = $('[data-admin-partners-content]', portal);
    if (!container) return;
    container.innerHTML = loadingContent('Carregando parceiros e benefícios');
    try {
      const response = await AssofigAPI.listAdminPartners();
      privateState.adminPartners = toArray(response, ['partners', 'parceiros', 'items']).map(normalizePartner);
      container.innerHTML = adminPartnersHtml(privateState.adminPartners);
      bindAdminPartnerActions(portal);
    } catch (error) {
      container.innerHTML = '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(error, 'Não foi possível carregar os parceiros ou benefícios.')) +
        '</strong><button class="btn btn-blue" type="button" data-retry-partners>Tentar novamente</button></div>';
      $('[data-retry-partners]', container)?.addEventListener('click', () => loadAdminPartners(portal));
    }
  }

  function bindAdminPartnerActions(portal) {
    $$('[data-edit-partner]', portal).forEach(button => button.addEventListener('click', () => partnerEditor(button.dataset.editPartner)));
    $$('[data-toggle-partner]', portal).forEach(button => button.addEventListener('click', async () => {
      const partner = privateState.adminPartners.find(item => String(item.id) === String(button.dataset.togglePartner));
      if (!partner || button.disabled) return;
      button.disabled = true;
      try {
        const status = roleValue(partner.status) === 'active' ? 'inactive' : 'active';
        await AssofigAPI.updatePartner(partner.id, { status });
        toast(status === 'active' ? 'Parceiro ativado com sucesso.' : 'Parceiro inativado com sucesso.');
        await loadAdminPartners(portal);
      } catch (error) {
        toast(friendlyError(error, 'Não foi possível alterar a situação do parceiro.'));
        button.disabled = false;
      }
    }));
    $$('[data-delete-partner]', portal).forEach(button => button.addEventListener('click', async () => {
      const partner = privateState.adminPartners.find(item => String(item.id) === String(button.dataset.deletePartner));
      if (!partner || !window.confirm('Confirma a exclusão de ' + partner.name + '?')) return;
      button.disabled = true;
      try {
        await AssofigAPI.deletePartner(partner.id);
        toast('Parceiro ou benefício excluído com sucesso.');
        await loadAdminPartners(portal);
      } catch (error) {
        toast(friendlyError(error, 'Não foi possível excluir o parceiro ou benefício.'));
        button.disabled = false;
      }
    }));
  }

  function partnerEditor(id) {
    const editing = id != null;
    const partner = editing
      ? privateState.adminPartners.find(item => String(item.id) === String(id))
      : { name: '', email: '', document: '', phone: '', activity: '', city: '', status: 'active' };
    if (!partner) return;
    const title = editing ? 'Editar parceiro ou benefício' : 'Incluir parceiro ou benefício';
    const dialog = dynamicModal(
      '<span class="eyebrow">Parceiros ou Benefícios</span><h2>' + title + '</h2><form class="catalog-editor-form">' +
      '<div class="member-fields"><label for="partner-name">Nome completo<input id="partner-name" name="name" required value="' + escapeHtml(partner.name) + '"></label>' +
      '<label for="partner-email">E-mail<input id="partner-email" name="email" type="email" required value="' + escapeHtml(partner.email) + '"></label>' +
      '<label for="partner-document">CPF ou CNPJ<input id="partner-document" name="document" inputmode="numeric" required value="' + escapeHtml(formatDocument(partner.document)) + '"></label>' +
      '<label for="partner-phone">Telefone<input id="partner-phone" name="phone" type="tel" required value="' + escapeHtml(formatPhone(partner.phone)) + '"></label>' +
      '<label for="partner-activity">Atividade<input id="partner-activity" name="activity" required value="' + escapeHtml(partner.activity) + '"></label>' +
      '<label for="partner-city">Cidade<input id="partner-city" name="city" required value="' + escapeHtml(partner.city) + '"></label>' +
      '<label for="partner-status">Situação<select id="partner-status" name="status" required><option value="active"' +
      (roleValue(partner.status) === 'active' ? ' selected' : '') + '>Ativo</option><option value="inactive"' +
      (roleValue(partner.status) === 'inactive' ? ' selected' : '') + '>Inativo</option></select></label></div>' +
      '<p class="catalog-form-error" role="alert" hidden></p><div class="catalog-form-actions"><button class="btn btn-secondary" type="button" data-cancel-catalog>Cancelar</button>' +
      '<button class="btn btn-blue" type="submit">' + title + '</button></div></form>',
      'catalog-editor-panel'
    );
    const form = $('.catalog-editor-form', dialog.modal);
    const documentInput = form.elements.document;
    const phoneInput = form.elements.phone;
    documentInput.addEventListener('input', () => { documentInput.value = formatDocument(documentInput.value); documentInput.setCustomValidity(''); });
    phoneInput.addEventListener('input', () => { phoneInput.value = formatPhone(phoneInput.value); });
    $('[data-cancel-catalog]', dialog.modal).addEventListener('click', dialog.close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const errorBox = $('.catalog-form-error', form);
      const button = $('button[type=submit]', form);
      if (!validDocument(documentInput.value)) {
        documentInput.setCustomValidity('Informe um CPF ou CNPJ válido.');
        documentInput.reportValidity();
        return;
      }
      if (button.disabled) return;
      const data = Object.fromEntries(new FormData(form));
      data.document = documentDigits(data.document);
      button.disabled = true;
      button.textContent = editing ? 'Salvando...' : 'Incluindo...';
      errorBox.hidden = true;
      try {
        if (editing) await AssofigAPI.updatePartner(partner.id, data);
        else await AssofigAPI.createPartner(data);
        dialog.close();
        toast(editing ? 'Parceiro ou benefício atualizado com sucesso.' : 'Parceiro ou benefício incluído com sucesso.');
        await loadAdminPartners($('#admin-portal'));
      } catch (error) {
        errorBox.textContent = friendlyError(error, 'Não foi possível salvar o parceiro ou benefício.');
        errorBox.hidden = false;
        button.disabled = false;
        button.textContent = title;
      }
    });
  }

  async function loadAdminEvents(portal) {
    const container = $('[data-admin-events-content]', portal);
    if (!container) return;
    container.innerHTML = loadingContent('Carregando eventos');
    try {
      const response = await AssofigAPI.listAdminEvents();
      privateState.adminEvents = toArray(response, ['events', 'eventos', 'items']).map(normalizeEvent);
      container.innerHTML = adminEventsHtml(privateState.adminEvents);
      bindAdminEventActions(portal);
    } catch (error) {
      container.innerHTML = '<div class="error-state compact" role="alert"><strong>' +
        escapeHtml(friendlyError(error, 'Não foi possível carregar os eventos.')) +
        '</strong><button class="btn btn-blue" type="button" data-retry-events>Tentar novamente</button></div>';
      $('[data-retry-events]', container)?.addEventListener('click', () => loadAdminEvents(portal));
    }
  }

  function bindAdminEventActions(portal) {
    $$('[data-edit-event]', portal).forEach(button => button.addEventListener('click', () => eventEditor(button.dataset.editEvent)));
    $$('[data-delete-event]', portal).forEach(button => button.addEventListener('click', async () => {
      const item = privateState.adminEvents.find(event => String(event.id) === String(button.dataset.deleteEvent));
      if (!item || !window.confirm('Confirma a exclusão do evento ' + item.name + '?')) return;
      button.disabled = true;
      try {
        await AssofigAPI.deleteEvent(item.id);
        toast('Evento excluído com sucesso.');
        await loadAdminEvents(portal);
      } catch (error) {
        toast(friendlyError(error, 'Não foi possível excluir o evento.'));
        button.disabled = false;
      }
    }));
  }

  function eventEditor(id) {
    const editing = id != null;
    const item = editing
      ? privateState.adminEvents.find(event => String(event.id) === String(id))
      : { name: '', eventDate: '', description: '', producer: '', city: '', registrationStatus: 'registration_waiting' };
    if (!item) return;
    const title = editing ? 'Editar evento' : 'Incluir evento';
    const dialog = dynamicModal(
      '<span class="eyebrow">Eventos</span><h2>' + title + '</h2><form class="catalog-editor-form">' +
      '<div class="member-fields"><label for="event-name">Nome do evento<input id="event-name" name="name" required value="' + escapeHtml(item.name) + '"></label>' +
      '<label for="event-date">Data<input id="event-date" name="eventDate" type="date" required value="' + escapeHtml(String(item.eventDate || '').slice(0, 10)) + '"></label>' +
      '<label for="event-producer">Produtor<input id="event-producer" name="producer" required value="' + escapeHtml(item.producer) + '"></label>' +
      '<label for="event-city">Cidade<input id="event-city" name="city" required value="' + escapeHtml(item.city) + '"></label>' +
      '<label for="event-status">Situação<select id="event-status" name="registrationStatus" required><option value="registration_open"' +
      (roleValue(item.registrationStatus) === 'registration_open' ? ' selected' : '') + '>Permitir inscrição</option><option value="registration_waiting"' +
      (roleValue(item.registrationStatus) === 'registration_waiting' ? ' selected' : '') + '>Aguardar inscrição</option></select></label></div>' +
      '<label for="event-description">Descrição do evento<textarea id="event-description" name="description" rows="5" required>' +
      escapeHtml(item.description) + '</textarea></label><p class="catalog-form-error" role="alert" hidden></p>' +
      '<div class="catalog-form-actions"><button class="btn btn-secondary" type="button" data-cancel-catalog>Cancelar</button>' +
      '<button class="btn btn-blue" type="submit">' + title + '</button></div></form>',
      'catalog-editor-panel'
    );
    const form = $('.catalog-editor-form', dialog.modal);
    $('[data-cancel-catalog]', dialog.modal).addEventListener('click', dialog.close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const button = $('button[type=submit]', form);
      const errorBox = $('.catalog-form-error', form);
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = editing ? 'Salvando...' : 'Incluindo...';
      errorBox.hidden = true;
      try {
        if (editing) await AssofigAPI.updateEvent(item.id, data);
        else await AssofigAPI.createEvent(data);
        dialog.close();
        toast(editing ? 'Evento atualizado com sucesso.' : 'Evento incluído com sucesso.');
        await loadAdminEvents($('#admin-portal'));
      } catch (error) {
        errorBox.textContent = friendlyError(error, 'Não foi possível salvar o evento.');
        errorBox.hidden = false;
        button.disabled = false;
        button.textContent = title;
      }
    });
  }
  function adminContent(members) {
    const active = members.filter(member => ['active', 'ativo', 'regular'].includes(roleValue(member.status))).length;
    const late = members.filter(member => statusClass(member.status) === 'late').length;
    const pending = members.filter(member => ['pending', 'pendente'].includes(roleValue(member.status))).length;

    return '<header class="portal-top" id="admin-overview"><div><h1>Painel administrativo</h1><p>Gestão de associados e situação financeira.</p></div></header>' +
      '<div class="metric-grid"><div class="metric"><small>Total de cadastros</small><strong class="blue">' +
      members.length + '</strong></div><div class="metric"><small>Sócios ativos</small><strong class="green">' +
      active + '</strong></div><div class="metric"><small>Inadimplentes</small><strong class="red">' +
      late + '</strong></div><div class="metric"><small>Pendentes</small><strong>' + pending +
      '</strong></div></div><section class="panel" id="member-management" style="margin-top:18px">' +
      '<div class="admin-tools"><input id="member-search" aria-label="Buscar associados" placeholder="Buscar por nome, profissão ou cidade">' +
      '<button class="btn btn-blue" type="button" data-add-member>+ Incluir associado</button></div>' +
      '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Associado</th><th>Profissão</th>' +
      '<th>Cidade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' +
      (members.length ? members.map(memberRow).join('') :
        '<tr><td colspan="5"><div class="empty-state"><strong>Nenhum associado cadastrado.</strong></div></td></tr>') +
      '</tbody></table></div></section>' +
      '<section class="panel catalog-section" id="partner-management"><div class="catalog-section-heading"><div><h2>Parceiros ou Benefícios</h2><p>Cadastro e histórico de parceiros oferecidos aos associados.</p></div>' +
      '<button class="btn btn-blue" type="button" data-add-partner>+ Incluir parceiro ou benefício</button></div><div data-admin-partners-content>' +
      loadingContent('Carregando parceiros e benefícios') + '</div></section>' +
      '<section class="panel catalog-section" id="event-management"><div class="catalog-section-heading"><div><h2>Eventos</h2><p>Cadastro e histórico completo de eventos.</p></div>' +
      '<button class="btn btn-blue" type="button" data-add-event>+ Incluir evento</button></div><div data-admin-events-content>' +
      loadingContent('Carregando eventos') + '</div></section>';
  }

  async function fetchMembers() {
    const response = await AssofigAPI.listMembers();
    return toArray(response, ['members', 'associados', 'items']).map(normalizeMember);
  }

  async function renderAdminPortal(profile) {
    const portal = $('#admin-portal');
    portal.innerHTML = portalLayout('admin', profile, loadingContent('Carregando associados'));
    bindPortalCommon(portal);
    try {
      privateState.members = await fetchMembers();
      $('.portal-main', portal).innerHTML = adminContent(privateState.members);
      bindPortalCommon(portal);
      bindAdmin(portal);
      await Promise.allSettled([loadAdminPartners(portal), loadAdminEvents(portal)]);
    } catch (error) {
      if (error.status === 403) {
        $('.portal-main', portal).innerHTML = '<div class="error-state"><h2>Acesso não autorizado.</h2><p>Seu usuário não possui permissão para consultar os associados.</p></div>';
        return;
      }
      if (error.status === 401) return;
      $('.portal-main', portal).innerHTML = '<div class="error-state"><h2>Não foi possível carregar os associados.</h2><p>' +
        escapeHtml(error.message) + '</p><button class="btn btn-blue" data-retry-members>Tentar novamente</button></div>';
      $('[data-retry-members]', portal)?.addEventListener('click', () => renderAdminPortal(profile));
    }
  }

  async function refreshAdmin() {
    await renderAdminPortal(privateState.profile);
  }
  function bindAdmin(portal) {
    $('#member-search', portal)?.addEventListener('input', event => {
      const term = event.target.value.toLowerCase();
      $$('tbody tr[data-member-row]', portal).forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(term);
      });
    });

    $('[data-add-member]', portal)?.addEventListener('click', () => memberEditor());
    $('[data-add-partner]', portal)?.addEventListener('click', () => partnerEditor());
    $('[data-add-event]', portal)?.addEventListener('click', () => eventEditor());
    $$('[data-edit-member]', portal).forEach(button => button.addEventListener('click', () => memberEditor(button.dataset.editMember)));
    $$('[data-defaults-member]', portal).forEach(button => button.addEventListener('click', () => manageDefaults(button.dataset.defaultsMember)));
    $$('[data-delete-member]', portal).forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.deleteMember;
        const member = privateState.members.find(item => String(item.id) === String(id));
        if (!window.confirm('Confirma a exclusão de ' + (member?.name || 'este associado') + '?')) return;
        button.disabled = true;
        try {
          await AssofigAPI.deleteMember(id);
          toast('Associado excluído com sucesso.');
          await refreshAdmin();
        } catch (error) {
          toast(error.message);
          button.disabled = false;
        }
      });
    });
  }

  function fieldHtml(field, value) {
    const safeValue = escapeHtml(value || '');
    if (field.type === 'profession') {
      const options = ['Fisioterapeuta', 'Terapeuta Ocupacional', 'Estudante'];
      return '<label>' + field.label + '<select name="' + field.name + '" ' +
        (field.required ? 'required' : '') + '><option value="">Selecione</option>' +
        options.map(option => '<option ' + (option === value ? 'selected' : '') + '>' +
          option + '</option>').join('') + '</select></label>';
    }
    if (field.type === 'status') {
      const rawStatus = roleValue(value);
      const selectedStatus = ['late', 'inadimplente', 'overdue'].includes(rawStatus)
        ? 'late'
        : ['pending', 'pendente'].includes(rawStatus) ? 'pending' : 'active';
      const options = [
        { value: 'active', label: 'Em dia' },
        { value: 'late', label: 'Inadimplente' },
        { value: 'pending', label: 'Pendente' }
      ];
      return '<label>' + field.label + '<select name="' + field.name + '" required>' +
        options.map(option => '<option value="' + option.value + '" ' +
          (selectedStatus === option.value ? 'selected' : '') + '>' + option.label + '</option>').join('') +
        '</select></label>';
    }
    return '<label>' + field.label + '<input name="' + field.name + '" type="' +
      (field.type || 'text') + '" value="' + safeValue + '" ' +
      (field.name === 'document' ? 'inputmode="numeric" maxlength="18" ' : '') +
      (field.required ? 'required' : '') + '></label>';
  }

  async function memberEditor(id) {
    const editing = id != null;
    const dialog = dynamicModal(
      '<span class="eyebrow">Associados</span><h2>' + (editing ? 'Alterar dados' : 'Incluir associado') +
      '</h2><div class="modal-loading">' + loadingContent('Carregando formulário') + '</div>',
      'member-editor-panel'
    );

    try {
      const member = editing ? normalizeMember(await AssofigAPI.getMember(id)) :
        { name: '', email: '', document: '', phone: '', profession: '', registry: '', city: '', status: 'active' };

      $('.modal-panel', dialog.modal).innerHTML =
        '<button class="modal-close" type="button" aria-label="Fechar">×</button><span class="eyebrow">Associados</span><h2>' +
        (editing ? 'Alterar dados' : 'Incluir associado') +
        '</h2><p>Os mesmos dados serão apresentados ao associado em “Meus dados”.</p>' +
        '<form id="member-editor" class="member-editor-form"><div class="member-fields">' +
        memberFields.map(field => fieldHtml(field, field.name === 'document' ? formatDocument(member[field.name]) : member[field.name])).join('') +
        '</div><button class="btn btn-blue" type="submit">' +
        (editing ? 'Salvar alterações' : 'Incluir associado') + '</button></form>';

      $('.modal-close', dialog.modal).addEventListener('click', dialog.close);
      const form = $('#member-editor', dialog.modal);
      const documentInput = form.elements.document;
      documentInput.addEventListener('input', event => {
        event.target.value = formatDocument(event.target.value);
        event.target.setCustomValidity('');
      });

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        if (!validDocument(data.document)) {
          documentInput.setCustomValidity('Informe um CPF ou CNPJ válido.');
          documentInput.reportValidity();
          return;
        }
        data.document = documentDigits(data.document);
        const button = $('button[type=submit]', form);
        button.disabled = true;
        try {
          if (editing) await AssofigAPI.updateMember(id, data);
          else await AssofigAPI.createMember(data);
          dialog.close();
          toast(editing ? 'Dados atualizados com sucesso.' : 'Associado incluído com sucesso.');
          await refreshAdmin();
        } catch (error) {
          toast(error.message);
          button.disabled = false;
        }
      });
    } catch (error) {
      dialog.close();
      toast(error.message);
    }
  }

  function directorDefaultsHtml(defaults, memberId) {
    if (!defaults.length) return '<div class="empty-state"><strong>Nenhuma pendência cadastrada.</strong></div>';
    return '<div class="defaults-list">' + defaults.map(item =>
      '<article class="default-item"><div><small>Referência</small><strong>' + escapeHtml(item.reference) +
      '</strong></div><div><small>Valor</small><strong>' + escapeHtml(money(item.amount)) +
      '</strong></div><div><small>Vencimento</small><strong>' + escapeHtml(dateBr(item.dueDate)) +
      '</strong></div><span class="status-pill ' + defaultClass(item) + '">' +
      escapeHtml(statusLabel(item.status)) + '</span>' +
      (defaultIsOpen(item) && item.id != null ?
        '<button class="btn-small" data-regularize="' + escapeHtml(item.id) +
        '" data-member="' + escapeHtml(memberId) + '">Regularizar</button>' : '') +
      '</article>'
    ).join('') + '</div>';
  }

  async function manageDefaults(memberId) {
    const member = privateState.members.find(item => String(item.id) === String(memberId));
    const dialog = dynamicModal(
      '<span class="eyebrow">Financeiro</span><h2>Inadimplência</h2><p>' +
      escapeHtml(member?.name || 'Associado') + '</p><div data-defaults-content>' +
      loadingContent('Carregando pendências') + '</div>',
      'defaults-panel'
    );

    async function load() {
      try {
        const response = await AssofigAPI.listMemberDefaults(memberId);
        const defaults = toArray(response, ['defaults', 'inadimplencias', 'items']).map(normalizeDefault);
        $('[data-defaults-content]', dialog.modal).innerHTML =
          directorDefaultsHtml(defaults, memberId) +
          '<form id="default-form" class="default-form"><h3>Registrar pendência</h3>' +
          '<div class="form-row"><label>Valor da inadimplência<input name="amount" type="number" min="0.01" step="0.01" required></label>' +
          '<label>Data de vencimento<input name="dueDate" type="date" required></label></div>' +
          '<button class="btn btn-blue" type="submit">Registrar inadimplência</button></form>';

        $('#default-form', dialog.modal).addEventListener('submit', async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = {
            amount: Number(form.elements.amount.value),
            dueDate: form.elements.dueDate.value
          };
          const button = $('button[type=submit]', form);
          button.disabled = true;
          try {
            await AssofigAPI.createMemberDefault(memberId, data);
            toast('Inadimplência registrada com sucesso.');
            await load();
            await refreshAdmin();
          } catch (error) {
            const message = error.status === 400
              ? error.message
              : error.message || 'Não foi possível registrar a inadimplência.';
            toast(message);
            button.disabled = false;
          }
        });

        $$('[data-regularize]', dialog.modal).forEach(button => {
          button.addEventListener('click', async () => {
            if (!window.confirm('Confirmar a regularização desta pendência?')) return;
            button.disabled = true;
            try {
              await AssofigAPI.regularizeMemberDefault(button.dataset.member, button.dataset.regularize);
              toast('Pendência regularizada.');
              await load();
              await refreshAdmin();
            } catch (error) {
              toast(error.message);
              button.disabled = false;
            }
          });
        });
      } catch (error) {
        $('[data-defaults-content]', dialog.modal).innerHTML =
          '<div class="error-state"><strong>Não foi possível carregar as pendências.</strong><p>' +
          escapeHtml(error.message) + '</p></div>';
      }
    }

    await load();
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const button = $('button[type=submit]', form);
    localStorage.removeItem('assofig_token');
    button.disabled = true;
    button.textContent = 'Entrando...';

    try {
      const result = await AssofigAPI.login(data);
      const token = result?.token || result?.accessToken || result?.data?.token || result?.data?.accessToken;
      if (!token) throw new Error('A API não retornou um token de autenticação.');
      localStorage.setItem('assofig_token', token);
      privateState.loginResponse = result;
      closeModals();
      if (requiresPasswordChange(result)) openModal('mandatory-password-modal');
      else await initializeRestrictedArea(result);
    } catch (error) {
      localStorage.removeItem('assofig_token');
      toast(error.message || 'Não foi possível entrar.');
    } finally {
      button.disabled = false;
      button.innerHTML = 'Entrar na área privativa <span>→</span>';
    }
  }
  $$('[data-open]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.open)));
  $$('[data-close]').forEach(button => button.addEventListener('click', closeModals));
  $$('[data-associate]').forEach(link => link.addEventListener('click', () => setAssociationMode(true, true)));

  $('#contact-form [name=subject]').addEventListener('change', event => {
    setAssociationMode(['Quero me associar', 'Parcerias'].includes(event.target.value), false);
    setContactFieldError($('#contact-form'), 'subject', '');
  });
  $('#contact-form [name=profession]').addEventListener('change', event => {
    setProfessionOtherMode(event.target.value);
    setContactFieldError($('#contact-form'), 'profession', '');
  });
  $('#contact-form [name=phone]').addEventListener('input', event => {
    event.target.value = formatPhone(event.target.value);
    setContactFieldError($('#contact-form'), 'phone', '');
  });
  ['name', 'email', 'city', 'message', 'professionOther'].forEach(name => {
    $('#contact-form [name=' + name + ']').addEventListener('input', () =>
      setContactFieldError($('#contact-form'), name, '')
    );
  });
  $('#contact-form [name=document]').addEventListener('input', event => {
    event.target.value = formatDocument(event.target.value);
    event.target.setCustomValidity('');
    event.target.removeAttribute('aria-invalid');
  });
  $('#contact-form [name=document]').addEventListener('blur', event => {
    if (event.target.value && !validDocument(event.target.value)) {
      event.target.setCustomValidity('Informe um CPF ou CNPJ válido.');
      event.target.setAttribute('aria-invalid', 'true');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#mandatory-password-modal').hidden) closeModals();
  });
  $('.menu-toggle').addEventListener('click', event => {
    const nav = $('.main-nav');
    nav.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open'));
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => {
    $('.main-nav').classList.remove('open');
    $('.menu-toggle').setAttribute('aria-expanded', 'false');
  }));
  $('.private-link').addEventListener('click', () => {
    $('.main-nav').classList.remove('open');
    $('.menu-toggle').setAttribute('aria-expanded', 'false');
  });

  const backToTop = $('.back-to-top');
  const scrollPortals = [$('#access-portal'), $('#member-portal'), $('#admin-portal')];
  const activeScrollContainer = () => scrollPortals.find(portal => !portal.hidden) || null;
  const currentScrollTop = () => activeScrollContainer()?.scrollTop || window.scrollY || document.documentElement.scrollTop;
  const updateBackToTop = () => {
    const top = currentScrollTop();
    $('.site-header').classList.toggle('scrolled', top > 10);
    backToTop.classList.toggle('visible', top > 350);
  };
  addEventListener('scroll', updateBackToTop, { passive: true });
  scrollPortals.forEach(portal => portal.addEventListener('scroll', updateBackToTop, { passive: true }));
  backToTop.addEventListener('click', event => {
    event.preventDefault();
    const portal = activeScrollContainer();
    if (portal) portal.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  updateBackToTop();

  loadPublicEvents();

  $('#year').textContent = new Date().getFullYear();
  const observer = new IntersectionObserver(entries =>
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }),
    { threshold: 0.12 }
  );
  $$('.reveal').forEach(element => observer.observe(element));

  $$('[data-login-tab]').forEach(tab => tab.addEventListener('click', () => {
    $$('[data-login-tab]').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    $('#login-form [name=role]').value = tab.dataset.loginTab;
    $('#login-title').textContent = tab.dataset.loginTab === 'admin' ? 'Acesso da Diretoria' : 'Boas-vindas de volta';
  }));
  $('.toggle-password').addEventListener('click', () => {
    const input = $('.password-field input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('[data-open="forgot-password-modal"]').addEventListener('click', () => {
    $('#forgot-password-form [name=email]').value = $('#login-form [name=email]').value.trim();
  });

  $('#forgot-password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type=submit]', form);
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      await AssofigAPI.forgotPassword(Object.fromEntries(new FormData(form)));
      form.reset();
      closeModals();
      toast('Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Enviar instruções <span>→</span>';
    }
  });

  $$('#mandatory-password-form input').forEach(input => input.addEventListener('input', () => {
    input.setCustomValidity('');
  }));
  $('#mandatory-password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.elements.currentPassword;
    const newPassword = form.elements.newPassword;
    const confirmPassword = form.elements.confirmPassword;
    const button = $('button[type=submit]', form);
    newPassword.setCustomValidity('');
    confirmPassword.setCustomValidity('');
    if (currentPassword.value === newPassword.value) {
      newPassword.setCustomValidity('A nova senha deve ser diferente da senha atual ou inicial.');
      newPassword.reportValidity();
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity('A confirmação deve ser igual à nova senha.');
      confirmPassword.reportValidity();
      return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const result = await AssofigAPI.changePassword({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value
      });
      const renewedToken = result?.token || result?.accessToken || result?.data?.token || result?.data?.accessToken;
      if (renewedToken) localStorage.setItem('assofig_token', renewedToken);
      privateState.loginResponse = null;
      form.reset();
      closeModals();
      toast('Senha alterada com sucesso.');
      await initializeRestrictedArea();
    } catch (error) {
      if (error.status !== 401) toast(error.message || 'Não foi possível alterar a senha.');
    } finally {
      button.disabled = false;
      button.innerHTML = 'Salvar nova senha <span>→</span>';
    }
  });
  $('#login-form').addEventListener('submit', handleLogin);

  $('#signup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await AssofigAPI.submitApplication(Object.fromEntries(new FormData(form)));
      form.reset();
      closeModals();
      toast('Solicitação enviada com sucesso. A diretoria da ASSOFIG analisará seus dados e entrará em contato.');
    } catch (error) {
      toast(error.message);
    }
  });

  $('#contact-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = contactPayload(form);
    if (!payload) return;

    const subject = payload.subject;
    const association = subject === 'Quero me associar';
    const needsDocument = association || subject === 'Parcerias';
    const documentInput = form.elements.document;
    if (needsDocument) {
      if (!validDocument(documentInput.value)) {
        documentInput.setCustomValidity('Informe um CPF ou CNPJ válido.');
        documentInput.setAttribute('aria-invalid', 'true');
        documentInput.reportValidity();
        return;
      }
      payload.document = documentDigits(documentInput.value);
    }

    const button = $('button[type=submit]', form);
    const originalButton = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      if (association) await AssofigAPI.submitApplication(payload);
      else await AssofigAPI.sendContact(payload);
      form.reset();
      clearContactErrors(form);
      setProfessionOtherMode('');
      setAssociationMode(false, false);
      toast('Mensagem enviada com sucesso. Em breve entraremos em contato.');
    } catch (error) {
      toast(friendlyError(error, 'Não foi possível enviar sua mensagem. Tente novamente.'));
    } finally {
      button.disabled = false;
      button.innerHTML = originalButton;
    }
  });

  $$('.news-card').forEach(card => card.addEventListener('click', event => {
    if (!event.target.closest('button') && event.currentTarget !== event.target) return;
    const item = news[card.dataset.news];
    $('#news-modal-category').textContent = item.category;
    $('#news-modal-title').textContent = item.title;
    $('#news-modal-body').innerHTML = item.body;
    openModal('news-modal');
  }));

  window.addEventListener('assofig:session-expired', showSessionExpired);

  if (localStorage.getItem('assofig_token')) {
    initializeRestrictedArea();
  }
})();