# Phoenix Summer Cup V4

## Tính năng chính

- Mở website là hiện quy định giải đấu toàn màn hình.
- Phải tick cam kết mới bấm được “Tiếp tục đăng ký”.
- Sau đó mới hiện trang đăng ký.
- Đồng hồ đếm ngược từng giây.
- Đăng ký xong có hiệu ứng random và hiện đội ngay.
- Mỗi đội tối đa 4 thành viên.
- Admin đổi tên đội, xóa thành viên, copy danh sách và xuất CSV.
- Tự khóa đăng ký lúc 23:59 ngày 02/08/2026.
- Đã bỏ các dòng nhỏ “THAM GIA NGAY”, “NGƯỜI THAM GIA”, “ĐỘI THI ĐẤU”.

## Cập nhật GitHub

Upload và ghi đè:

- index.html
- admin.html
- app.js
- admin.js
- styles.css
- config.js
- assets/logo.png

Bấm Commit changes. Vercel sẽ tự deploy lại và giữ nguyên link cũ.

## Supabase

Nếu V3 đã chạy ổn thì không cần chạy SQL lại.

Nếu vẫn còn lỗi database, chạy file `repair_v3.sql` một lần trong Supabase SQL Editor.
