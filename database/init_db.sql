-- ============================================================
--  TickEnt – Shared Database Schema (PostgreSQL)
--  Pattern : Shared Database (SOA/Microservices)
--  Schemas : user_domain | event_domain | booking_domain
--  Author  : TickEnt Team
--  Notes   :
--    • UUID primary keys (gen_random_uuid() — pgcrypto not needed in PG 13+)
--    • Optimistic Locking via `version BIGINT DEFAULT 0` in inventory
--    • Soft-delete via `deleted_at TIMESTAMPTZ`
--    • All timestamps are TIMESTAMPTZ (timezone-aware)
-- ============================================================

-- Enable uuid-ossp extension (fallback if PG < 13)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1.  SCHEMA : user_domain
-- ============================================================
CREATE SCHEMA IF NOT EXISTS user_domain;

-- ------------------------------------------------------------
-- 1.1  users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_domain.users (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(512)    NOT NULL,
    full_name       VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    role            VARCHAR(50)     NOT NULL DEFAULT 'CUSTOMER',   -- CUSTOMER | ORGANIZER | ADMIN
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                                   -- soft-delete

    CONSTRAINT pk_users             PRIMARY KEY (id),
    CONSTRAINT uq_users_email       UNIQUE      (email),
    CONSTRAINT chk_users_role       CHECK       (role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON user_domain.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role       ON user_domain.users (role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON user_domain.users (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON TABLE  user_domain.users              IS 'Registered platform users';
COMMENT ON COLUMN user_domain.users.role         IS 'CUSTOMER | ORGANIZER | ADMIN';
COMMENT ON COLUMN user_domain.users.deleted_at   IS 'NULL = active, non-NULL = soft-deleted';


-- ============================================================
-- 2.  SCHEMA : event_domain
-- ============================================================
CREATE SCHEMA IF NOT EXISTS event_domain;

-- ------------------------------------------------------------
-- 2.1  events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_domain.events (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    organizer_id    UUID            NOT NULL,   -- FK → user_domain.users.id (logical, cross-schema)
    title           VARCHAR(512)    NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    venue_name      VARCHAR(255),
    venue_address   TEXT,
    city            VARCHAR(100),
    country         VARCHAR(100)    NOT NULL DEFAULT 'VN',
    start_time      TIMESTAMPTZ     NOT NULL,
    end_time        TIMESTAMPTZ     NOT NULL,
    banner_url      TEXT,
    status          VARCHAR(50)     NOT NULL DEFAULT 'DRAFT',   -- DRAFT | PUBLISHED | CANCELLED | COMPLETED
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT pk_events            PRIMARY KEY (id),
    CONSTRAINT chk_events_status    CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT chk_events_time      CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_events_organizer  ON event_domain.events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status     ON event_domain.events (status);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON event_domain.events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON event_domain.events (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON TABLE  event_domain.events              IS 'Events created by organizers';
COMMENT ON COLUMN event_domain.events.organizer_id IS 'Logical FK to user_domain.users.id';
COMMENT ON COLUMN event_domain.events.status       IS 'DRAFT | PUBLISHED | CANCELLED | COMPLETED';

-- ------------------------------------------------------------
-- 2.2  ticket_tiers  (hạng vé: VIP, Standard, Economy …)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_domain.ticket_tiers (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    event_id        UUID            NOT NULL,
    name            VARCHAR(255)    NOT NULL,   -- e.g. "VIP", "Standard"
    description     TEXT,
    price           NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    currency        CHAR(3)         NOT NULL DEFAULT 'VND',
    max_per_order   INT             NOT NULL DEFAULT 10,
    sale_start      TIMESTAMPTZ,
    sale_end        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT pk_ticket_tiers          PRIMARY KEY (id),
    CONSTRAINT fk_tt_event              FOREIGN KEY (event_id)
                                            REFERENCES event_domain.events (id)
                                            ON DELETE CASCADE,
    CONSTRAINT chk_tt_price             CHECK (price >= 0),
    CONSTRAINT chk_tt_max_per_order     CHECK (max_per_order > 0),
    CONSTRAINT chk_tt_sale_period       CHECK (sale_end IS NULL OR sale_end > sale_start)
);

CREATE INDEX IF NOT EXISTS idx_tt_event_id   ON event_domain.ticket_tiers (event_id);
CREATE INDEX IF NOT EXISTS idx_tt_deleted_at ON event_domain.ticket_tiers (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON TABLE  event_domain.ticket_tiers             IS 'Ticket tiers / categories for an event';
COMMENT ON COLUMN event_domain.ticket_tiers.price       IS 'Unit price in the specified currency';
COMMENT ON COLUMN event_domain.ticket_tiers.currency    IS 'ISO 4217 currency code';

-- ------------------------------------------------------------
-- 2.3  inventory  (số lượng vé per tier – Optimistic Locking)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_domain.inventory (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    ticket_tier_id  UUID            NOT NULL,
    total_qty       INT             NOT NULL,            -- tổng số vé phát hành
    reserved_qty    INT             NOT NULL DEFAULT 0,  -- đang giữ chờ thanh toán
    sold_qty        INT             NOT NULL DEFAULT 0,  -- đã bán thành công
    version         BIGINT          NOT NULL DEFAULT 0,  -- *** Optimistic Locking ***
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_inventory             PRIMARY KEY (id),
    CONSTRAINT fk_inv_ticket_tier       FOREIGN KEY (ticket_tier_id)
                                            REFERENCES event_domain.ticket_tiers (id)
                                            ON DELETE CASCADE,
    CONSTRAINT uq_inv_ticket_tier       UNIQUE (ticket_tier_id),           -- 1 tier : 1 inventory row
    CONSTRAINT chk_inv_total_qty        CHECK (total_qty >= 0),
    CONSTRAINT chk_inv_reserved_qty     CHECK (reserved_qty >= 0),
    CONSTRAINT chk_inv_sold_qty         CHECK (sold_qty >= 0),
    CONSTRAINT chk_inv_consistency      CHECK (reserved_qty + sold_qty <= total_qty)
);

CREATE INDEX IF NOT EXISTS idx_inv_ticket_tier_id ON event_domain.inventory (ticket_tier_id);

COMMENT ON TABLE  event_domain.inventory              IS 'Ticket inventory per tier with Optimistic Locking';
COMMENT ON COLUMN event_domain.inventory.total_qty    IS 'Total tickets issued for this tier';
COMMENT ON COLUMN event_domain.inventory.reserved_qty IS 'Tickets currently held (pending payment)';
COMMENT ON COLUMN event_domain.inventory.sold_qty     IS 'Tickets successfully sold';
COMMENT ON COLUMN event_domain.inventory.version      IS 'Optimistic locking version counter – increment on every UPDATE';


-- ============================================================
-- 3.  SCHEMA : booking_domain
-- ============================================================
CREATE SCHEMA IF NOT EXISTS booking_domain;

-- ------------------------------------------------------------
-- 3.1  bookings  (đơn đặt vé)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_domain.bookings (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,           -- logical FK → user_domain.users.id
    event_id        UUID            NOT NULL,           -- logical FK → event_domain.events.id
    booking_code    VARCHAR(64)     NOT NULL,           -- human-readable reference code
    status          VARCHAR(50)     NOT NULL DEFAULT 'PENDING',
    --   PENDING → CONFIRMED → CANCELLED | EXPIRED | REFUNDED
    total_amount    NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    currency        CHAR(3)         NOT NULL DEFAULT 'VND',
    payment_method  VARCHAR(100),
    payment_ref     VARCHAR(255),                       -- external payment gateway reference
    expires_at      TIMESTAMPTZ,                        -- booking hold expiry
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_bookings              PRIMARY KEY (id),
    CONSTRAINT uq_bookings_code         UNIQUE (booking_code),
    CONSTRAINT chk_bookings_status      CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
    CONSTRAINT chk_bookings_amount      CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id      ON booking_domain.bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id     ON booking_domain.bookings (event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON booking_domain.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_code ON booking_domain.bookings (booking_code);
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at   ON booking_domain.bookings (expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE  booking_domain.bookings              IS 'Customer booking orders';
COMMENT ON COLUMN booking_domain.bookings.user_id      IS 'Logical FK to user_domain.users.id';
COMMENT ON COLUMN booking_domain.bookings.event_id     IS 'Logical FK to event_domain.events.id';
COMMENT ON COLUMN booking_domain.bookings.booking_code IS 'Human-readable booking reference (e.g. TICK-20240601-XXXX)';
COMMENT ON COLUMN booking_domain.bookings.status       IS 'PENDING | CONFIRMED | CANCELLED | EXPIRED | REFUNDED';

-- ------------------------------------------------------------
-- 3.2  tickets  (từng vé cụ thể trong một booking)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_domain.tickets (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    booking_id      UUID            NOT NULL,
    ticket_tier_id  UUID            NOT NULL,           -- logical FK → event_domain.ticket_tiers.id
    event_id        UUID            NOT NULL,           -- denormalized for fast query
    user_id         UUID            NOT NULL,           -- denormalized (owner)
    ticket_code     VARCHAR(128)    NOT NULL,           -- unique barcode / QR payload
    seat_info       VARCHAR(255),                       -- optional: row, seat number
    attendee_name   VARCHAR(255),
    attendee_email  VARCHAR(255),
    unit_price      NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    currency        CHAR(3)         NOT NULL DEFAULT 'VND',
    status          VARCHAR(50)     NOT NULL DEFAULT 'ACTIVE',
    --   ACTIVE | USED | CANCELLED | REFUNDED
    checked_in_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tickets               PRIMARY KEY (id),
    CONSTRAINT fk_tickets_booking       FOREIGN KEY (booking_id)
                                            REFERENCES booking_domain.bookings (id)
                                            ON DELETE RESTRICT,
    CONSTRAINT uq_tickets_code          UNIQUE (ticket_code),
    CONSTRAINT chk_tickets_status       CHECK (status IN ('ACTIVE', 'USED', 'CANCELLED', 'REFUNDED')),
    CONSTRAINT chk_tickets_unit_price   CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking_id    ON booking_domain.tickets (booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_tier   ON booking_domain.tickets (ticket_tier_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id      ON booking_domain.tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id       ON booking_domain.tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code   ON booking_domain.tickets (ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON booking_domain.tickets (status);

COMMENT ON TABLE  booking_domain.tickets               IS 'Individual tickets within a booking';
COMMENT ON COLUMN booking_domain.tickets.ticket_tier_id IS 'Logical FK to event_domain.ticket_tiers.id';
COMMENT ON COLUMN booking_domain.tickets.event_id      IS 'Denormalized for query performance';
COMMENT ON COLUMN booking_domain.tickets.user_id       IS 'Denormalized ticket owner; logical FK to user_domain.users.id';
COMMENT ON COLUMN booking_domain.tickets.ticket_code   IS 'Unique QR/barcode value for check-in';
COMMENT ON COLUMN booking_domain.tickets.status        IS 'ACTIVE | USED | CANCELLED | REFUNDED';


-- ============================================================
-- 4.  HELPER FUNCTION : auto-update `updated_at`
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply to every table that has an updated_at column
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('user_domain', 'event_domain', 'booking_domain')
          AND tablename   IN ('users', 'events', 'ticket_tiers', 'bookings', 'tickets')
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I.%I;
             CREATE TRIGGER trg_set_updated_at
             BEFORE UPDATE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
            tbl.schemaname, tbl.tablename,
            tbl.schemaname, tbl.tablename
        );
    END LOOP;
END;
$$;

-- ============================================================
-- 5.  OPTIMISTIC LOCKING USAGE NOTES (inline documentation)
-- ============================================================
-- When decrementing inventory (e.g. reserve tickets):
--
--   UPDATE event_domain.inventory
--   SET    reserved_qty = reserved_qty + :qty,
--          version      = version + 1,
--          updated_at   = NOW()
--   WHERE  ticket_tier_id = :tier_id
--     AND  version        = :expected_version          -- OL check
--     AND  (total_qty - reserved_qty - sold_qty) >= :qty;
--
--   If rowcount = 0  → raise OptimisticLockException (retry or surface conflict)
--   If rowcount = 1  → success, proceed to create booking
-- ============================================================
