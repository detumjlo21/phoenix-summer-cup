# Phoenix Summer Cup — V41 Clean

Bản đã dọn gọn từ project hiện tại.

## Điểm chính

- MVP chỉ còn một file `mvp.js`; không còn `mvp-v26.js` và `mvp-v30.js`.
- Khu vực giải thưởng được gọi trực tiếp trong HTML.
- `config.js` chỉ còn cấu hình Supabase, không tự chèn script.
- Các file SQL được gom vào `database/`.
- Tài liệu cũ được gom vào `docs/archive/`.
- Các module không được dùng (`admin-layout.js`, `public-layout.js`, `admin-quick.js`) đã loại khỏi bản production.

## Trang

- `index.html`: trang công khai
- `admin.html`: quản trị
- `results.html`: kết quả từng trận
- `champions.html`: lịch sử vô địch
- `hall-admin.html`: quản trị Hall of Champions

## Triển khai

Upload toàn bộ nội dung thư mục này lên nhánh `main` của GitHub, thay thế project cũ.

## V45 Hall stats fix
Sau khi deploy, chạy `repair_v45_hall_stats.sql` một lần trong Supabase SQL Editor.
Migration này sửa bản Hall hiện tại đang hiện 0 và đảm bảo các mùa sau lưu snapshot Điểm / Hạ gục / Booyah / Kill MVP đúng từ kết quả giải.


## V49 — Chuyển khoản & Admin duyệt đơn
- Thêm QR nhận phí `payment-qr.png` do BTC cung cấp.
- Mỗi người chơi tạo đơn riêng, nhận mã đơn và nội dung chuyển khoản riêng.
- Người chơi nhập mã giao dịch sau khi chuyển khoản.
- Admin cấu hình phí/người và tiền tố nội dung chuyển khoản.
- Admin kiểm tra danh sách đơn, Duyệt/Từ chối.
- Chỉ đơn được duyệt mới được đưa vào bảng `players` và được xếp đội.
- SQL migration: `repair_v50_payment_approval.sql`.

### Cài đặt
1. Chạy `repair_v50_payment_approval.sql` trong Supabase SQL Editor.
2. Đăng nhập Admin → Thanh toán → nhập **phí đăng ký / người** → Lưu.
3. Mở đăng ký.
4. Người chơi tạo đơn → chuyển khoản → nhập mã giao dịch → gửi xác nhận.
5. Admin đối chiếu giao dịch → Duyệt đơn.


V50 HOTFIX: repair_v49_payment_approval.sql không còn gọi REVOKE trên register_player_random_team(text,text,text), vì DB hiện tại chỉ có register_player_random_team(text,text).


## V54 – 2 chế độ giải
- Admin có thể chọn **Giải Sinh tồn** hoặc **Giải Tử chiến**.
- Chạy `repair_v54_tournament_modes.sql` một lần để thêm `tournament_settings.game_mode`.
- Mùa mới có thể chọn chế độ riêng.
- Khi chọn Tử chiến, Admin hiển thị bracket 3 bảng × 4 đội và ẩn các khu vực nhập Top/Booyah của Sinh tồn.


## V55 deployment note
- Public registration uses `create_registration_request` and button `TẠO ĐƠN & THANH TOÁN`.
- Public/admin cache-busting versions bumped to v55.
- Admin contains Survival/Deathmatch mode selector.
- Run the payment and tournament-mode SQL files in the target Supabase project if not already applied.
