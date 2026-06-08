'use strict';

const { pool } = require('../../config/database');

const getMyTickets = async (req, res) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        b.id AS booking_id,
        b.booking_code,
        b.status AS booking_status,
        b.total_amount,
        b.created_at AS booking_date,
        e.id AS event_id,
        e.title AS event_title,
        e.banner_url,
        e.start_time,
        e.venue_name,
        json_agg(
          json_build_object(
            'ticket_id', t.id,
            'ticket_code', t.ticket_code,
            'tier_name', tt.name,
            'status', t.status
          )
        ) AS tickets
      FROM booking_domain.bookings b
      JOIN event_domain.events e ON b.event_id = e.id
      LEFT JOIN booking_domain.tickets t ON b.id = t.booking_id
      LEFT JOIN event_domain.ticket_tiers tt ON t.ticket_tier_id = tt.id
      WHERE b.user_id = $1
      GROUP BY b.id, e.id
      ORDER BY b.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    
    return res.status(200).json({
      data: result.rows
    });
  } catch (error) {
    console.error('[User Controller] getMyTickets error:', error);
    return res.status(500).json({ error: { message: 'Lỗi server khi lấy danh sách vé' } });
  }
};

module.exports = { getMyTickets };
