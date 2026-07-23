(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AssofigCredentials = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const VALID_TYPES = ['carteira', 'certificado'];
  const VALID_STATUSES = ['disponivel', 'suspensa', 'vencida'];

  const TEMPLATE_SPECS = {
    frente: {
      src: 'img/frente.png',
      alt: 'Frente da carteira digital da ASSOFIG',
      fields: {
        name: { x: 0.435, y: 0.378, width: 0.37, height: 0.052, font: 29, minFont: 17 },
        category: { x: 0.435, y: 0.541, width: 0.37, height: 0.052, font: 27, minFont: 15 },
        validity: { x: 0.435, y: 0.693, width: 0.37, height: 0.052, font: 28, minFont: 18 }
      }
    },
    verso: {
      src: 'img/verso.png',
      alt: 'Verso da carteira digital da ASSOFIG',
      fields: {
        code: { x: 0.299, y: 0.696, width: 0.187, height: 0.058, font: 22, minFont: 15 }
      }
    },
    certificado: {
      src: 'img/certificado.png',
      alt: 'Certificado digital de associação da ASSOFIG',
      fields: {
        name: { x: 0.135, y: 0.527, width: 0.75, height: 0.085, font: 53, minFont: 27 },
        validity: { x: 0.563, y: 0.691, width: 0.06, height: 0.032, font: 29, minFont: 20 },
        code: { x: 0.557, y: 0.872, width: 0.18, height: 0.035, font: 28, minFont: 18 }
      }
    }
  };

  function objectValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const data = value.data;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : value;
  }

  function normalizeCredential(response) {
    const source = objectValue(response);
    const type = VALID_TYPES.includes(source.tipoCredencial) ? source.tipoCredencial : '';
    const status = VALID_STATUSES.includes(source.status) ? source.status : '';
    const validity = Number(source.validadeAno);

    return {
      available: source.disponivel === true,
      type,
      displayName: typeof source.nomeExibicao === 'string' ? source.nomeExibicao.trim() : '',
      category: typeof source.categoriaExibicao === 'string' ? source.categoriaExibicao.trim() : '',
      validityYear: Number.isInteger(validity) && validity > 1900 ? validity : null,
      verificationCode: typeof source.codigoVerificacao === 'string' ? source.codigoVerificacao.trim().toUpperCase() : '',
      status
    };
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function credentialTypeFor(profile, credential) {
    if (credential && VALID_TYPES.includes(credential.type)) return credential.type;
    const profession = normalizeText(profile && (profile.profession || profile.profissao));
    return profession.includes('empresa') || profession.includes('pessoa juridica') || profession.includes('cnpj')
      ? 'certificado'
      : 'carteira';
  }

  function credentialLabels(type) {
    const certificate = type === 'certificado';
    return {
      title: certificate ? 'Certificado de associação' : 'Carteira do associado',
      availableText: certificate
        ? 'Seu certificado digital de associação está disponível para emissão.'
        : 'Sua carteira digital está disponível para emissão.',
      issue: certificate ? 'Emitir certificado' : 'Emitir carteira',
      view: certificate ? 'Visualizar certificado' : 'Visualizar carteira',
      download: certificate ? 'Baixar certificado' : 'Baixar carteira',
      validTitle: certificate ? 'Certificado válido' : 'Carteira válida',
      entityLabel: certificate ? 'Empresa' : 'Nome'
    };
  }

  function normalizeVerificationInput(value) {
    const raw = String(value || '').toUpperCase().replace(/[\s-]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
  }

  function isVerificationCode(value) {
    return /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(String(value || '').trim().toUpperCase());
  }

  function normalizeValidationResult(response) {
    const source = objectValue(response);
    const type = VALID_TYPES.includes(source.tipoCredencial) ? source.tipoCredencial : '';
    const year = Number(source.validadeAno);
    return {
      found: source.encontrada === true,
      valid: source.valida === true,
      type,
      name: typeof source.nome === 'string' ? source.nome.trim() : '',
      category: typeof source.categoria === 'string' ? source.categoria.trim() : '',
      situation: typeof source.situacao === 'string' ? source.situacao.trim() : '',
      validityYear: Number.isInteger(year) && year > 1900 ? year : null,
      message: typeof source.mensagem === 'string' ? source.mensagem.trim() : ''
    };
  }

  function fitScale(value, preferredLength, minimum) {
    const length = String(value || '').trim().length;
    if (!length || length <= preferredLength) return 1;
    return Math.max(minimum || 0.48, Math.min(1, preferredLength / length));
  }

  function pdfPlan(credential) {
    const type = credential && credential.type === 'certificado' ? 'certificado' : 'carteira';
    return type === 'certificado'
      ? { filename: 'certificado-associacao-assofig.pdf', pages: ['certificado'] }
      : { filename: 'carteira-assofig.pdf', pages: ['frente', 'verso'] };
  }

  function imagePromise(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível carregar a arte da credencial.'));
      image.src = src;
    });
  }

  function canvasFieldValue(field, credential) {
    if (field === 'name') return credential.displayName;
    if (field === 'category') return credential.category === 'Terap. Ocupacional'
      ? 'Terapeuta Ocupacional'
      : credential.category;
    if (field === 'validity') return credential.validityYear == null ? '' : String(credential.validityYear);
    return credential.verificationCode;
  }

  function fittedCanvasFont(context, value, spec) {
    let size = spec.font;
    context.font = '700 ' + size + 'px Arial, sans-serif';
    while (size > spec.minFont && context.measureText(value).width > spec.width * context.canvas.width * 0.9) {
      size -= 1;
      context.font = '700 ' + size + 'px Arial, sans-serif';
    }
    return size;
  }

  async function renderCredentialCanvas(template, credential) {
    const spec = TEMPLATE_SPECS[template];
    if (!spec || typeof document === 'undefined') throw new Error('Arte da credencial indisponível.');
    const image = await imagePromise(spec.src);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.fillStyle = '#092a46';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    Object.entries(spec.fields).forEach(([field, fieldSpec]) => {
      const value = canvasFieldValue(field, credential);
      if (!value) return;
      fittedCanvasFont(context, value, fieldSpec);
      context.fillText(
        value,
        (fieldSpec.x + fieldSpec.width / 2) * canvas.width,
        (fieldSpec.y + fieldSpec.height / 2) * canvas.height
      );
    });
    return canvas;
  }

  async function downloadCredentialPdf(credential) {
    const JsPdf = root && root.jspdf && root.jspdf.jsPDF;
    if (!JsPdf) throw new Error('Gerador de PDF indisponível.');
    const plan = pdfPlan(credential);
    let pdf = null;

    for (let index = 0; index < plan.pages.length; index += 1) {
      const canvas = await renderCredentialCanvas(plan.pages[index], credential);
      const width = canvas.width;
      const height = canvas.height;
      if (!pdf) {
        pdf = new JsPdf({
          orientation: width >= height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
          compress: true
        });
      } else {
        pdf.addPage([width, height], width >= height ? 'landscape' : 'portrait');
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, width, height, undefined, 'FAST');
    }

    pdf.save(plan.filename);
    return plan.filename;
  }

  return {
    TEMPLATE_SPECS,
    normalizeCredential,
    credentialTypeFor,
    credentialLabels,
    normalizeVerificationInput,
    isVerificationCode,
    normalizeValidationResult,
    fitScale,
    pdfPlan,
    renderCredentialCanvas,
    downloadCredentialPdf
  };
});
