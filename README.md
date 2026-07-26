# Phoenix Summer Cup V11 — Team Logos

## Tính năng mới

- Admin chọn ảnh từ điện thoại hoặc máy tính.
- Upload logo riêng cho từng đội.
- Logo hiện cạnh tên đội ở:
  - Danh sách công khai
  - Thẻ đăng ký thành công
  - Trang Admin
- Cho phép thay hoặc xóa logo.
- Ảnh PNG/JPG/WEBP, tối đa 2 MB.

## GitHub

Upload và ghi đè toàn bộ file trong V11.

## Supabase bắt buộc

1. Vào Supabase → SQL Editor.
2. Mở file `repair_v11.sql`.
3. Copy toàn bộ và bấm Run.
4. Chờ hiện Success.

File SQL sẽ tự:
- Thêm cột logo_url.
- Tạo Storage bucket `team-logos`.
- Tạo quyền upload chỉ dành cho Admin.
