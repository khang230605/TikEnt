/**
 * api/controllers/events.controller.js – Event Catalog Service
 * ============================================================
 * Controller xử lý logic nghiệp vụ cho Event API.
 * Routes gọi vào đây, controller tương tác với DB.
 *
 * Chỉ thao tác trên schema event_domain (Shared Database).
 * ============================================================
 */
'use strict';

const { pool } = require('../../config/database');

// ============================================================
// POST /api/v1/events  – FR-09: Tạo sự kiện (ORGANIZER)
// ============================================================

/**
 * Tạo sự kiện mới kèm danh sách hạng vé và khởi tạo inventory.
 *
 * Luồng trong một DB Transaction duy nhất:
 *  1. INSERT event_domain.events
 *  2. Với mỗi tier trong ticket_tiers:
 *       INSERT event_domain.ticket_tiers
 *       INSERT event_domain.inventory (version=0, reserved_qty=0, sold_qty=0)
 *  3. COMMIT
 *
 * @route  POST /api/v1/events
 * @access ORGANIZER, ADMIN
 */
async function createEvent(req, res) {
  const {
    title,
    description,
    category,
    venue_name,
    venue_address,
    city,
    country = 'VN',
    start_time,
    end_time,
    banner_url,
    ticket_tiers = [],  // mảng hạng vé kèm số lượng, giá
  } = req.body;

  // organizer_id lấy từ JWT (đã verify bởi middleware authenticate)
  const organizerId = req.user.id;

  const dbClient = await pool.connect();

  try {
    // ── Bước 1: Bắt đầu Transaction ──────────────────────────
    await dbClient.query('BEGIN');
    console.log(`[EventController] Tạo sự kiện: "${title}" bởi organizer=${organizerId}`);

    // ── Bước 2: INSERT sự kiện ────────────────────────────────
    const eventRes = await dbClient.query(
      `INSERT INTO event_domain.events
         (id, organizer_id, title, description, category,
          venue_name, venue_address, city, country,
          start_time, end_time, banner_url, status,
          created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, 'DRAFT',
          NOW(), NOW())
       RETURNING id, title, status, created_at`,
      [
        organizerId, title, description || null, category || null,
        venue_name || null, venue_address || null, city || null, country,
        start_time, end_time, banner_url || null,
      ]
    );

    const newEvent = eventRes.rows[0];
    console.log(`[EventController] ✓ Event inserted: id=${newEvent.id}`);

    // ── Bước 3: INSERT ticket_tiers + inventory ───────────────
    // Mỗi hạng vé được INSERT kèm một bản ghi inventory tương ứng.
    // inventory.version = 0 (khởi điểm cho Optimistic Locking)
    const insertedTiers = [];

    for (const tier of ticket_tiers) {
      const {
        name,
        description: tierDesc,
        price,
        currency = 'VND',
        total_qty,
        max_per_order = 10,
        sale_start,
        sale_end,
      } = tier;

      // 3a: INSERT ticket_tier
      const tierRes = await dbClient.query(
        `INSERT INTO event_domain.ticket_tiers
           (id, event_id, name, description, price, currency,
            max_per_order, sale_start, sale_end,
            created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8,
            NOW(), NOW())
         RETURNING id, name, price, currency`,
        [
          newEvent.id, name, tierDesc || null, price, currency,
          max_per_order, sale_start || null, sale_end || null,
        ]
      );

      const newTier = tierRes.rows[0];

      // 3b: INSERT inventory với version=0 (Optimistic Locking khởi điểm)
      await dbClient.query(
        `INSERT INTO event_domain.inventory
           (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, 0, 0, 0, NOW())`,
        [newTier.id, total_qty]
      );

      insertedTiers.push({
        id:           newTier.id,
        name:         newTier.name,
        price:        parseFloat(newTier.price),
        currency:     newTier.currency,
        total_qty,
        available_qty: total_qty,  // lúc mới tạo, tất cả đều available
      });

      console.log(
        `[EventController] ✓ Tier "${name}" (qty=${total_qty}, price=${price}) inserted.`
      );
    }

    // ── Bước 4: COMMIT ────────────────────────────────────────
    await dbClient.query('COMMIT');
    console.log(`[EventController] ✓ COMMIT – Sự kiện "${title}" đã được tạo.`);

    return res.status(201).json({
      message: 'Sự kiện đã được tạo thành công.',
      data: {
        id:           newEvent.id,
        title:        newEvent.title,
        status:       newEvent.status,  // DRAFT
        organizer_id: organizerId,
        created_at:   newEvent.created_at,
        ticket_tiers: insertedTiers,
      },
    });

  } catch (err) {
    console.error('[EventController] Lỗi tạo sự kiện:', err.message);
    try { await dbClient.query('ROLLBACK'); } catch (_) {}
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể tạo sự kiện, vui lòng thử lại.' },
    });
  } finally {
    dbClient.release();
  }
}

