# Phoenix Summer Cup 2026 — V2

## Có gì mới?

- Đăng ký xong được random đội ngay.
- Mỗi đội tối đa 4 người.
- Các đội được giữ cân bằng.
- Thành viên thấy tên đội ngay.
- Admin có thể đổi tên từng đội.
- Có mã đăng ký `PSC2026-001`.
- Tự khóa lúc 23:59 ngày 02/08/2026.
- UID và Facebook chỉ Admin xem được.

## Bước 1: Nâng cấp Supabase

1. Mở Supabase → SQL Editor → New query.
2. Mở file `upgrade.sql`.
3. Copy toàn bộ nội dung và bấm Run.
4. Chờ đến khi Supabase báo `Success`.

## Bước 2: Cập nhật GitHub

Trong repository `phoenix-summer-cup`:

1. Upload và ghi đè các file:
   - `index.html`
   - `admin.html`
   - `app.js`
   - `admin.js`
   - `styles.css`
   - `config.js`
2. Upload thư mục `assets` nếu trước đó chưa có logo.
3. Commit changes.

Vercel sẽ tự động deploy lại sau khi GitHub cập nhật.

## Kiểm tra

1. Mở link Vercel.
2. Đăng ký một tài khoản thử.
3. Trang phải hiện ngay đội và mã đăng ký.
4. Mở `admin.html`, đăng nhập rồi thử đổi tên đội.
