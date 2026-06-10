-- ========================================================
-- TIKENT SYSTEM - SEED DATA SCRIPT
-- ========================================================

-- 1. CLEANUP EXISTING DATA (Follow dependency order)
DELETE FROM booking_domain.tickets;
DELETE FROM booking_domain.bookings;
DELETE FROM event_domain.inventory;
DELETE FROM event_domain.ticket_tiers;
DELETE FROM event_domain.events;
DELETE FROM user_domain.users WHERE role IN ('ORGANIZER', 'CUSTOMER');

-- ========================================================

-- 2. INSERT SEED USERS
INSERT INTO user_domain.users (id, email, password_hash, full_name, phone, role, is_active, email_verified) VALUES 
('319ea38c-bdf1-4671-abdd-0e9582e81940', 'organizer@tikent.vn', '$2b$10$r8K6G/4V9U3M7eX8zW1O2uVbC1A5mK6n7o8p9q1r2s3t4u5v6w7x8', 'Công ty Giải trí & Sự kiện TikEnt Organizer', '0901234567', 'ORGANIZER', TRUE, TRUE),
('1e515120-a386-41c8-b97f-519773cb7ad1', 'nkhang.customer@ueh.edu.vn', '$2b$10$r8K6G/4V9U3M7eX8zW1O2uVbC1A5mK6n7o8p9q1r2s3t4u5v6w7x8', 'Nguyen Nhat Khang', '0907654321', 'CUSTOMER', TRUE, TRUE);

