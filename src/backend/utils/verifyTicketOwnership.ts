import db from "../db/connection.js";

// Verify ticket ownership
export const verifyTicketOwnership = async (
  userId: number,
  ticketCode: string,
  byCode: boolean = true
) => {
  const query = byCode
    ? `SELECT t.*, e.start_time, e.end_time, e.title as event_title, 
                e.address, e.city, e.post_code, e.image_url
         FROM tickets t
         JOIN events e ON t.event_id = e.id
         WHERE t.ticket_code = $1 AND t.user_id = $2`
    : `SELECT t.*, e.start_time, e.end_time, e.title as event_title,
                e.address, e.city, e.post_code, e.image_url
         FROM tickets t
         JOIN events e ON t.event_id = e.id
         WHERE t.id = $1 AND t.user_id = $2`;

  const result = await db.query(query, [ticketCode, userId]);
  return result.rows[0];
};
