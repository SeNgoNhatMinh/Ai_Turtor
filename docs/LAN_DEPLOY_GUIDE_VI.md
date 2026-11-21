# Chạy AI Tutor trên 1 máy, nhiều máy truy cập qua `fptturtor.vn`

Mục tiêu: một máy (gọi là **máy chủ**) chạy toàn bộ hệ thống bằng Docker. Các máy khác cùng mạng mở trình duyệt vào `http://fptturtor.vn` là dùng được.

```
Máy khách ──http://fptturtor.vn──▶ Máy chủ (192.168.1.220)
                                     ├─ :80   ai-tutor-frontend (web + chuyển tiếp /api, /ws sang BE)
                                     ├─ :8085 ai-tutor-api (BE)
                                     └─ :5678 ai-tutor-n8n (trình duyệt gọi trực tiếp)
```

> Trình duyệt chỉ cần tới **2 cổng** của máy chủ: `80` (web + API) và `5678` (n8n).

---

## Bước 1. Cùng một mạng

- Cắm dây hoặc bắt cùng **một Wi-Fi/router** cho máy chủ và tất cả máy khách.
- Router nên có internet: BE cần gọi LLM (Groq, OpenRouter…) và MongoDB Atlas.
- Không dùng Wi-Fi có "client isolation" (Wi-Fi khách, Wi-Fi trường thường bật). Nếu các máy không ping được nhau ở Bước 2, nguyên nhân thường là ở đây; khi đó dùng router/điểm phát riêng.

## Bước 2. Lấy IPv4 của máy chủ

**macOS** (máy chủ):

```bash
ipconfig getifaddr en0      # Wi-Fi; nếu trống thử en1 (cắm dây)
```

**Windows**: `ipconfig`, xem dòng `IPv4 Address` của card đang dùng.

Ví dụ kết quả: `192.168.1.220`. Hướng dẫn dưới đây dùng IP này, bạn thay bằng IP thật.

Nên **cố định IP** cho máy chủ để IP không đổi sau khi khởi động lại: vào trang quản trị router (thường là `192.168.1.1`), mục DHCP → *Address Reservation / Static Lease*, gán IP cho MAC của máy chủ.

Kiểm tra từ một máy khách:

```bash
ping 192.168.1.220
```

## Bước 3. Mở cho mọi máy truy cập (`localhost` → `0.0.0.0`)

Docker đã publish cổng ra `0.0.0.0` (mọi card mạng). Chỉ cần sửa cấu hình để **không còn chỗ nào trỏ về `localhost`**.

### 3.1. Sửa `AI_Turtor_BE/.env.deploy` trên máy chủ

Thêm hoặc sửa các dòng sau:

```env
# Web chạy ở cổng 80 để gõ tên miền không cần :port
FRONTEND_PORT=80

# Trình duyệt gọi API cùng tên miền (Caddy chuyển tiếp /api sang BE)
VITE_API_BASE_URL=/api

# n8n: trình duyệt gọi trực tiếp, KHÔNG được là localhost
VITE_N8N_BASE_URL=http://fptturtor.vn:5678

# Cho phép trình duyệt từ tên miền mới
APP_CORS_ALLOWED_ORIGINS=http://fptturtor.vn,http://192.168.1.220,http://localhost:5173,http://localhost:3000
```

> Các biến `VITE_*` được **ghi cứng lúc build** frontend. Sửa xong bắt buộc build lại (bước 3.2), restart thôi là không đủ.

### 3.2. Build và chạy lại

```bash
cd AI_Turtor_BE
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build ai-tutor-api ai-tutor-frontend n8n
docker ps --format '{{.Names}}  {{.Ports}}'
```

Phải thấy:

```
ai-tutor-frontend  0.0.0.0:80->3000/tcp
ai-tutor-api       0.0.0.0:8085->8085/tcp
ai-tutor-n8n       0.0.0.0:5678->5678/tcp
```

### 3.3. Tường lửa trên máy chủ

- **macOS**: System Settings → Network → Firewall. Nếu đang bật, vào *Options* và cho phép **Docker** nhận kết nối đến.
- **Windows** (PowerShell chạy với quyền Admin):

  ```powershell
  New-NetFirewallRule -DisplayName "AI Tutor" -Direction Inbound -Protocol TCP -LocalPort 80,5678 -Action Allow
  ```

### 3.4. Thử bằng IP trước

Từ **một máy khách**, mở `http://192.168.1.220`. Thấy trang đăng nhập là Bước 3 đã xong. Nếu không vào được, xem mục *Xử lý sự cố* ở cuối.

## Bước 4. Gắn tên miền `fptturtor.vn` → IP máy chủ

Chọn **một** trong hai cách.

### Cách A. Sửa file hosts trên từng máy (đơn giản, ít máy)

Thêm **một dòng** vào file hosts của **mọi máy**, kể cả máy chủ:

```
192.168.1.220 fptturtor.vn
```

**macOS / Linux**:

