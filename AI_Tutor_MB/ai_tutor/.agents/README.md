# Bộ agent AI Tutor Flutter

Bộ này dành riêng cho project hiện tại: Flutter + Riverpod + GoRouter + Dio, Spring/n8n, JWT và realtime.
Định hướng redesign là **shadcn_ui**, giữ nghiệp vụ. Việc tạo bộ này chưa cài package và chưa thay đổi giao diện ứng dụng.

## 1. Bắt đầu
Mở Codex/Cursor tại thư mục chứa `pubspec.yaml` của app, không phải thư mục Git/backend cha.
Máy cần Node.js >=18 trên PATH của editor; scripts không cần npm install.

```powershell
node .agents/scripts/agent-kit.mjs doctor
node .agents/scripts/agent-kit.mjs validate
node --test .agents/tests/kit.test.mjs
```

Codex đọc `AGENTS.md` và `.agents/skills`. Cursor đọc thêm `.cursor/rules` và cũng hỗ trợ `.agents/skills`.
Không cần chép 15 skills vào thư mục global hoặc nhân đôi trong `.cursor/skills`.
Nếu phiên hiện tại chưa nhận skill mới, mở phiên mới/reload rồi kiểm tra picker. Có thể yêu cầu trực tiếp đọc đường dẫn SKILL.md khi runtime cũ chưa hỗ trợ discovery.

Hooks là bước riêng:
- Codex phiên bản hỗ trợ hooks: kiểm tra project trust, mở `/hooks`, đọc và trust các định nghĩa của project. Không bật tùy chọn bỏ qua trust.
- Cursor: kiểm tra Hooks settings/output và chính sách workspace; xác nhận sự kiện thực tế được ghi nhận.
- Chạy test Node chỉ xác minh script/giao thức bằng dữ liệu mô phỏng, không chứng minh editor đã kích hoạt hooks.

## 2. Những phần đã có
- `AGENTS.md`: cửa vào và hướng dẫn chọn rules.
- `.agents/skills/`: 15 kỹ năng theo tác vụ.
- `.agents/rules/`: 10 quy tắc chuẩn; đây không phải thư mục Codex tự nạp.
- `.cursor/rules/`: 10 adapter trỏ tới rules chuẩn, không nhân đôi nội dung.
- `.agents/references/`: bản đồ project, API, redesign, Shadcn, UI/UX, kiểm thử và tương thích runtime.
- `.agents/templates/`: mẫu brief và bản ghi kiểm chứng.
- `.agents/scripts/`, `.agents/hooks/`, `.agents/tests/`: công cụ guard, hooks và kiểm thử.
- `.codex/hooks.json`, `.cursor/hooks.json`: cấu hình riêng đúng schema từng runtime.
- `.agents/evals/scenarios.json`: tình huống đánh giá hành vi agent thủ công; không phải kết quả đánh giá đã chạy.
- `.agents/.local/`: baseline cá nhân, bị Git ignore. Không lưu token hay nội dung source trong baseline, chỉ đường dẫn/hash.

## 3. Chọn skill
Gọi bằng ngôn ngữ tự nhiên là đủ. Với Codex có thể dùng `$ai-tutor-redesign`; Cursor dùng `/ai-tutor-redesign` nếu picker hỗ trợ.

- `ai-tutor-project`: hiểu codebase, bộ agent và chọn quy trình.
- `ai-tutor-redesign`: điều phối redesign UI, bảo toàn logic.
- `ai-tutor-frontend-design`: định hướng visual, bố cục, typography, hierarchy.
- `ai-tutor-ui-ux-audit`: audit UX/accessibility; mặc định không sửa.
- `ai-tutor-design-system`: tokens và shared components nhất quán.
- `ai-tutor-shadcn`: tích hợp shadcn_ui theo từng bước.
- `ai-tutor-feature`: làm tính năng mới khi được yêu cầu.
- `ai-tutor-screen`: dựng màn hình theo provider/router hiện có.
- `ai-tutor-component`: widget tái sử dụng, giữ contract.
- `ai-tutor-debug`: tìm nguyên nhân; chỉ sửa khi yêu cầu có sửa.
- `ai-tutor-test`: regression tests và xác minh.
- `ai-tutor-performance`: đo và tối ưu có bằng chứng.
- `ai-tutor-security`: review auth, quyền, dữ liệu và nội dung ngoài.
- `ai-tutor-build-release`: build và kiểm tra readiness, không tự publish.
- `ai-tutor-review`: review diff, nêu lỗi, không tự sửa.

Tên `ai-tutor-` tránh nhầm với skill global cũ. Không chép nguyên skill flutter-dart mẫu: Bloc/get_it/GetWidget và một số giả định API của nó không khớp project.

## 4. Quy trình redesign vận hành thế nào?
Bạn giao việc -> agent đọc rules và skill liên quan -> kiểm tra màn hình/logic hiện có -> chốt phạm vi và thiết kế -> tạo baseline -> sửa từng phần UI -> kiểm tra hash + review logic + test + đối chiếu giao diện -> báo cáo.

Ví dụ chỉ xem trước:
> $ai-tutor-redesign Phân tích màn AI chat và đề xuất hướng shadcn_ui. Chỉ đưa brief, chưa sửa file.

