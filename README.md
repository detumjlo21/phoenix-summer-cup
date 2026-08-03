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
