import { pool } from '../db/pool.js';

const visibleUpcomingEvents = `
  e.deleted_at IS NULL
  AND e.registration_status IN ('registration_open', 'registration_waiting')
  AND e.event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date`;

export async function listUpcomingMemberEvents(associadoId: number) {
  const result = await pool.query(
    `SELECT e.id,e.name,e.event_date AS "eventDate",e.description,e.producer,e.city,
            e.registration_status AS "registrationStatus",(r.id IS NOT NULL) AS "registrationRequested"
     FROM events e
     LEFT JOIN event_registration_requests r ON r.event_id=e.id AND r.associado_id=$1
     WHERE ${visibleUpcomingEvents}
     ORDER BY e.event_date,e.name`,
    [associadoId]
  );
  return result.rows;
}

export async function listPublicUpcomingEvents() {
  const result = await pool.query(
    `SELECT e.id,e.name,e.event_date AS "eventDate",e.description
     FROM events e
     WHERE ${visibleUpcomingEvents}
     ORDER BY e.event_date,e.name`
  );
  return result.rows;
}