Ví dụ triển khai một màn:
> $ai-tutor-redesign Redesign màn AI chat theo brief đã duyệt. Giữ provider, API, callback, điều hướng và trạng thái. Tạo baseline trước khi sửa, thêm regression test và báo rõ phần chưa kiểm chứng.

Ví dụ bước tích hợp thư viện:
> $ai-tutor-shadcn Kiểm tra tương thích SDK và tích hợp shadcn_ui, cho phép sửa lib/app.dart, pubspec.yaml, pubspec.lock và theme cần thiết. Giữ MaterialApp.router, RealtimeBootstrap, localization và Riverpod. Chưa redesign hàng loạt.

Ví dụ audit:
> $ai-tutor-ui-ux-audit Kiểm tra màn quiz ở dark mode, chữ lớn và bàn phím mở. Chỉ báo lỗi và đề xuất.

## 5. Baseline UI: dùng trước khi sửa
Thông thường agent thực hiện các lệnh này trong task redesign đã được phép. Bạn cũng có thể chạy thủ công.

```powershell
node .agents/scripts/agent-kit.mjs snapshot-ui
node .agents/scripts/agent-kit.mjs check-ui
```

Mặc định bảo vệ lib ngoài presentation/shared widgets/theme/icons/ARB, các cây platform, tooling/scripts và cấu hình gốc được liệt kê trong guard.mjs.
Assets, tests và các đường dẫn ngoài danh sách bảo vệ không được so hash. Generated Dart vẫn bị pre-edit hook chặn khi nhận diện được.
Nếu đã cho phép tích hợp Shadcn, bắt đầu baseline với ngoại lệ chính xác:
```powershell
node .agents/scripts/agent-kit.mjs snapshot-ui --allow lib/app.dart --allow pubspec.yaml --allow pubspec.lock
```

Không chạy hai lệnh snapshot liên tiếp: công cụ từ chối ghi đè baseline đang có.
Không cho phép cả thư mục data/application bằng ngoại lệ. Ngoại lệ là file chính xác, không phải glob.
Baseline so với nội dung working tree lúc bắt đầu, không so với Git HEAD, nên không đòi project phải sạch.
Một checkout chỉ có một baseline: không chạy nhiều task redesign đồng thời trên cùng checkout.

Sau khi kiểm tra hash, test và review thành công:
```powershell
node .agents/scripts/agent-kit.mjs finish-ui
```
Lệnh này kiểm tra lại rồi xóa **chỉ** file baseline cục bộ của task; không xóa/sửa code app.
Nếu check thất bại: dừng, xác định thay đổi thuộc ai và có nằm trong phạm vi không. Không reset code người dùng, không tạo lại baseline để che lỗi.
Nếu bỏ hẳn task hoặc đổi phạm vi, xử lý baseline cũ sau khi review rõ diff và được người dùng đồng ý; công cụ không cung cấp force-overwrite.

Mã thoát: 0 thành công; 1 có drift; 2 thiếu/sai baseline hoặc lỗi công cụ.

## 6. Ba hooks
- SessionStart/sessionStart: nhắc ngữ cảnh và cách làm việc.
- PreToolUse/preToolUse: chặn sửa trực tiếp generated Dart; khi baseline hoạt động, chặn các file bảo vệ qua những công cụ sửa file nhận diện được.
- PostToolUse/postToolUse: so baseline, đưa cảnh báo nếu file bảo vệ thay đổi.

Hooks không gọi mạng, đọc transcript, dump môi trường, chạy Flutter, format, commit hay tự tiếp tục vô hạn.
Lỗi runtime/input/baseline của hook được cảnh báo và fail-open; chạy check-ui riêng để xác minh.
Không tự approve thao tác. Không thay đổi cài đặt global.

**Giới hạn quan trọng:** shell hoặc công cụ không nhận diện có thể không bị chặn trước; hooks bị tắt/không được trust thì không chạy. Logic nằm trong presentation vẫn cần review/test. Bộ này là hướng dẫn và guardrail, không bảo đảm giữ logic 100% hoặc thay thế sandbox/CI.

## 7. Khi hoàn thành một task
Yêu cầu agent ghi: đã đổi gì, contract giữ nguyên, check-ui, analyzer, targeted tests, các trạng thái/device đã kiểm tra và phần chưa kiểm tra.
Không đánh đồng `node --test` của bộ agent với `flutter test` của ứng dụng.
Không đánh đồng build thành công với release-ready: Android hiện có debug signing cho release; iOS cần môi trường macOS/Xcode riêng.

## 8. Bảo trì
Sửa nội dung chung trong .agents/rules hoặc references; .cursor/rules chỉ là adapter.
Thêm/sửa skill đúng cấu trúc SKILL.md rồi chạy validate và node tests.
Khi API/kiến trúc đổi, cập nhật project-map/api-contract theo source đã xác minh.
Sau sửa hooks, kiểm tra lại trust và sự kiện thực tế trong editor.
Git đã được điều chỉnh để không bỏ qua hooks/rules Cursor của bộ này; baseline vẫn không được commit.
Chi tiết nguồn và khác biệt runtime: [runtime-compatibility](references/runtime-compatibility.md).
