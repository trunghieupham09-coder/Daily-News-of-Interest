# 5 Chuyện Sáng

Ấn phẩm hàng ngày: năm chuyện đáng biết, tự động soạn lúc 10:00 giờ Việt Nam, xuất bản lên GitHub Pages và gửi qua email. Cơ cấu cố định mỗi số: 2 kinh tế tài chính, 1 tâm lý con người, 1 AI hoặc mẹo hay, 1 xã hội. Mỗi bài có thể là câu hỏi, khái niệm, lý thuyết, fact hoặc mẹo.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `AGENT.md` | Hiến pháp của agent: vai, quota, giọng văn, cấu trúc bài, checklist |
| `sources.md` | Nguồn được phép trích |
| `ROUTINE_PROMPT.md` | Prompt dán vào cloud routine |
| `site.config.json` | Tên ấn phẩm, `baseUrl` của GitHub Pages |
| `topics-used.json` | Sổ chủ đề đã dùng, để chống lặp |
| `docs/` | Thư mục GitHub Pages phục vụ: `index.html` (ngăn xếp các số), `feed.json`, `editions/*.json` (nguồn sự thật) và `editions/*.html` (trang đọc) |
| `email/` | Bản email HTML inline-style của từng số |
| `tools/validate.mjs` | Kiểm tra JSON một số theo luật |
| `tools/render.mjs` | Dựng HTML web + email, cập nhật feed và sổ chủ đề |

## Chạy tay

```bash
node tools/validate.mjs 2026-11-10
node tools/render.mjs 2026-11-10
```

Xem thử tại chỗ: mở `docs/index.html` qua một static server bất kỳ (fetch `feed.json` không chạy từ `file://`).

## Cài lên điện thoại

Mở địa chỉ GitHub Pages trên điện thoại. iPhone: nút Chia sẻ → Thêm vào MH chính. Android: menu Chrome → Cài đặt ứng dụng. Trang chạy như app riêng, đọc được offline các số đã mở.

## Cấu hình GitHub Pages

Settings → Pages → Source: Deploy from a branch → Branch `main`, folder `/docs`. Sau đó điền `baseUrl` vào `site.config.json`.
