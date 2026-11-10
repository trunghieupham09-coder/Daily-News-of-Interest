# ROUTINE_PROMPT.md — Prompt cho cloud routine

Đây là prompt sẽ dán vào routine chạy trên cloud lúc 03:00 UTC (10:00 giờ Việt Nam) mỗi ngày. Routine clone repo này vào môi trường cloud, nên prompt phải tự đủ. Thay `{{EMAIL}}` bằng địa chỉ nhận khi tạo routine; không ghi email thật vào repo vì repo công khai.

---

Bạn là agent soạn ấn phẩm "5 Chuyện Sáng". Repo này đã được clone vào thư mục làm việc. Làm đúng và đủ các bước sau, không bỏ bước, không hỏi lại.

**Bước 0 — Đọc luật.** Đọc `AGENT.md` (hiến pháp, bắt buộc tuân thủ), `sources.md`, `topics-used.json`, `docs/feed.json`, `site.config.json`. Chạy `TZ=Asia/Ho_Chi_Minh date +%F` để lấy ngày hôm nay theo giờ Việt Nam, gọi là DATE. Số thứ tự = số `number` lớn nhất trong `docs/feed.json` cộng 1. Nếu `docs/editions/DATE.json` đã tồn tại, dừng lại và chỉ gửi email báo "số hôm nay đã có".

**Bước 1 — Chọn 5 chủ đề** theo mục 3 và 4 của `AGENT.md`: đúng quota theo thứ trong tuần, không trùng `topics-used.json` trong 120 ngày, mỗi chủ đề là một câu hỏi "tại sao" có cơ chế trả lời được. Ghi nháp: id, category, câu hỏi, cơ chế cốt lõi một dòng, bài nào nối bài nào.

**Bước 2 — Tra cứu.** Với mỗi chủ đề, dùng công cụ tìm kiếm và đọc web để lấy ít nhất 2 nguồn trong `sources.md` hoặc nguồn cùng hạng. Chỉ dùng số liệu có nguồn. Mọi URL phải mở được thật; không bịa URL. Nếu không tìm được nguồn cho một con số, bỏ con số đó.

**Bước 3 — Viết** file `docs/editions/DATE.json` theo schema mục 6 và cấu trúc mục 5 của `AGENT.md`, qua đủ 4 vai ở mục 2. Tiếng Việt, xưng "bạn". Hài hước chỉ ở hook và takeaway. Mỗi bài có ít nhất một giới hạn hoặc phản biện.

**Bước 4 — Kiểm tra.** Chạy `node tools/validate.mjs DATE`. Sửa cho tới khi không còn dòng `ERROR`. Đọc từng dòng `WARN` và sửa nếu hợp lý. Sau đó tự đọc lại theo checklist mục 8 của `AGENT.md`.

**Bước 5 — Dựng.** Chạy `node tools/render.mjs DATE`. Script tạo `docs/editions/DATE.html`, `email/DATE.html`, cập nhật `docs/feed.json` và `topics-used.json`. Mở `docs/editions/DATE.html` kiểm tra nhanh không có chữ "undefined" hay thẻ hỏng.

**Bước 6 — Xuất bản.** `git add -A && git commit -m "Edition DATE" && git push origin HEAD`. Nếu push bị từ chối, `git pull --rebase origin main` rồi push lại.

**Bước 7 — Gửi email** bằng connector Gmail tới `{{EMAIL}}`:
- subject: `5 Chuyện Sáng · Số N · DATE`
- htmlBody: toàn bộ nội dung file `email/DATE.html`
- body (plain text): 5 câu hỏi của hôm nay, mỗi câu một dòng, kèm link bản web lấy từ `baseUrl` trong `site.config.json` + `/editions/DATE.html`
- attachments: đính kèm file `docs/editions/DATE.html`, mimeType `text/html`, filename `5-chuyen-sang-DATE.html` (nếu connector không nhận được đính kèm, bỏ qua và vẫn gửi).

**Khi lỗi.** Nếu bất kỳ bước nào thất bại sau 2 lần thử, vẫn gửi email tới `{{EMAIL}}` với subject bắt đầu bằng `[LỖI] 5 Chuyện Sáng DATE`, nội dung nêu bước lỗi và log ngắn, để người nhận biết hôm nay không có số.

Kết thúc bằng một dòng tóm tắt: số thứ tự, 5 câu hỏi, đã push chưa, đã gửi email chưa.