// ============================================================
// GET /api/v1/events  – FR-01: Danh sách sự kiện (CUSTOMER)
// ============================================================

/**
 * Lấy danh sách sự kiện đã PUBLISHED kèm thông tin tồn kho
 * real-time từ bảng inventory.
 *
 * Query Parameters:
 *  - category  : lọc theo danh mục (VD: "Music", "Sports")
 *  - city      : lọc theo thành phố
 *  - page      : số trang (default: 1)
 *  - limit     : số sự kiện mỗi trang (default: 20, max: 100)
 *  - search    : tìm kiếm theo tên sự kiện (ILIKE)
 *  - from_date : lọc từ ngày (ISO8601)
 *  - to_date   : lọc đến ngày (ISO8601)
 *
 * @route  GET /api/v1/events
 * @access Public (không cần auth)
 */
async function listEvents(req, res) {
  const {
    category,
    city,
    search,
    from_date,
    to_date,
    page  = 1,
    limit = 20,
  } = req.query;

  // Validate và giới hạn pagination
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset   = (pageNum - 1) * limitNum;

  // ── Xây dựng câu WHERE động ───────────────────────────────
  // Dùng mảng điều kiện và params để tránh SQL injection
  const conditions = [`e.status = 'PUBLISHED'`, `e.deleted_at IS NULL`];
  const params     = [];

  if (category) {
    params.push(category);
    conditions.push(`e.category ILIKE $${params.length}`);
  }
  if (city) {
    params.push(city);
    conditions.push(`e.city ILIKE $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`e.title ILIKE $${params.length}`);
  }
  if (from_date) {
    params.push(from_date);
    conditions.push(`e.start_time >= $${params.length}`);
  }
  if (to_date) {
    params.push(to_date);
    conditions.push(`e.start_time <= $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  try {
    // ── Query 1: Tổng số sự kiện (để trả về meta pagination) ─
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT e.id) AS total
         FROM event_domain.events e
        WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // ── Query 2: Danh sách sự kiện kèm ticket_tiers + inventory
    //
    // Dùng subquery JSON_AGG để gộp tất cả hạng vé của mỗi sự kiện
    // thành một mảng JSON – tránh N+1 query.
    //
    // available_qty = total_qty - reserved_qty - sold_qty
    // (số vé thực tế còn có thể bán, real-time từ inventory)
    params.push(limitNum, offset);
    const listRes = await pool.query(
      `SELECT
           e.id,
           e.organizer_id,
           e.title,
           e.description,
           e.category,
           e.venue_name,
           e.venue_address,
           e.city,
           e.country,
           e.start_time,
           e.end_time,
           e.banner_url,
           e.status,
           e.created_at,
           -- Gộp danh sách hạng vé thành JSON array
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id',            t.id,
                 'name',          t.name,
                 'description',   t.description,
                 'price',         t.price::FLOAT,
                 'currency',      t.currency,
                 'max_per_order', t.max_per_order,
                 'sale_start',    t.sale_start,
                 'sale_end',      t.sale_end,
                 'total_qty',     inv.total_qty,
                 'available_qty', GREATEST(0, inv.total_qty - inv.reserved_qty - inv.sold_qty)
               ) ORDER BY t.price ASC
             ) FILTER (WHERE t.id IS NOT NULL AND t.deleted_at IS NULL),
             '[]'::JSON
           ) AS ticket_tiers
         FROM event_domain.events e
         LEFT JOIN event_domain.ticket_tiers t   ON t.event_id = e.id
         LEFT JOIN event_domain.inventory    inv ON inv.ticket_tier_id = t.id
        WHERE ${whereClause}
        GROUP BY e.id
        ORDER BY e.start_time ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.status(200).json({
      data: listRes.rows,
      meta: {
        total,
        page:       pageNum,
        limit:      limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });

  } catch (err) {
    console.error('[EventController] Lỗi lấy danh sách sự kiện:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể lấy danh sách sự kiện.' },
    });
  }
}

// ============================================================
// GET /api/v1/events/:eventId  – Chi tiết sự kiện
// ============================================================

/**
 * Lấy chi tiết một sự kiện cụ thể kèm tất cả hạng vé và số vé còn lại.
 *
 * @route  GET /api/v1/events/:eventId
 * @access Public
 */
async function getEventById(req, res) {
  const { eventId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
           e.id, e.organizer_id, e.title, e.description,
           e.category, e.venue_name, e.venue_address,
           e.city, e.country, e.start_time, e.end_time,
           e.banner_url, e.status, e.created_at, e.updated_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id',            t.id,
                 'name',          t.name,
                 'description',   t.description,
                 'price',         t.price::FLOAT,
                 'currency',      t.currency,
                 'max_per_order', t.max_per_order,
                 'sale_start',    t.sale_start,
                 'sale_end',      t.sale_end,
                 'total_qty',     inv.total_qty,
                 'available_qty', GREATEST(0, inv.total_qty - inv.reserved_qty - inv.sold_qty)
               ) ORDER BY t.price ASC
             ) FILTER (WHERE t.id IS NOT NULL AND t.deleted_at IS NULL),
             '[]'::JSON
           ) AS ticket_tiers
         FROM event_domain.events e
         LEFT JOIN event_domain.ticket_tiers t   ON t.event_id = e.id
         LEFT JOIN event_domain.inventory    inv ON inv.ticket_tier_id = t.id
        WHERE e.id = $1
          AND e.deleted_at IS NULL
        GROUP BY e.id`,
      [eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy sự kiện.' },
      });
    }

    return res.status(200).json({ data: result.rows[0] });

  } catch (err) {
    console.error('[EventController] Lỗi lấy chi tiết sự kiện:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể lấy chi tiết sự kiện.' },
    });
  }
}

