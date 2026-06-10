# TikEnt - Hệ thống Đặt vé Sự kiện Trực tuyến 🎫

Chào mừng bạn đến với hệ thống đặt vé sự kiện **TikEnt**. Đây là hệ thống được thiết kế theo kiến trúc Microservices, cho phép người dùng xem thông tin sự kiện, chọn hạng vé và thanh toán trực tuyến qua cổng VNPAY.

Dưới đây là kịch bản hướng dẫn chi tiết từng bước để bạn có thể trải nghiệm toàn bộ luồng mua vé.

---

## 🚀 Link Truy Cập
- **Website Frontend:** [https://tikent.vercel.app/](https://tikent.vercel.app/)

---

## 📝 Kịch Bản Trải Nghiệm (Test Flow)

### Bước 1: Khởi động hệ thống (Nếu cần)
Do hệ thống backend được host miễn phí trên Render, các dịch vụ có thể bị "ngủ" sau 15 phút không hoạt động. Nếu lần đầu truy cập bạn thấy web tải chậm, hãy đợi khoảng **1 phút** để các dịch vụ khởi động lại. (Hoặc bạn có thể bấm nút "Wakeup Services" trên GitHub Actions).

### Bước 2: Đăng ký / Đăng nhập
1. Truy cập vào website theo link ở trên.
2. Nhấn nút **Đăng nhập** ở góc trên cùng bên phải.
3. Bạn có thể sử dụng tài khoản có sẵn:
   - **Email:** `nkhang.customer@ueh.edu.vn`
   - **Mật khẩu:** `123456`
4. *(Tùy chọn)* Bạn hoàn toàn có thể tự tạo một tài khoản mới bằng cách nhấn **Đăng ký** để thử luồng đăng ký user.

### Bước 3: Khám phá sự kiện
1. Tại trang chủ, bạn sẽ thấy danh sách các sự kiện đang mở bán vé (ví dụ: *Live Concert Anh Trai Say Hi*, *Chung Kết Đấu Trường Danh Vọng*...).
2. Nhấp vào nút **Mua Vé** ở một sự kiện bất kỳ để xem chi tiết.
3. Tại trang Chi tiết Sự kiện, hệ thống sẽ hiển thị các hạng vé, giá vé, và **số lượng vé còn lại** theo thời gian thực.
4. Những hạng vé nào hết vé sẽ hiển thị chữ **SOLDOUT** và bị mờ đi.

### Bước 4: Đặt vé
1. Chọn một hạng vé bạn muốn mua (ví dụ: *V.I.P Fanzone* hoặc *Standard*).
2. Nhấn **Đặt Vé Ngay**.
3. Điền thông tin cá nhân của người tham gia (Họ Tên, Số điện thoại, Email) và nhấn **Xác nhận đặt vé**.

### Bước 5: Thanh toán qua cổng VNPAY Sandbox
1. Hệ thống sẽ chuyển hướng bạn sang trang thanh toán giả lập của **VNPAY**.
2. Vui lòng sử dụng thông tin thẻ Test dưới đây để thanh toán (Đừng dùng thẻ thật nhé!):
   - **Ngân hàng:** `NCB`
   - **Số thẻ:** `9704198526191432198`
   - **Tên chủ thẻ:** `NGUYEN VAN A`
   - **Ngày phát hành:** `07/15`
   - **Mật khẩu OTP:** `123456`
3. Nhấn **Xác thực** để hoàn tất thanh toán.

### Bước 6: Nhận kết quả và Xem vé
1. Ngay sau khi thanh toán thành công, VNPAY sẽ trả bạn về trang kết quả với biểu tượng **Tích Xanh (Thành công)**. Đồng thời, hệ thống Backend đã âm thầm nhận IPN từ VNPAY và cập nhật trạng thái đơn hàng.
2. Nhấn vào nút **Xem Vé Của Tôi** (My Tickets).
3. Tại đây, bạn sẽ thấy đơn hàng của mình đang ở trạng thái `CONFIRMED`.
4. Nếu có lỗi mạng hoặc người dùng cố tình tắt trình duyệt giữa chừng, trạng thái sẽ là `PENDING` và nếu không thanh toán nó sẽ tự động bị hủy (`CANCELLED`).

---
Chúc bạn có những trải nghiệm tuyệt vời với **TikEnt**! 🚀
