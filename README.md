# Phoenix Summer Cup V15.1 Robust

Sửa dứt điểm phần lịch thi đấu và bảng xếp hạng công khai.

- Trang chủ tự lấy dữ liệu từ:
  - team_names
  - match_results
  - match_schedule
- Không còn phụ thuộc vào RPC get_public_leaderboard.
- Lịch luôn hiện đủ 4 trận.
- BXH luôn hiện đủ 12 đội nếu team_names có dữ liệu.
- Không cần chạy SQL.

## Cập nhật

Upload ghi đè toàn bộ file, hoặc tối thiểu thay:
- scoreboard.js
- styles.css

Sau đó mở link với `?v=151`.
