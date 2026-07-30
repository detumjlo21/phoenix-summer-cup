PHOENIX SUMMER CUP V35 - SỬA ĐỘI TRƯỞNG

Thay 4 file trên GitHub bằng các file trong thư mục này:
- admin.js
- app.js
- team-details.js
- styles.css

Đã sửa:
1. Không còn lỗi Supabase do có 2 relationship giữa players và team_names.
2. Nút Chọn đội trưởng/Bỏ đội trưởng hoạt động trong trang Admin.
3. Chọn xong tải lại và hiện huy hiệu đội trưởng ngay.
4. Trang chính và hồ sơ đội hiển thị đội trưởng.
5. Chuyển người dùng RPC admin_move_player_safe.
6. Xóa người dùng RPC admin_delete_player_safe.

Yêu cầu: đã chạy SQL V34 tạo captain_player_id và các RPC an toàn.
Sau khi upload, chờ Vercel deploy rồi nhấn Ctrl+F5 để xóa cache.
