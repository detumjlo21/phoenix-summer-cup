# Phoenix Summer Cup V12 Final

## Tính năng

- Tối đa 48 người, 12 đội.
- Admin đóng/mở đăng ký bất cứ lúc nào.
- Admin nhập thông báo Ban tổ chức.
- Lịch 4 trận chỉ gồm:
  - Map
  - Ngày
  - Giờ
- Không có ID phòng hoặc mật khẩu.
- Admin chỉ nhập Top và Kill.
- Hệ thống tự tính điểm:
  - Top 1: 20
  - Top 2: 17
  - Top 3: 15
  - Top 4: 13
  - Top 5: 12
  - Top 6: 10
  - Top 7: 8
  - Top 8: 6
  - Top 9: 4
  - Top 10: 2
  - Top 11: 1
  - Top 12: 0
  - 1 Kill = 2 điểm
- BXH tự cộng tổng 4 trận.
- Có logo đội.
- Tăng hạng: mũi tên xanh.
- Tụt hạng: mũi tên đỏ.
- Giữ hạng: dấu gạch ngang.

## Cập nhật

1. Upload và ghi đè toàn bộ file trong V12 lên GitHub.
2. Vào Supabase → SQL Editor.
3. Chạy file `repair_v12.sql`.
4. Chờ hiện `Success`.
5. Tải lại trang Admin.
