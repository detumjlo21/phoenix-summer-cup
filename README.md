# Phoenix Summer Cup V7 Final

## Thời gian đăng ký

- Đóng đăng ký lúc **23:59:59 ngày 30/07/2026**.
- Đồng hồ trên website đếm ngược từng giây.
- Hết giờ, nút đăng ký tự khóa.
- Hàm đăng ký trong Supabase cũng khóa cùng thời điểm.

## Tính năng

- Ảnh cách thức tính điểm và quy định hiển thị trước khi đăng ký.
- Phải cuộn đến cuối ảnh mới được tick xác nhận.
- Đăng ký xong random đội ngay.
- Mỗi đội tối đa 4 người.
- Admin đổi tên đội, xóa thành viên, copy danh sách và xuất CSV.
- Logo Phoenix mới.
- Tối ưu điện thoại và máy tính.

## Cập nhật GitHub

Upload và ghi đè toàn bộ các file trong thư mục dự án.

Quan trọng nhất:

- `index.html`
- `config.js`
- `app.js`
- `styles.css`
- `admin.html`
- `admin.js`
- `rules-poster.png`
- `assets/logo.png`
- `repair_v3.sql`

Sau khi Commit, Vercel tự deploy lại và giữ nguyên link.

## Cập nhật Supabase bắt buộc

Vì ngày đóng đăng ký trong database đã đổi:

1. Mở Supabase.
2. Vào SQL Editor.
3. Mở file `repair_v3.sql`.
4. Copy toàn bộ và bấm Run.
5. Chờ hiện `Success`.

Nếu không chạy lại SQL, giao diện có thể hiện ngày 30/07 nhưng database vẫn dùng ngày cũ.
