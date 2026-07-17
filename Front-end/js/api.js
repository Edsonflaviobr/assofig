(function () {
  const API_BASE_URL =
    window.ASSOFIG_API_URL ||
    'https://assofig-api.vercel.app/api';

  const USE_MOCKS = window.ASSOFIG_USE_MOCKS === true;

  const routes = {
    login: '/auth/login',
    forgotPassword: '/auth/forgot-password',
    profile: '/associados/me',
    members: '/diretoria/associados',
    payments: '/pagamentos',
    benefits: '/beneficios/historico',
    applications: '/inscricoes',
    contact: '/contato',
    news: '/noticias',
    events: '/eventos'
  };

  async function request(path, options = {}) {
    const token = localStorage.getItem('assofig_token');

    let response;

    try {
      response = await fetch(API_BASE_URL + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error('Não foi possível conectar à API.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        errorData.message ||
          'Não foi possível concluir a solicitação.'
      );
    }

    return response.status === 204 ? null : response.json();
  }

  async function withMock(remoteCall, mockCall) {
    if (USE_MOCKS) {
      return Promise.resolve().then(mockCall);
    }

    return remoteCall();
  }

  window.AssofigAPI = {
    config: {
      baseUrl: API_BASE_URL,
      useMocks: USE_MOCKS,
      routes
    },

    login: credentials =>
      withMock(
        () =>
          request(routes.login, {
            method: 'POST',
            body: JSON.stringify(credentials)
          }),
        () => ({
          token: 'token-demonstracao',
          role: credentials.role,
          user: {
            name:
              credentials.role === 'admin'
                ? 'Diretoria ASSOFIG'
                : 'Mariana Costa'
          }
        })
      ),

    forgotPassword: data =>
      withMock(
        () =>
          request(routes.forgotPassword, {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        () => ({
          sent: true
        })
      ),
    getProfile: () =>
      withMock(
        () => request(routes.profile),
        () => null
      ),

    submitApplication: data =>
      withMock(
        () =>
          request(routes.applications, {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        () => ({
          id: Date.now(),
          status: 'recebida'
        })
      ),

    sendContact: data =>
      withMock(
        () =>
          request(routes.contact, {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        () => ({
          sent: true
        })
      ),

    listNews: () =>
      withMock(
        () => request(routes.news),
        () => []
      ),

    listEvents: () =>
      withMock(
        () => request(routes.events),
        () => []
      ),

    listMembers: () =>
      withMock(
        () => request(routes.members),
        () =>
          JSON.parse(
            localStorage.getItem('assofig_members') || '[]'
          )
      ),

    createMember: data =>
      withMock(
        () =>
          request(routes.members, {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        () => data
      ),

    updateMember: (id, data) =>
      withMock(
        () =>
          request(`${routes.members}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          }),
        () => data
      ),

    deleteMember: id =>
      withMock(
        () =>
          request(`${routes.members}/${id}`, {
            method: 'DELETE'
          }),
        () => ({
          id
        })
      ),

    listPayments: associadoId => {
      const query = associadoId
        ? `?associadoId=${encodeURIComponent(associadoId)}`
        : '';

      return withMock(
        () => request(`${routes.payments}${query}`),
        () => []
      );
    },

    createPayment: data =>
      withMock(
        () =>
          request(routes.payments, {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        () => ({
          id: Date.now(),
          status: 'pendente',
          ...data
        })
      ),

    listBenefits: () =>
      withMock(
        () => request(routes.benefits),
        () => []
      ),

    listMemberDefaults: id =>
      withMock(
        () =>
          request(
            `${routes.members}/${id}/inadimplencias`
          ),
        () => []
      ),

    createMemberDefault: (id, data) =>
      withMock(
        () =>
          request(
            `${routes.members}/${id}/inadimplencias`,
            {
              method: 'POST',
              body: JSON.stringify(data)
            }
          ),
        () => data
      ),

    regularizeMemberDefault: (
      memberId,
      inadimplenciaId
    ) =>
      withMock(
        () =>
          request(
            `${routes.members}/${memberId}/inadimplencias/${inadimplenciaId}/regularizar`,
            {
              method: 'PATCH'
            }
          ),
        () => ({
          regularized: true
        })
      )
  };
})();