// ============================================================
// PATCH /api/v1/events/:eventId/publish  – Publish sự kiện
// ============================================================

/**
 * Chuyển trạng thái sự kiện từ DRAFT sang PUBLISHED.
 * Chỉ ORGANIZER sở hữu sự kiện hoặc ADMIN mới được phép.
 *
 * @route  PATCH /api/v1/events/:eventId/publish
 * @access ORGANIZER (owner), ADMIN
 */
async function publishEvent(req, res) {
  const { eventId } = req.params;
  const { id: userId, role } = req.user;

  try {
    // Kiểm tra sự kiện tồn tại và thuộc về organizer đang request
    const eventRes = await pool.query(
      `SELECT id, organizer_id, status FROM event_domain.events WHERE id = $1 AND deleted_at IS NULL`,
      [eventId]
    );

    if (eventRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy sự kiện.' } });
    }

    const event = eventRes.rows[0];

    // Kiểm tra quyền: chỉ chủ sự kiện hoặc ADMIN
    if (role !== 'ADMIN' && event.organizer_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Bạn không có quyền publish sự kiện này.' },
      });
    }

    if (event.status === 'PUBLISHED') {
      return res.status(400).json({
        error: { code: 'INVALID_STATE', message: 'Sự kiện đã được publish.' },
      });
    }

    await pool.query(
      `UPDATE event_domain.events SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1`,
      [eventId]
    );

    return res.status(200).json({
      message: 'Sự kiện đã được publish thành công.',
      data: { id: eventId, status: 'PUBLISHED' },
    });

  } catch (err) {
    console.error('[EventController] Lỗi publish sự kiện:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể publish sự kiện.' },
    });
  }
}

module.exports = { createEvent, listEvents, getEventById, publishEvent };