-- 3. INSERT SEED EVENTS, TIER TIERS AND INVENTORIES
-- Event: Live Concert Anh Trai Say Hi 2026
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('f0d79cbe-e532-4d04-b22f-a0846578d4d0', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Live Concert Anh Trai Say Hi 2026', 'Đêm nhạc quy tụ những ngôi sao hàng đầu Việt Nam bước ra từ chương trình thực tế âm nhạc hot nhất năm. Sân khấu hoành tráng, âm thanh chuẩn quốc tế cùng những màn trình diễn bùng nổ.', 'Music', 'Sân vận động Quân khu 7', '202 Hoàng Văn Thụ, Phường 9, Phú Nhuận', 'TP.HCM', '2026-07-25 12:00:00+07', '2026-07-25 16:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_anhtraisayhi.jpg', 'PUBLISHED');
  -- Tier: V.I.P Fanzone
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('2f888b48-cbd5-4aa9-986f-735c1d5f57e7', 'f0d79cbe-e532-4d04-b22f-a0846578d4d0', 'V.I.P Fanzone', 3500000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('34349c0e-b950-4e4a-952f-9c5c69472b75', '2f888b48-cbd5-4aa9-986f-735c1d5f57e7', 500, 0, 500, 0);
  -- Tier: Standard Khán Đài A
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('acddba1a-495f-4ec7-8d39-1d37a7a70ce9', 'f0d79cbe-e532-4d04-b22f-a0846578d4d0', 'Standard Khán Đài A', 1800000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('4524e94c-728a-4156-a117-1a9f8e354625', 'acddba1a-495f-4ec7-8d39-1d37a7a70ce9', 1500, 0, 1200, 0);
  -- Tier: GA Sân Cỏ
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('8d2f6d34-c5df-47f2-8600-e07dd4910ff3', 'f0d79cbe-e532-4d04-b22f-a0846578d4d0', 'GA Sân Cỏ', 900000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('211af742-2eab-4db7-a808-6aff5ef11408', '8d2f6d34-c5df-47f2-8600-e07dd4910ff3', 3000, 0, 2800, 0);

-- Event: Chung Kết Đấu Trường Danh Vọng Mùa Đông 2026
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('5184bef4-8fd3-4767-a541-da549ee4b800', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Chung Kết Đấu Trường Danh Vọng Mùa Đông 2026', 'Trận chiến tối cao tìm ra nhà vua mới của Liên Quân Mobile Việt Nam. Cơ hội chứng kiến những pha cấm chọn đỉnh cao, chiến thuật nghẹt thở và bầu không khí eSports cuồng nhiệt tại khán đài.', 'Esports', 'Nhà thi đấu Phú Thọ', '1 Lữ Gia, Phường 15, Quận 11', 'TP.HCM', '2026-08-09 12:00:00+07', '2026-08-09 18:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_dtdv_chungket.jpg', 'PUBLISHED');
  -- Tier: Vé VIP (Tặng Giftcode Giới Hạn)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('6c4fb95c-a3c1-4a71-889a-65933662a00f', '5184bef4-8fd3-4767-a541-da549ee4b800', 'Vé VIP (Tặng Giftcode Giới Hạn)', 500000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('e0473e85-0ed4-46f4-914e-f89883cb2004', '6c4fb95c-a3c1-4a71-889a-65933662a00f', 200, 0, 200, 0);
  -- Tier: Vé Standard Khán Đài
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('e862074f-ed96-42c7-8322-1daeda481c8f', '5184bef4-8fd3-4767-a541-da549ee4b800', 'Vé Standard Khán Đài', 200000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('e53820dc-2b52-4e41-82aa-39f9c5a16410', 'e862074f-ed96-42c7-8322-1daeda481c8f', 2000, 0, 1450, 0);

-- Event: Đêm Nhạc Acoustic: Phố Cũ Đèn Mờ
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('b2bd7736-136f-427a-b8e0-3733fe79eae0', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Đêm Nhạc Acoustic: Phố Cũ Đèn Mờ', 'Không gian âm nhạc mộc mạc, ấm cúng hòa quyện tiếng đàn Guitar và Piano classic. Đêm nhạc gợi lại những bản tình ca cũ lãng mạn, mang đến những phút giây lắng đọng tâm hồn sau chuỗi ngày bận rộn.', 'Music', 'StayCafé Space', '152 Nguyễn Đình Chiểu, Võ Thị Sáu, Quận 3', 'TP.HCM', '2026-06-25 12:00:00+07', '2026-06-25 15:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_acoustic_phocu.jpg', 'PUBLISHED');
  -- Tier: Vé Đơn (Kèm 1 Nước)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('2d889f38-add7-4444-a664-80b3e39b593d', 'b2bd7736-136f-427a-b8e0-3733fe79eae0', 'Vé Đơn (Kèm 1 Nước)', 150000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('58d28ffb-a670-443f-b4ee-5e78f8498f49', '2d889f38-add7-4444-a664-80b3e39b593d', 60, 0, 60, 0);
  -- Tier: Vé Đôi (Kèm 2 Nước & Quà lưu niệm)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('b157f332-50fd-44df-b038-127f8fec6e34', 'b2bd7736-136f-427a-b8e0-3733fe79eae0', 'Vé Đôi (Kèm 2 Nước & Quà lưu niệm)', 280000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('81a619ba-be16-4602-b0c6-6fd198515d09', 'b157f332-50fd-44df-b038-127f8fec6e34', 30, 0, 25, 0);

-- Event: Workshop: Làm Chủ FL Studio & Audio Production
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('742f118a-a87b-4b8c-a85e-629dcf3aa833', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Workshop: Làm Chủ FL Studio & Audio Production', 'Khóa học ngắn hạn chia sẻ chuyên sâu về quy trình sản xuất âm nhạc trên DAW FL Studio. Hướng dẫn thiết lập VST, Addictive Drums 2, hòa âm phối khí cơ bản và kỹ thuật mix nhạc thực tế.', 'Education', 'Hội trường A - Đại học Kinh tế TP.HCM (UEH)', '59C Nguyễn Tri Phương, Phường 5, Quận 10', 'TP.HCM', '2026-07-02 12:00:00+07', '2026-07-02 17:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_workshop_flstudio.jpg', 'PUBLISHED');
  -- Tier: Vé Premium Slot (Giao lưu trực tiếp Kỹ sư âm thanh)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('22443810-195c-40b4-8f3f-a7f419501a89', '742f118a-a87b-4b8c-a85e-629dcf3aa833', 'Vé Premium Slot (Giao lưu trực tiếp Kỹ sư âm thanh)', 450000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('b690ea96-5f43-4be1-8488-5bf5fa1e758c', '22443810-195c-40b4-8f3f-a7f419501a89', 40, 0, 40, 0);
  -- Tier: Vé Standard Sinh Viên UEH
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('9ca4716a-272c-474c-93a1-47472f2a5263', '742f118a-a87b-4b8c-a85e-629dcf3aa833', 'Vé Standard Sinh Viên UEH', 150000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('933d994b-33a3-4682-9af1-f01c2692954b', '9ca4716a-272c-474c-93a1-47472f2a5263', 150, 0, 95, 0);

-- Event: Live Concert Vũ: Bảo Tàng Của Những Nuối Tiếc
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('9edd7b3f-ec9f-479a-b65a-8ddc93d1a33a', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Live Concert Vũ: Bảo Tàng Của Những Nuối Tiếc', 'Hoàng tử Indie Việt Nam trở lại với chuỗi concert quảng bá album mới. Những giai điệu Pop Ballad da diết kết hợp cùng ban nhạc sống sẽ dẫn lối khán giả vào không gian ký ức đầy cảm xúc.', 'Music', 'Nhà thi đấu Nguyễn Du', '116 Nguyễn Du, Bến Thành, Quận 1', 'TP.HCM', '2026-08-24 12:00:00+07', '2026-08-24 15:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_vu_concert.jpg', 'PUBLISHED');
  -- Tier: Hạng SVIP (Gồm Merchandise độc quyền)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('2fbba8d7-1871-40dd-9219-a12b2716b84d', '9edd7b3f-ec9f-479a-b65a-8ddc93d1a33a', 'Hạng SVIP (Gồm Merchandise độc quyền)', 2500000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('795b8dd6-09e4-4a92-b5f6-8c1de1677153', '2fbba8d7-1871-40dd-9219-a12b2716b84d', 300, 0, 300, 0);
  -- Tier: Hạng VIP
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('bd097f1f-e95d-4c0c-9a85-2fa025e0437c', '9edd7b3f-ec9f-479a-b65a-8ddc93d1a33a', 'Hạng VIP', 1600000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('cb79453e-0486-4078-bfee-af4d13320cd2', 'bd097f1f-e95d-4c0c-9a85-2fa025e0437c', 800, 0, 800, 0);
  -- Tier: Hạng GA
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('31234a59-c5b2-4b24-ae72-e6c6891d6843', '9edd7b3f-ec9f-479a-b65a-8ddc93d1a33a', 'Hạng GA', 800000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('4441f011-7962-427b-be13-c259459bf62d', '31234a59-c5b2-4b24-ae72-e6c6891d6843', 1500, 0, 1100, 0);

-- Event: Rap Việt All-Star Concert 2026
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('3677412d-7859-4dc5-8dee-f748a603f224', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Rap Việt All-Star Concert 2026', 'Đại nhạc hội Hip-hop quy mô khủng nhất năm, quy tụ toàn bộ huấn luyện viên, giám khảo và các thí sinh xuất sắc nhất. Sân khấu bùng nổ với hiệu ứng âm thanh, ánh sáng và những bản rap làm mưa làm gió.', 'Music', 'Trung tâm Hội chợ và Triển lãm Sài Gòn (SECC)', '799 Nguyễn Văn Linh, Tân Phú, Quận 7', 'TP.HCM', '2026-09-08 12:00:00+07', '2026-09-08 17:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_rapviet_allstar.jpg', 'PUBLISHED');
  -- Tier: President Zone (Sát sân khấu)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('fc44df58-2b59-4e8d-939a-2c75b6341e90', '3677412d-7859-4dc5-8dee-f748a603f224', 'President Zone (Sát sân khấu)', 4000000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('b539f36b-64e8-4084-8864-57d41db6af73', 'fc44df58-2b59-4e8d-939a-2c75b6341e90', 150, 0, 150, 0);
  -- Tier: VIP Zone
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('4a836ba2-eb85-4cb9-950b-131e5486256e', '3677412d-7859-4dc5-8dee-f748a603f224', 'VIP Zone', 2200000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('c2404c86-6a44-4da9-98a6-001e57e1f4f4', '4a836ba2-eb85-4cb9-950b-131e5486256e', 1000, 0, 920, 0);
  -- Tier: GA Zone
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('0a5c16d4-37fe-4379-a2a6-332a6fcd9f7f', '3677412d-7859-4dc5-8dee-f748a603f224', 'GA Zone', 750000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('39653026-eef3-4f15-96b2-e043859f134e', '0a5c16d4-37fe-4379-a2a6-332a6fcd9f7f', 4000, 0, 3100, 0);

-- Event: Workshop Kỹ Thuật Guitar Solo & Hòa Âm Sơ Cấp
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('af7d2228-4b38-4b09-bbb6-cb319054835a', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Workshop Kỹ Thuật Guitar Solo & Hòa Âm Sơ Cấp', 'Buổi chia sẻ kiến trúc dịch giọng, tư duy chạy ngón và ứng dụng Chromatic Scale trong đệm hát nâng cao. Phù hợp cho các bạn muốn nâng cấp tư duy xử lý nhạc cụ một cách bài bản.', 'Education', 'Phòng Nhạc Cụ - Nhạc Viện TP.HCM', '112 Nguyễn Du, Phường Bến Thành, Quận 1', 'TP.HCM', '2026-06-22 12:00:00+07', '2026-06-22 15:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_workshop_guitar.jpg', 'PUBLISHED');
  -- Tier: Vé Tham Gia Trực Tiếp
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('c86060d6-b7ec-4bd4-bd9d-d21a7ddcac51', 'af7d2228-4b38-4b09-bbb6-cb319054835a', 'Vé Tham Gia Trực Tiếp', 200000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('dbb151e9-727e-4e15-b975-8419670c51a2', 'c86060d6-b7ec-4bd4-bd9d-d21a7ddcac51', 50, 0, 50, 0);

-- Event: Giải Đấu Liên Quân Mobile Sinh Viên Toàn Quốc - UEH Esport
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('ad937533-c0ef-431d-a5f1-5a45f341355f', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Giải Đấu Liên Quân Mobile Sinh Viên Toàn Quốc - UEH Esport', 'Giải đấu thường niên dành cho cộng đồng sinh viên đam mê eSports toàn quốc. Nơi tranh tài của các chiến đội sinh viên xuất sắc nhất nhằm tìm ra đại diện tham gia hệ thống giải đấu chuyên nghiệp.', 'Esports', 'Hội trường B1 - UEH Cơ sở B', '279 Nguyễn Tri Phương, Phường 5, Quận 10', 'TP.HCM', '2026-07-10 12:00:00+07', '2026-07-10 20:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_ueh_esport_lq.jpg', 'PUBLISHED');
  -- Tier: Vé Đăng Ký Đội Tuyển (5 Người)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('621e8fc9-ef59-4320-ad43-04f07e2fcd19', 'ad937533-c0ef-431d-a5f1-5a45f341355f', 'Vé Đăng Ký Đội Tuyển (5 Người)', 250000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('0875acef-56b2-4fc2-9187-750ef02aae95', '621e8fc9-ef59-4320-ad43-04f07e2fcd19', 32, 0, 32, 0);
  -- Tier: Vé Khán Giả Tự Do
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('82df33e4-5578-4074-a082-d6ce63221615', 'ad937533-c0ef-431d-a5f1-5a45f341355f', 'Vé Khán Giả Tự Do', 0.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('76d3b804-f496-4d6d-8be3-d81f008ab677', '82df33e4-5578-4074-a082-d6ce63221615', 300, 0, 210, 0);

-- Event: Indie Music Festival: Chút Tình Đầu
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('56b69d5c-4bd9-4a99-a982-466646907c0b', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Indie Music Festival: Chút Tình Đầu', 'Lễ hội âm nhạc tôn vinh các nghệ sĩ Indie/Underground Việt Nam. Không gian mở phóng khoáng, âm nhạc tự do, gần gũi, kết nối những trái tim yêu âm nhạc nguyên bản.', 'Music', 'Sân 4A - Nhà Văn Hóa Thanh Niên', '4 Phạm Ngọc Thạch, Bến Nghé, Quận 1', 'TP.HCM', '2026-07-30 12:00:00+07', '2026-07-30 18:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_indie_chuttinhdau.jpg', 'PUBLISHED');
  -- Tier: Vé Early Bird (Giờ Vàng Giá Rẻ)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('eaace950-9f72-4194-a3f0-975db0374361', '56b69d5c-4bd9-4a99-a982-466646907c0b', 'Vé Early Bird (Giờ Vàng Giá Rẻ)', 300000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('001efa9b-52e8-498c-8f49-90e0112c41cd', 'eaace950-9f72-4194-a3f0-975db0374361', 400, 0, 400, 0);
  -- Tier: Vé General Admission (GA)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('7e7e3096-e414-49e3-9722-10d33cb79527', '56b69d5c-4bd9-4a99-a982-466646907c0b', 'Vé General Admission (GA)', 450000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('a7f14e82-b272-4df7-802e-e38b3df04325', '7e7e3096-e414-49e3-9722-10d33cb79527', 1000, 0, 670, 0);

-- Event: Mini Show Hoài Niệm: Phím Dương Cầm
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('4e0ab3dc-847f-4e58-af7d-7c4569c2542b', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Mini Show Hoài Niệm: Phím Dương Cầm', 'Đêm nhạc thính phòng ấm cúng tôn vinh nhạc cụ Piano classic. Các tác phẩm bất hủ của Trịnh Công Sơn, Vũ Thành An được làm mới qua tiếng đàn dương cầm điêu luyện cùng giọng ca nội lực.', 'Music', 'Phòng trà Đồng Dao', '164 Pasteur, Bến Nghé, Quận 1', 'TP.HCM', '2026-06-28 12:00:00+07', '2026-06-28 14:00:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_minishow_duongcam.jpg', 'PUBLISHED');
  -- Tier: Ghế Gần Sân Khấu (Kèm Nước)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('f999d988-5bb1-42dc-b18e-a1134d1cff76', '4e0ab3dc-847f-4e58-af7d-7c4569c2542b', 'Ghế Gần Sân Khấu (Kèm Nước)', 600000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('64dafe9b-37bc-47bb-8a5c-90685bac2c68', 'f999d988-5bb1-42dc-b18e-a1134d1cff76', 50, 0, 50, 0);
  -- Tier: Ghế Tiêu Chuẩn (Kèm Nước)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('a037b516-957a-41c6-b810-d3d0598e2eb8', '4e0ab3dc-847f-4e58-af7d-7c4569c2542b', 'Ghế Tiêu Chuẩn (Kèm Nước)', 400000.00, 'VND', 10);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('87b45150-d61f-4ec8-8d94-4041054d1fad', 'a037b516-957a-41c6-b810-d3d0598e2eb8', 100, 0, 78, 0);

  -- Event: Tọa đàm: Khởi nghiệp Công nghệ và Kỷ nguyên AI
INSERT INTO event_domain.events (id, organizer_id, title, description, category, venue_name, venue_address, city, start_time, end_time, banner_url, status) 
VALUES ('c14b7e90-c231-419b-8f3a-a5f1e84d7200', '319ea38c-bdf1-4671-abdd-0e9582e81940', 'Tọa đàm: Khởi nghiệp Công nghệ và Kỷ nguyên AI', 'Buổi tọa đàm chuyên sâu thảo luận về xu hướng khởi nghiệp trong kỷ nguyên trí tuệ nhân tạo, cơ hội nghề nghiệp cho thế hệ kỹ sư mới và phương pháp tối ưu hóa năng suất làm việc bằng các công cụ AI hiện đại.', 'Seminar', 'Hội trường B1.302 - UEH Cơ sở B', '279 Nguyễn Tri Phương, Phường 5, Quận 10', 'TP.HCM', '2026-07-18 13:30:00+07', '2026-07-18 16:30:00+07', 'https://uguvlkarbyrrfccpznua.supabase.co/storage/v1/object/public/event-banners/img_ueh_talkshow_ai.jpg', 'PUBLISHED');

  -- Tier: Vé VIP (Ưu tiên ngồi hàng đầu & Tặng sách)
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('a21c8e75-d8b4-4e20-96f1-c4d3a2f8b100', 'c14b7e90-c231-419b-8f3a-a5f1e84d7200', 'Vé VIP (Ưu tiên ngồi hàng đầu & Tặng sách)', 20000, 'VND', 2);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('f1a23b4c-5d6e-7f8a-9b0c-1d2e3f4a5b60', 'a21c8e75-d8b4-4e20-96f1-c4d3a2f8b100', 50, 0, 49, 0);
  
  -- Tier: Vé Tham Dự Tiêu Chuẩn
  INSERT INTO event_domain.ticket_tiers (id, event_id, name, price, currency, max_per_order) VALUES ('b32d9f86-e9c5-4f31-a702-d5e4b309c200', 'c14b7e90-c231-419b-8f3a-a5f1e84d7200', 'Vé Tham Dự Tiêu Chuẩn', 0.00, 'VND', 5);
  INSERT INTO event_domain.inventory (id, ticket_tier_id, total_qty, reserved_qty, sold_qty, version) VALUES ('e2b34c5d-6e7f-8a9b-0c1d-2e3f4a5b6c70', 'b32d9f86-e9c5-4f31-a702-d5e4b309c200', 250, 0, 250, 0);