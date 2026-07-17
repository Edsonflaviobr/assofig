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

  let privateState = { profile: null, access: null, members: [], loginResponse: null };

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

  function normalizeDefault(raw) {
    return {
      id: raw.id ?? raw.inadimplenciaId,
      status: raw.status ?? raw.situacao ?? 'pending',
      reference: raw.reference ?? raw.referencia ?? '-',
      amount: Number(raw.amount ?? raw.valor ?? 0),
      dueDate: raw.dueDate ?? raw.vencimento ?? raw.due_date ?? ''
    };
  }

  function normalizePix(response) {
    const data = unwrap(response) || {};
    return {
      key: data.key ?? data.pixKey ?? data.chave ?? data.chavePix ?? '',
      beneficiary: data.beneficiary ?? data.favoredName ?? data.favorecido ?? data.nomeFavorecido ?? ''
    };
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
    const raw = unwrap(response) || {};
    return Boolean(
      response?.mustChangePassword ?? response?.must_change_password ??
      response?.data?.mustChangePassword ?? response?.data?.must_change_password ??
      response?.user?.mustChangePassword ?? response?.user?.must_change_password ??
      response?.data?.user?.mustChangePassword ?? response?.data?.user?.must_change_password ??
      raw.mustChangePassword ?? raw.must_change_password
    );
  }

  function buildAccessContext(profileResponse, loginResponse) {
    const profileRaw = unwrap(profileResponse) || {};
    const loginRaw = unwrap(loginResponse) || {};
    const profile = normalizeMember(profileResponse);
    const permissionSources = [
      profileResponse?.permissions,
      profileResponse?.data?.permissions,
      profileRaw.permissions,
      loginResponse?.permissions,
      loginResponse?.data?.permissions,
      loginRaw.permissions
    ];
    const memberPermission = permissionValue(permissionSources, 'canAccessMemberArea');
    const adminPermission = permissionValue(permissionSources, 'canAccessAdminArea');
    const associadoId = profileRaw.associadoId ?? profileRaw.associationId ?? profileRaw.memberId ??
      profileRaw.associado?.id ?? profileResponse?.associadoId ?? profileResponse?.data?.associadoId ??
      loginRaw.associadoId ?? loginRaw.associationId ?? loginRaw.memberId ?? loginRaw.associado?.id ?? null;
    const role = profile.role || profileRaw.role || profileRaw.tipo || loginRaw.role || loginRaw.tipo ||
      loginResponse?.role || loginResponse?.data?.role;

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
    modal.innerHTML = '<div class="modal-backdrop"></div><div class="modal-panel ' + escapeHtml(className || '') + '"><button class="modal-close" type="button" aria-label="Fechar">×</button>' + content + '</div>';
    document.body.appendChild(modal);
    const close = () => modal.remove();
    $('.modal-close', modal).addEventListener('click', close);
    $('.modal-backdrop', modal).addEventListener('click', close);
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

  function loadingContent(title) {
    return '<div class="portal-loading"><span class="loading-spinner" aria-hidden="true"></span><h2>' + escapeHtml(title || 'Carregando dados') + '</h2><p>Aguarde um instante.</p></div>';
  }

  function portalLayout(role, profile, content) {
    const director = role === 'admin';
    const name = profile?.name || (director ? 'Diretoria' : 'Associado');
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
    const nav = director
      ? '<button class="active" data-portal-target="admin-overview">▦ Visão geral</button><button data-portal-target="member-management">♙ Associados</button>'
      : '<button class="active" data-portal-target="member-overview">▦ Visão geral</button><button data-portal-target="my-data">♙ Meus dados</button><button data-portal-target="monthly-payment">$ Mensalidade</button><button data-portal-target="my-defaults">! Pendências</button>';
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
    $$('[data-portal-target]', portal).forEach(button => button.addEventListener('click', () => {
      $('#' + button.dataset.portalTarget, portal)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  function hidePrivateAreas() {
    ['access-portal', 'member-portal', 'admin-portal'].forEach(id => { $('#' + id).hidden = true; });
  }

  function logout() {
    localStorage.removeItem('assofig_token');
    privateState = { profile: null, access: null, members: [], loginResponse: null };
    hidePrivateAreas();
    document.body.classList.remove('modal-open');
    toast('Sessão encerrada.');
  }

  function showSessionExpired() {
    privateState = { profile: null, access: null, members: [], loginResponse: null };
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
    $('[data-access-area]', portal).forEach(button => button.addEventListener('click', () => {
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
      await renderMemberPortal(privateState.profile);
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
      if (field.name === 'status') value = statusLabel(value);
      return '<div><small>' + escapeHtml(field.label) + '</small><strong>' + escapeHtml(value || 'Não informado') + '</strong></div>';
    }).join('');
  }

  function defaultsHtml(defaults) {
    if (!defaults.length) {
      return '<div class="empty-state"><span>✓</span><strong>Você não possui pendências financeiras.</strong></div>';
    }
    return '<div class="defaults-list">' + defaults.map(item =>
      '<article class="default-item"><div><small>Referência</small><strong>' + escapeHtml(item.reference) +
      '</strong></div><div><small>Valor</small><strong>' + escapeHtml(money(item.amount)) +
      '</strong></div><div><small>Vencimento</small><strong>' + escapeHtml(dateBr(item.dueDate)) +
      '</strong></div><span class="status-pill ' + defaultClass(item) + '">' +
      escapeHtml(statusLabel(item.status)) + '</span></article>'
    ).join('') + '</div>';
  }

  function pixHtml(pix) {
    if (!pix.key) {
      return '<div class="empty-state"><strong>Informações de pagamento indisponíveis.</strong><span>Entre em contato com a tesouraria.</span></div>';
    }
    return '<div class="pix-payment"><p>Realize o pagamento utilizando a chave PIX abaixo.</p><div class="pix-box"><small>Chave PIX</small><strong class="pix-key">' +
      escapeHtml(pix.key) + '</strong><small>Favorecido</small><strong>' +
      escapeHtml(pix.beneficiary || 'Não informado') +
      '</strong></div><button class="btn btn-blue" type="button" data-copy-pix>Copiar chave PIX</button></div>';
  }

  async function renderMemberPortal(profile) {
    const portal = $('#member-portal');
    portal.innerHTML = portalLayout('member', profile, loadingContent('Carregando seu perfil'));
    bindPortalCommon(portal);

    const results = await Promise.allSettled([AssofigAPI.getMyDefaults(), AssofigAPI.getPixInfo()]);
    const forbidden = results.find(result => result.status === 'rejected' && result.reason?.status === 403);
    if (forbidden) throw forbidden.reason;
    const defaultsLoaded = results[0].status === 'fulfilled';
    const defaults = defaultsLoaded
      ? toArray(results[0].value, ['defaults', 'inadimplencias']).map(normalizeDefault)
      : [];
    const pix = results[1].status === 'fulfilled' ? normalizePix(results[1].value) : { key: '', beneficiary: '' };
    const late = defaults.some(defaultIsOpen);

    const content = '<header class="portal-top" id="member-overview"><div><h1>Olá, ' +
      escapeHtml(firstName(profile.name)) + '</h1><p>Acompanhe seus dados, mensalidade e situação financeira.</p></div>' +
      '<span class="status-pill ' + (late ? 'late' : 'active') + '">' +
      (late ? 'Pendência financeira' : 'Sem pendências') + '</span></header>' +
      '<div class="member-private-grid"><section class="panel" id="my-data"><h2>Meus dados</h2><div class="profile-data">' +
      profileDataHtml(profile) + '</div></section><section class="panel" id="monthly-payment"><h2>Pagamento da mensalidade</h2>' +
      pixHtml(pix) + '</section></div><section class="panel" id="my-defaults"><h2>Inadimplência</h2>' +
      (defaultsLoaded ? defaultsHtml(defaults) : '<div class="error-state compact"><strong>Não foi possível carregar suas pendências.</strong></div>') + '</section><section class="panel portal-shortcuts"><h2>Documentos e contato</h2>' +
      '<div class="history-list"><a class="history-item" href="docs/Estatuto ASSOFIG_registrado.pdf" download><span>↓</span>' +
      '<div><strong>Estatuto ASSOFIG</strong><small>Baixar PDF</small></div></a>' +
      '<a class="history-item" href="mailto:contato@assofig.com"><span>✉</span><div><strong>Falar com a associação</strong>' +
      '<small>contato@assofig.com</small></div></a></div></section>';

    $('.portal-main', portal).innerHTML = content;
    bindPortalCommon(portal);
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
      '</tbody></table></div></section>';
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
          '<div class="form-row"><label>Referência<input name="reference" required placeholder="Ex.: Mensalidade 07/2026"></label>' +
          '<label>Valor<input name="amount" type="number" min="0.01" step="0.01" required></label></div>' +
          '<label>Vencimento<input name="dueDate" type="date" required></label>' +
          '<button class="btn btn-blue" type="submit">Registrar inadimplência</button></form>';

        $('#default-form', dialog.modal).addEventListener('submit', async event => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(event.currentTarget));
          data.amount = Number(data.amount);
          const button = $('button[type=submit]', event.currentTarget);
          button.disabled = true;
          try {
            await AssofigAPI.createMemberDefault(memberId, data);
            toast('Inadimplência registrada.');
            await load();
            await refreshAdmin();
          } catch (error) {
            toast(error.message);
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

  $('#contact-form [name=subject]').addEventListener('change', event =>
    setAssociationMode(['Quero me associar', 'Parcerias'].includes(event.target.value), false)
  );
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

  $('#mandatory-password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password;
    const confirmation = form.elements.passwordConfirmation;
    const button = $('button[type=submit]', form);
    confirmation.setCustomValidity('');
    if (password.value !== confirmation.value) {
      confirmation.setCustomValidity('As senhas precisam ser iguais.');
      confirmation.reportValidity();
      return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const result = await AssofigAPI.changePassword({
        password: password.value,
        passwordConfirmation: confirmation.value
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
    const data = Object.fromEntries(new FormData(form));
    const association = data.subject === 'Quero me associar';
    const needsDocument = association || data.subject === 'Parcerias';
    const documentInput = form.elements.document;

    if (needsDocument) {
      if (!validDocument(data.document)) {
        documentInput.setCustomValidity('Informe um CPF ou CNPJ válido.');
        documentInput.setAttribute('aria-invalid', 'true');
        documentInput.reportValidity();
        return;
      }
      data.document = documentDigits(data.document);
    } else {
      delete data.document;
    }

    try {
      if (association) await AssofigAPI.submitApplication(data);
      else await AssofigAPI.sendContact(data);
      form.reset();
      setAssociationMode(false, false);
      toast('Solicitação enviada com sucesso. A diretoria da ASSOFIG analisará seus dados e entrará em contato.');
    } catch (error) {
      toast(error.message);
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