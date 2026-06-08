-- ============================================================
-- Seed Data for TickEnt Events
-- Run this script to populate the database with initial events
-- ============================================================

DO $$ 
DECLARE
    v_org_id UUID;
    v_event_id UUID;
    v_tier_id UUID;
BEGIN
    -- 1. Get or Create a Seed Organizer (to satisfy logical FK)
    SELECT id INTO v_org_id FROM user_domain.users WHERE email = 'seed_organizer@tickent.local';
    IF v_org_id IS NULL THEN
        v_org_id := gen_random_uuid();
        INSERT INTO user_domain.users (id, email, password_hash, full_name, phone, role)
        VALUES (
            v_org_id, 
            'seed_organizer@tickent.local', 
            'seed_hash', 
            'TickEnt Seed Organizer', 
            '0123456789', 
            'ORGANIZER'
        );
    END IF;

    -- ============================================================
    -- 1. Ca nhạc: Liveshow Anh Trai Tài Năng 2026
    -- ============================================================
    v_event_id := gen_random_uuid();
    INSERT INTO event_domain.events (
        id, organizer_id, title, description, category, venue_name, city, 
        start_time, end_time, banner_url, status
    ) VALUES (
        v_event_id, 
        v_org_id, 
        'Liveshow Anh Trai Tài Năng 2026', 
        'Đêm nhạc hội tụ các ngôi sao hàng đầu, sân khấu hoành tráng và những màn trình diễn bùng nổ.', 
        'Music', 
        'Sân vận động Quân khu 7', 
        'TP.HCM', 
        '2026-07-15 19:30:00+07', 
        '2026-07-15 23:00:00+07', 
        'https://images.unsplash.com/photo-1540039155732-68c3cb0f1522?auto=format&fit=crop&q=80&w=1000', 
        'PUBLISHED'
    );

    -- Hạng vé: VIP (2.500.000 VNĐ, 500 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'VIP', 2500000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 500);

    -- Hạng vé: GA (1.000.000 VNĐ, 2000 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'GA', 1000000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 2000);


    -- ============================================================
    -- 2. Thể thao: Siêu kinh điển V-League 1: HAGL vs CAHN
    -- ============================================================
    v_event_id := gen_random_uuid();
    INSERT INTO event_domain.events (
        id, organizer_id, title, description, category, venue_name, city, 
        start_time, end_time, banner_url, status
    ) VALUES (
        v_event_id, 
        v_org_id, 
        'Siêu kinh điển V-League 1: HAGL vs CAHN', 
        'Trận cầu tâm điểm vòng 15 V-League 1 quyết định ngôi vương.', 
        'Sports', 
        'Sân vận động Pleiku', 
        'Gia Lai', 
        '2026-07-20 17:00:00+07', 
        '2026-07-20 19:30:00+07', 
        'https://images.unsplash.com/photo-1508344928928-7137b29de218?auto=format&fit=crop&q=80&w=1000', 
        'PUBLISHED'
    );

    -- Hạng vé: Khán đài A (500.000 VNĐ, 1000 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Khán đài A', 500000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 1000);

    -- Hạng vé: Khán đài B,C,D (200.000 VNĐ, 5000 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Khán đài B,C,D', 200000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 5000);


    -- ============================================================
    -- 3. Giáo dục: Workshop Định Vị Bản Thân - Kiến Tạo Tương Lai
    -- ============================================================
    v_event_id := gen_random_uuid();
    INSERT INTO event_domain.events (
        id, organizer_id, title, description, category, venue_name, city, 
        start_time, end_time, banner_url, status
    ) VALUES (
        v_event_id, 
        v_org_id, 
        'Workshop Định Vị Bản Thân - Kiến Tạo Tương Lai', 
        'Lắng nghe chia sẻ từ các chuyên gia nhân sự hàng đầu, giúp bạn tìm ra định hướng nghề nghiệp đúng đắn.', 
        'Education', 
        'Hội trường A, Đại học Kinh tế TP.HCM (UEH)', 
        'TP.HCM', 
        '2026-08-05 08:30:00+07', 
        '2026-08-05 11:30:00+07', 
        'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&q=80&w=1000', 
        'PUBLISHED'
    );

    -- Hạng vé: Sinh viên (50.000 VNĐ, 300 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Sinh viên', 50000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 300);

    -- Hạng vé: Khách mời (150.000 VNĐ, 100 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Khách mời', 150000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 100);


    -- ============================================================
    -- 4. Giải trí: Fan Meeting Anh Doo Mee Cee
    -- ============================================================
    v_event_id := gen_random_uuid();
    INSERT INTO event_domain.events (
        id, organizer_id, title, description, category, venue_name, city, 
        start_time, end_time, banner_url, status
    ) VALUES (
        v_event_id, 
        v_org_id, 
        'Fan Meeting Anh Doo Mee Cee', 
        'Giao lưu, ký tặng và chơi game tương tác cùng idol Doo Mee Cee.', 
        'Entertainment', 
        'Nhà thi đấu Nguyễn Du', 
        'TP.HCM', 
        '2026-08-15 14:00:00+07', 
        '2026-08-15 18:00:00+07', 
        'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=1000', 
        'PUBLISHED'
    );

    -- Hạng vé: VVIP (Gặp riêng - 3.000.000 VNĐ, 50 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, description, price) 
    VALUES (v_tier_id, v_event_id, 'VVIP', 'Gặp riêng', 3000000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 50);

    -- Hạng vé: Standard (800.000 VNĐ, 1000 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Standard', 800000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 1000);


    -- ============================================================
    -- 5. E-sport: Chung kết Liên Quân: T1 vs Saigon Phantom
    -- ============================================================
    v_event_id := gen_random_uuid();
    INSERT INTO event_domain.events (
        id, organizer_id, title, description, category, venue_name, city, 
        start_time, end_time, banner_url, status
    ) VALUES (
        v_event_id, 
        v_org_id, 
        'Chung kết Liên Quân: T1 vs Saigon Phantom', 
        'Trận đấu lịch sử định đoạt chức vô địch thế giới bộ môn Arena of Valor.', 
        'Esports', 
        'Trung tâm Hội nghị Quốc gia', 
        'Hà Nội', 
        '2026-08-25 16:00:00+07', 
        '2026-08-25 22:00:00+07', 
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1000', 
        'PUBLISHED'
    );

    -- Hạng vé: Tuyển thủ (Vé theo dõi cận cảnh - 1.500.000 VNĐ, 200 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, description, price) 
    VALUES (v_tier_id, v_event_id, 'Tuyển thủ', 'Vé theo dõi cận cảnh', 1500000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 200);

    -- Hạng vé: Fan Zone (500.000 VNĐ, 1500 vé)
    v_tier_id := gen_random_uuid();
    INSERT INTO event_domain.ticket_tiers (id, event_id, name, price) 
    VALUES (v_tier_id, v_event_id, 'Fan Zone', 500000);
    INSERT INTO event_domain.inventory (ticket_tier_id, total_qty) 
    VALUES (v_tier_id, 1500);

    RAISE NOTICE 'Seed data for events inserted successfully.';
END $$;
