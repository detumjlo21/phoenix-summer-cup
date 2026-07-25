# Phoenix Summer Cup V3

## Cập nhật mới

- Đồng hồ đếm ngược chạy từng giây.
- Hiệu ứng random đội khoảng 2 giây.
- Thanh tiến trình số người đăng ký.
- Dashboard Admin.
- Admin đổi tên đội.
- Sửa lỗi view `public_players`.
- Sửa foreign key giữa `players` và `team_names`.
- Giữ nguyên link Vercel cũ.

## Bước 1: Sửa Supabase

1. Supabase → SQL Editor → New query.
2. Mở file `repair_v3.sql`.
3. Copy toàn bộ, dán vào và bấm Run.
4. Chờ dòng `Success`.

## Bước 2: Cập nhật GitHub

Upload và ghi đè:

- index.html
- admin.html
- app.js
- admin.js
- styles.css
- config.js
- assets/logo.png

Bấm Commit changes. Vercel sẽ tự triển khai lại.

## Bước 3: Kiểm tra

- Mở trang chủ bằng tab ẩn danh.
- Đồng hồ phải đổi từng giây.
- Đăng ký thử phải có hiệu ứng random.
- Mở `admin.html` để thử đổi tên đội.
