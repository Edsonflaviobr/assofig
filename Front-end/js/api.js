(function(){
  const API_BASE_URL = window.ASSOFIG_API_URL || 'http://localhost:3000/api';
  const USE_MOCKS = window.ASSOFIG_USE_MOCKS !== false;

  const routes = {
    login: '/auth/login',
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
    const response = await fetch(API_BASE_URL + path, {
      ...options,
      headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...options.headers}
    });
    if (!response.ok) throw new Error((await response.json().catch(()=>({}))).message || 'Não foi possível concluir a solicitação.');
    return response.status === 204 ? null : response.json();
  }

  async function withMock(remoteCall, mockCall) {
    if (USE_MOCKS) return Promise.resolve().then(mockCall);
    return remoteCall();
  }

  window.AssofigAPI = {
    config: {baseUrl: API_BASE_URL, useMocks: USE_MOCKS, routes},
    login: credentials => withMock(
      () => request(routes.login,{method:'POST',body:JSON.stringify(credentials)}),
      () => ({token:'token-demonstracao',role:credentials.role,user:{name:credentials.role==='admin'?'Diretoria ASSOFIG':'Mariana Costa'}})
    ),
    submitApplication: data => withMock(
      () => request(routes.applications,{method:'POST',body:JSON.stringify(data)}),
      () => ({id:Date.now(),status:'recebida'})
    ),
    sendContact: data => withMock(
      () => request(routes.contact,{method:'POST',body:JSON.stringify(data)}),
      () => ({sent:true})
    ),
    listMembers: () => withMock(() => request(routes.members), () => JSON.parse(localStorage.getItem('assofig_members') || 'null')),
    createMember: data => withMock(() => request(routes.members,{method:'POST',body:JSON.stringify(data)}), () => data),
    updateMember: (id,data) => withMock(() => request(`${routes.members}/${id}`,{method:'PUT',body:JSON.stringify(data)}), () => data),
    deleteMember: id => withMock(() => request(`${routes.members}/${id}`,{method:'DELETE'}), () => ({id})),
    createPayment: data => withMock(() => request(routes.payments,{method:'POST',body:JSON.stringify(data)}), () => ({id:Date.now(),status:'pendente',...data}))
  };
})();
