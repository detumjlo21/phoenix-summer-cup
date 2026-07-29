# Phoenix V28 — Sao lưu & Tạo mùa giải mới

## Tính năng
- Tải toàn bộ dữ liệu giải thành file JSON.
- Khôi phục từ file JSON.
- Tự lưu backup trong Supabase trước khi restore/reset.
- Tạo mùa giải mới:
  - Reset kết quả, BXH, lịch, MVP và trạng thái công bố.
  - Tùy chọn giữ hoặc xóa đội và thành viên.
  - Luôn giữ Hall of Champions.
- Bắt nhập `TAO MUA MOI` trước khi reset.

## Cập nhật
1. Upload toàn bộ file V28 lên GitHub.
2. Chạy `repair_v28_season_backup.sql` trong Supabase.
3. Mở lại Admin.

Không xóa dữ liệu cũ khi chạy SQL.
