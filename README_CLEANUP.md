# PHOENIX V40 — Công cụ dọn repo an toàn

Gói này không xóa thẳng file. Nó chuyển tài liệu, SQL cũ và module không được HTML sử dụng vào `_archive_v40`.

## Cách dùng

1. Giải nén gói này.
2. Copy `cleanup_v40.ps1` và `RUN_CLEANUP.bat` vào thư mục gốc repo Phoenix.
3. Chạy `RUN_CLEANUP.bat`.
4. Chọn **1** để xem trước.
5. Kiểm tra `CLEANUP_REPORT.txt`.
6. Chạy lại và chọn **2** để thực hiện.
7. Mở website thử trước khi commit.

## Công cụ sẽ làm gì?

- Giữ nguyên toàn bộ file đang được HTML tải.
- Giữ `README.md`.
- Chuyển README/HƯỚNG DẪN phiên bản cũ vào `_archive_v40/docs`.
- Chuyển `setup.sql` thành `database/schema.sql`.
- Chuyển `repair_*.sql` và SQL nâng cấp cũ vào `database/archive`.
- Chỉ chuyển module JS/CSS tùy chọn khi không có HTML nào tham chiếu.
- Tạo `CLEANUP_REPORT.txt`.

## Những file không tự động xóa

Các file này đang được trang chủ tải nên vẫn được giữ:

- `mvp.js`
- `mvp-v26.js`
- `mvp-v30.js`
- `app.js`
- `scoreboard.js`
- `champion.js`
- `team-details.js`

Ba file MVP chưa được gộp tự động vì chúng đang ghi đè nhau theo thứ tự tải. Xóa một file lúc này có thể làm thay đổi giao diện MVP.

## Sau khi chạy

Cấu trúc sẽ gọn hơn:

```text
/
├── index.html
├── admin.html
├── results.html
├── champions.html
├── hall-admin.html
├── *.js
├── styles.css
├── assets/
├── database/
│   ├── schema.sql
│   ├── README.md
│   └── archive/
├── _archive_v40/
│   ├── docs/
│   └── unused-modules/
└── README.md
```

Sau khi xác nhận website chạy ổn, bạn có thể xóa `_archive_v40` khỏi repo hoặc giữ nó làm bản sao.
