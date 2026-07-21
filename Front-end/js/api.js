(function () {
  const API_BASE_URL = window.ASSOFIG_API_URL || 'https://assofig-api.vercel.app/api';

  const routes = {
    login: '/auth/login',
    forgotPassword: '/auth/forgot-password',
    changePassword: '/auth/change-password',
    profile: '/auth/me',
    members: '/members',
    applications: '/inscricoes',
    contact: '/contato',
    pix: '/payments/pix',
    myDefaults: '/member/inadimplencias',
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

  function apiErrorMessage(data) {
    const candidates = [data?.message, data?.error, data?.details?.message];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
      if (typeof candidate?.message === 'string' && candidate.message.trim()) return candidate.message;
    }
    if (Array.isArray(data?.errors)) {
      const first = data.errors.find(item => typeof item === 'string' || typeof item?.message === 'string');
      if (typeof first === 'string') return first;
      if (typeof first?.message === 'string') return first.message;
    }
    return 'Não foi possível concluir a solicitação.';
  }
  async function request(path, options = {}) {
    const token = localStorage.getItem('assofig_token');
    let response;

    try {
      response = await fetch(API_BASE_URL + path, {
        ...options,
        headers: {
          ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
        apiErrorMessage(data),
        response.status,
        data
      );

      if (response.status === 401 && token) {
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

    changePassword: data =>
      request(routes.changePassword, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    getProfile: () => request(routes.profile),

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

    getMyDefaults: () => request(routes.myDefaults),

    uploadMyDefaultProof: (defaultId, file) => {
      const formData = new FormData();
      formData.append('proof', file);
      return request(
        routes.myDefaults + '/' + encodeURIComponent(defaultId) + '/comprovante',
        { method: 'POST', body: formData }
      );
    },

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