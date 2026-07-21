import { basename } from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { authenticate, requireMemberLink, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { sendPaymentProofEmail } from '../services/email.js';
import { ApiError } from '../utils/api-error.js';
import { idSchema } from '../schemas/common.js';
import { memberCatalogRouter } from './catalog.js';

export const memberRouter = Router();

const MAX_PROOF_SIZE = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_SIZE, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_PROOF_TYPES.has(file.mimetype)) {
      callback(new ApiError(415, 'Formato de arquivo inválido. Envie PDF, JPEG ou PNG.'));
      return;
    }
    callback(null, true);
  }
}).single('proof');

function hasValidSignature(file: Express.Multer.File): boolean {
  const bytes = file.buffer;
  if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

async function requireOwnDelinquency(req: Request, _res: Response, next: NextFunction) {
  try {
    const inadimplenciaId = idSchema.parse(req.params.inadimplenciaId);
    const result = await pool.query(
      `SELECT i.id, i.status
       FROM inadimplencias i
       WHERE i.id = $1 AND i.associado_id = $2`,
      [inadimplenciaId, req.auth!.associadoId]
    );
    if (!result.rowCount) return next(new ApiError(404, 'Inadimplência não encontrada.'));
    if (result.rows[0].status === 'resolved') return next(new ApiError(409, 'Inadimplência já quitada.'));
    next();
  } catch (error) {
    next(error);
  }
}

memberRouter.use(authenticate, requirePasswordChangeCompleted, requireMemberLink);
memberRouter.use(memberCatalogRouter);

memberRouter.get('/inadimplencias', async (req, res) => {
  const result = await pool.query(
    `SELECT i.id, i.amount::float AS amount, i.due_date AS "dueDate",
            i.reference_month AS "referenceMonth",
            CASE i.status WHEN 'resolved' THEN 'paid' ELSE i.status::text END AS status,
            i.proof_sent_at AS "proofSentAt"
     FROM inadimplencias i
     WHERE i.associado_id = $1
     ORDER BY i.due_date DESC`,
    [req.auth!.associadoId]
  );
  res.json({ inadimplencias: result.rows });
});

memberRouter.post(
  '/inadimplencias/:inadimplenciaId/comprovante',
  requireOwnDelinquency,
  proofUpload,
  async (req: Request, res: Response) => {
    if (!req.file) throw new ApiError(400, 'Arquivo de comprovante não informado no campo proof.');
    if (!hasValidSignature(req.file)) {
      throw new ApiError(415, 'O conteúdo do arquivo não corresponde ao formato informado.');
    }

    const inadimplenciaId = idSchema.parse(req.params.inadimplenciaId);
    const associadoId = req.auth!.associadoId!;
    const proof = req.file;
    const filename = basename(proof.originalname).replace(/[\r\n]/g, '_') || 'comprovante';

    const inadimplencia = await transaction(async (client) => {
      const locked = await client.query(
        `SELECT i.id, i.amount::float AS amount, i.due_date, i.reference_month, i.status,
                a.name AS associado_name, a.email AS associado_email
         FROM inadimplencias i
         JOIN associados a ON a.id = i.associado_id
         WHERE i.id = $1 AND i.associado_id = $2
         FOR UPDATE OF i`,
        [inadimplenciaId, associadoId]
      );
      if (!locked.rowCount) throw new ApiError(404, 'Inadimplência não encontrada.');
      const item = locked.rows[0];
      if (item.status === 'resolved') throw new ApiError(409, 'Inadimplência já quitada.');

      let emailId: string | null;
      try {
        emailId = await sendPaymentProofEmail({
          memberName: item.associado_name,
          memberEmail: item.associado_email,
          delinquencyId: Number(item.id),
          amount: Number(item.amount),
          dueDate: item.due_date,
          referenceMonth: item.reference_month,
          proof: { filename, contentType: proof.mimetype, content: proof.buffer }
        });
      } catch {
        throw new ApiError(502, 'Não foi possível enviar o comprovante por e-mail. Tente novamente.');
      }

      const updated = await client.query(
        `UPDATE inadimplencias
         SET status = 'proof_sent', proof_sent_at = NOW(), proof_email_id = $3, updated_at = NOW()
         WHERE id = $1 AND associado_id = $2
         RETURNING id, status::text AS status, proof_sent_at AS "proofSentAt"`,
        [inadimplenciaId, associadoId, emailId]
      );
      return updated.rows[0];
    });

    res.json({
      message: 'Comprovante enviado com sucesso. O pagamento será conferido pela Diretoria.',
      inadimplencia
    });
  }
);
