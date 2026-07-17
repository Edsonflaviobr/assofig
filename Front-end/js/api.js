(function () {
  const API_BASE_URL = window.ASSOFIG_API_URL || 'https://assofig-api.vercel.app/api';

  const routes = {
    login: '/auth/login',
    forgotPassword: '/auth/forgot-password',
    profile: '/auth/me',
    profileFallback: '/profile',
    members: '/members',
    applications: '/inscricoes',
    contact: '/contato',
    pix: '/payments/pix',
    myDefaults: '/auth/me/inadimplencias',
    myDefaultsFallback: '/profile/inadimplencias',
    news: '/noticias',
    events: '/eventos'
  };

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  async function request(path, options = {}) {
    const token = localStorage.getItem('assofig_token');
    let response;

    try {
      response = await fetch(API_BASE_URL + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new ApiError('Não foi possível conectar à API.', 0);
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const error = new ApiError(
        data?.message || data?.error || 'Não foi possível concluir a solicitação.',
        response.status,
        data
      );

      if ((response.status === 401 || response.status === 403) && token) {
        localStorage.removeItem('assofig_token');
        window.dispatchEvent(new CustomEvent('assofig:session-expired', { detail: { status: response.status } }));
      }

      throw error;
    }

    return data;
  }

  async function fallbackOnNotFound(primary, fallback) {
    try {
      return await primary();
    } catch (error) {
      if (error.status !== 404) throw error;
      return fallback();
    }
  }

  const memberPath = id => routes.members + '/' + encodeURIComponent(id);

  window.AssofigAPI = {
    config: { baseUrl: API_BASE_URL, routes },

    login: credentials =>
      request(routes.login, {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),

    forgotPassword: data =>
      request(routes.forgotPassword, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    getProfile: () =>
      fallbackOnNotFound(
        () => request(routes.profile),
        () => request(routes.profileFallback)
      ),

    submitApplication: data =>
      request(routes.applications, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    sendContact: data =>
      request(routes.contact, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    listMembers: () => request(routes.members),
    getMember: id => request(memberPath(id)),

    createMember: data =>
      request(routes.members, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    updateMember: (id, data) =>
      request(memberPath(id), {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    deleteMember: id =>
      request(memberPath(id), {
        method: 'DELETE'
      }),

    getMyDefaults: () =>
      fallbackOnNotFound(
        () => request(routes.myDefaults),
        () => request(routes.myDefaultsFallback)
      ),

    listMemberDefaults: id =>
      request(memberPath(id) + '/inadimplencias'),

    createMemberDefault: (id, data) =>
      request(memberPath(id) + '/inadimplencias', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    regularizeMemberDefault: (memberId, defaultId) =>
      request(
        memberPath(memberId) + '/inadimplencias/' + encodeURIComponent(defaultId) + '/regularizar',
        { method: 'PATCH' }
      ),

    getPixInfo: () => request(routes.pix),
    listNews: () => request(routes.news),
    listEvents: () => request(routes.events)
  };
})();