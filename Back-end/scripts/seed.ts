import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

type SeedMember = {
  name: string;
  profession: 'Fisioterapeuta' | 'Terapeuta Ocupacional';
  city: string;
  email: string;
  document: string | null;
  isBoardMember?: boolean;
};

const members: SeedMember[] = [
  { name: 'Edson Flavio de Sousa', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'edsonmflavio@gmail.com', document: '11995365637', isBoardMember: true },
  { name: 'Jamili Dias Bernardino', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'milli_dias@yahoo.com.br', document: '08135543654', isBoardMember: true },
  { name: 'Gabriel Possidonio Goulart', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'gabriel.goulart@assofig.local', document: '07975711675', isBoardMember: true },
  { name: 'Verônica dos Reis Ruela', profession: 'Fisioterapeuta', city: 'Muzambinho', email: 'veronica.ruela@assofig.local', document: '10675640636', isBoardMember: true },
  { name: 'Marcella de Túlio do Prado', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'marcella.prado@assofig.local', document: null, isBoardMember: true },
  { name: 'Fernando Ferreira da Silva', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'fernando.silva@assofig.local', document: '05189368645' },
  { name: 'Isabela Verônica de Abreu Melo', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'isabela.melo@assofig.local', document: '07983952651' },
  { name: 'Thays Cristina Reis Olimpio', profession: 'Terapeuta Ocupacional', city: 'Muzambinho', email: 'thays.olimpio@assofig.local', document: '04675953646' },
  { name: 'Saulo Nani Leite', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'saulo1979@gmail.com', document: '04060090662' },
  { name: 'Renata Cristina Martins da Silva Vieira', profession: 'Fisioterapeuta', city: 'Muzambinho', email: 'renata.vieira@assofig.local', document: '30209360801' },
  { name: 'Talita Andrea Bordini Malaman', profession: 'Fisioterapeuta', city: 'Porto Ferreira', email: 'tamalaman@gmail.com', document: '22345377895' },
  { name: 'Angela Maria Paiva Magri', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'minasangel@yahoo.com.br', document: '08149261699' },
  { name: 'Isabela Scali Lourenço Simon', profession: 'Fisioterapeuta', city: 'Guaxupé', email: 'isabela.scali@hotmail.com', document: '04202106601' }
];

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'demo123', 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const boardEmails = members.filter((member) => member.isBoardMember).map((member) => member.email);
    await client.query("UPDATE users SET active = FALSE, updated_at = NOW() WHERE role = 'admin' AND NOT (email = ANY($1::text[]))", [boardEmails]);
    for (const member of members) {
      const associado = await client.query(
        `INSERT INTO associados (name, profession, email, document, city, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name, profession = EXCLUDED.profession,
           document = EXCLUDED.document, city = EXCLUDED.city, status = 'active', updated_at = NOW()
         RETURNING id`,
        [member.name, member.profession, member.email, member.document, member.city]
      );
      await client.query(
        `INSERT INTO users (email, password_hash, role, name, associado_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           name = EXCLUDED.name, associado_id = EXCLUDED.associado_id,
           active = TRUE, updated_at = NOW()`,
        [member.email, passwordHash, member.isBoardMember ? 'admin' : 'member', member.name, associado.rows[0].id]
      );
    }
    await client.query('COMMIT');
    console.log(`${members.length} associados cadastrados; ${members.filter((member) => member.isBoardMember).length} com acesso à diretoria.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().finally(() => pool.end());