```bash
sudo nano /etc/hosts                 # thêm dòng trên, lưu: Ctrl+O, Enter, Ctrl+X
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder   # chỉ macOS
```

**Windows**: mở Notepad bằng *Run as administrator*, mở file
`C:\Windows\System32\drivers\etc\hosts` (chọn *All Files* để thấy file), thêm dòng trên, lưu, rồi chạy:

```powershell
ipconfig /flushdns
```

> Trên máy chủ, có thể dùng `127.0.0.1 fptturtor.vn` thay cho IP LAN.

### Cách B. dnsmasq trên máy chủ (nhiều máy, không phải sửa từng máy)

Máy chủ làm DNS cho cả mạng; máy khách chỉ cần đặt DNS là IP máy chủ.

**Cài trên máy chủ (macOS):**

```bash
brew install dnsmasq
echo 'address=/fptturtor.vn/192.168.1.220' >> "$(brew --prefix)/etc/dnsmasq.conf"
echo 'server=8.8.8.8' >> "$(brew --prefix)/etc/dnsmasq.conf"     # tên miền khác vẫn ra internet
sudo brew services start dnsmasq
```

Kiểm tra trên máy chủ: `dig @127.0.0.1 fptturtor.vn +short` phải in ra `192.168.1.220`. Mở cổng **53 UDP/TCP** nếu tường lửa đang bật.

**Trỏ máy khách dùng DNS này**, chọn 1 trong 2:

- **Cả mạng (khuyên dùng):** trong router → DHCP → *DNS Server* đặt `192.168.1.220`. Các máy kết nối lại Wi-Fi là nhận.
- **Từng máy:**
  - macOS: System Settings → Network → Wi-Fi → Details → DNS → thêm `192.168.1.220`.
  - Windows: Network adapter → IPv4 → *Use the following DNS* → `192.168.1.220`.

> Nếu máy chủ tắt thì máy khách mất DNS. Vì vậy trong router nên đặt thêm `8.8.8.8` làm DNS phụ.

## Bước 5. Truy cập

Trên mọi máy, mở **`http://fptturtor.vn`** (gõ rõ `http://`, xem lưu ý HTTPS bên dưới).

Kiểm tra nhanh từ một máy khách:

```bash
curl -I http://fptturtor.vn/health        # mong đợi: HTTP 200
curl -s  http://fptturtor.vn/api/health   # có phản hồi (401 cũng được: nghĩa là BE đã nhận)
curl -I http://fptturtor.vn:5678          # n8n trả về HTTP 200 hoặc 3xx
```

Sau đó đăng nhập, gửi một câu hỏi trong **Trò chuyện AI Tutor**, rồi mở trang Admin để chắc API, n8n và realtime đều chạy.

---

## Lưu ý

- **HTTPS:** hệ thống chạy `http`. Nếu trình duyệt tự chuyển sang `https://fptturtor.vn` và báo lỗi, gõ lại đúng `http://fptturtor.vn`, hoặc dùng cửa sổ ẩn danh.
- **`fptturtor.vn` là tên miền thật trên internet.** File hosts/dnsmasq chỉ ghi đè trong mạng của bạn. Nếu muốn tránh nhầm với trang thật, có thể dùng tên kiểu `fptturtor.lan`; khi đó thay tên miền ở mọi bước trên.
- **IP máy chủ đổi** (đổi mạng, chưa cố định IP): sửa lại hosts/dnsmasq, sửa `APP_CORS_ALLOWED_ORIGINS` rồi chạy lại bước 3.2.
- **Máy chủ phải luôn bật và không ngủ:** macOS vào System Settings → Battery/Energy, bật *Prevent automatic sleeping*.

## Xử lý sự cố

| Hiện tượng | Kiểm tra / cách sửa |
|---|---|
| Máy khách không `ping` được máy chủ | Sai mạng hoặc Wi-Fi bật client isolation (Bước 1); tường lửa Windows chặn ICMP |
| Vào được bằng IP nhưng không vào được `fptturtor.vn` | Thiếu dòng hosts / DNS chưa trỏ đúng: `ping fptturtor.vn` phải ra `192.168.1.220`; nhớ flush DNS |
| Trang mở được nhưng đăng nhập/tải dữ liệu lỗi | `docker logs ai-tutor-api --tail 50`; kiểm tra `curl http://fptturtor.vn/api/health` |
| Chat báo lỗi kết nối trên máy khách, máy chủ thì chạy | Frontend vẫn build với `VITE_N8N_BASE_URL=localhost`: sửa `.env.deploy` và **build lại** (3.2); mở cổng 5678 |
| Lỗi CORS trong Console (F12) | Thêm đúng origin đang dùng (`http://fptturtor.vn`) vào `APP_CORS_ALLOWED_ORIGINS`, build lại `ai-tutor-api` |
| Cổng 80 báo *address already in use* | Có dịch vụ khác giữ cổng 80: tắt nó, hoặc đặt `FRONTEND_PORT=3000` và truy cập `http://fptturtor.vn:3000` |
