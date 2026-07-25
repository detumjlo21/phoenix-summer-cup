# Phoenix Summer Cup 2026 — Lần 2

## 1. Tạo bảng Supabase

1. Mở project Supabase.
2. Chọn **SQL Editor**.
3. Chọn **New query**.
4. Mở file `setup.sql`, copy toàn bộ, dán vào và bấm **Run**.

## 2. Tạo tài khoản Admin

1. Supabase → **Authentication → Users**.
2. Chọn **Add user → Create new user**.
3. Nhập email và mật khẩu của bạn.
4. Copy **User UID** của tài khoản vừa tạo.
5. Vào SQL Editor và chạy:

```sql
insert into public.admins(user_id)
values ('DÁN-USER-UID-VÀO-ĐÂY');
```

Không gửi mật khẩu Admin cho người khác.

## 3. Chạy thử trên VS Code

1. Mở thư mục dự án trong VS Code.
2. Cài extension **Live Server**.
3. Chuột phải `index.html` → **Open with Live Server**.
4. Trang Admin nằm ở `admin.html`.

## 4. Đưa lên Vercel

1. Nén hoặc giữ nguyên thư mục dự án.
2. Vào Vercel Dashboard.
3. Tạo project mới bằng GitHub hoặc dùng trang Deploy/Drop nếu tài khoản có hỗ trợ.
4. Upload toàn bộ thư mục này.
5. Framework Preset chọn **Other**.
6. Không cần Build Command.
7. Output Directory để trống.
8. Deploy và lấy link gửi cho mọi người.

## Lưu ý

- Publishable key được dùng ở trình duyệt; quyền thật sự được giới hạn bằng RLS trong `setup.sql`.
- Không bao giờ đưa `service_role key` vào website.
- Public chỉ xem tên game và kết quả đội.
- UID và Facebook chỉ Admin đã đăng nhập mới xem được.
