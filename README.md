# Phoenix Summer Cup V5

## Thay đổi chính

- Dùng logo Phoenix mới.
- Khi mở web sẽ hiện ảnh “Cách thức tính điểm & Quy định giải đấu”.
- Thành viên phải đọc ảnh, tick cam kết rồi mới được vào form đăng ký.
- Đồng hồ đếm ngược từng giây.
- Đăng ký xong có hiệu ứng random đội.
- Thành viên thấy đội ngay.
- Admin đổi tên đội, xóa thành viên, copy danh sách và xuất CSV.

## Cập nhật GitHub

Upload và ghi đè các file:

- index.html
- admin.html
- app.js
- admin.js
- styles.css
- config.js
- assets/logo.png
- assets/rules-poster.png

Sau đó bấm Commit changes. Vercel sẽ tự deploy lại và giữ nguyên link cũ.

## Supabase

Nếu V3/V4 đang chạy bình thường thì không cần sửa SQL.

Chỉ chạy `repair_v3.sql` nếu website vẫn báo lỗi database.
