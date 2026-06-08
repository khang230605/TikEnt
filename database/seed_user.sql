-- Yêu cầu extension pgcrypto để có thể băm mật khẩu bằng thuật toán bcrypt ngay trong SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Giả định bảng người dùng của bạn tên là "users". 
-- (Nếu backend của bạn lưu bảng với tên khác như "Accounts" hay "Users" thì hãy sửa lại cho khớp nhé).
INSERT INTO user_domain.users (
    id, 
    email, 
    password_hash, -- Cập nhật theo đúng cột trong schema (password_hash)
    full_name, 
    role, 
    phone, 
    created_at, 
    updated_at
) VALUES (
    gen_random_uuid(), 
    'testman@gmail.com', 
    crypt('TestTestTest123', gen_salt('bf', 10)), -- Băm password bằng bcrypt (Salt round = 10)
    'Khách Hàng Test', 
    'ADMIN', -- Cấp quyền cao nhất (Ví dụ: ADMIN, SUPER_ADMIN)
    '0901234567', 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
);

-- Note: Lệnh crypt() sẽ tự động băm chuỗi 'TestTestTest123' thành chuỗi mã hóa bcrypt (ví dụ: $2a$10$...). 
-- Nếu backend (NodeJS, Java) của bạn dùng thư viện bcrypt để so sánh (bcrypt.compare) thì sẽ đăng nhập được bình thường.
