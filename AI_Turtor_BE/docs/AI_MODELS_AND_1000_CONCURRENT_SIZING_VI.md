# Danh mục model AI và sizing hạ tầng cho 1.000 sinh viên

> Cập nhật: 26/08/2026  
> Phạm vi: `AI_Turtor_BE`, cấu hình runtime Docker local và phương án triển khai model local.  
> Bảo mật: tài liệu không chứa API key, mật khẩu, JWT secret hoặc URI database.

## 1. Kết luận nhanh

- Hệ thống hiện không chỉ dùng một model. Chat chạy qua một chuỗi failover gồm nhiều model cloud, sau cùng mới tới Ollama local.
- Model chat local hiện là `gemma3:4b`. Đây là fallback cuối, không phải model đầu tiên nhận câu hỏi.
- Embedding đang chạy thật là `nvidia/nemotron-3-embed-1b`, tạo vector 2.048 chiều và lưu trong index `course_material_vectors_nemotron3_2048`.
- Rerank đang bật và dùng `nvidia/llama-nemotron-rerank-vl-1b-v2:free` để rút từ 20 kết quả retrieval xuống 5 kết quả.
- Visual RAG đang tắt, dù model visual embedding đã được khai báo.
- `embeddinggemma` đã cài local nhưng không nằm trên đường chạy RAG hiện tại vì `RAG_EMBEDDING_PROVIDER=nvidia`.
- Ollama local có `gemma3:4b` và `embeddinggemma:latest`. Ollama Railway tại thời điểm kiểm tra chưa có model nào trong `/api/tags`; nếu không gắn persistent volume và pull model thì fallback Railway sẽ lỗi `model not found`.
- Hai model Groq cũ trong cấu hình là `llama-3.3-70b-versatile` và `llama-3.1-8b-instant` đã hết hỗ trợ trên free/developer tier từ 16/08/2026. Nên loại chúng khỏi `GROQ_MODELS`.
- Một máy Ollama đơn lẻ không thể phục vụ mượt 1.000 lượt sinh cùng phát sinh câu trả lời. Cần phân biệt 1.000 người online với 1.000 request sinh token đồng thời, đồng thời phải dùng nhiều replica GPU, hàng đợi và continuous batching.

## 2. Luồng model trong code hiện tại

```text
Câu hỏi sinh viên
      |
      v
Chuẩn hóa câu hỏi (có thể gọi LLM utility)
      |
      v
Embedding câu hỏi: NVIDIA Nemotron 3 Embed 1B
      |
      v
Elasticsearch: lấy top 20 chunk theo courseId
      |
      v
Rerank: NVIDIA Llama-Nemotron Rerank VL 1B v2
      |
      v
Giữ top 5 chunk -> tạo prompt RAG
      |
      v
Chuỗi chat failover
Groq -> NVIDIA NIM -> OpenRouter primary -> OpenRouter fallback
     -> OpenRouter free router -> Ollama Gemma 3 4B
```

Thứ tự trên được tạo trong:

- `src/main/java/com/ragapi/service/LlmProviderAdminService.java`
- `src/main/java/com/ragapi/service/OpenRouterChatService.java`
- `src/main/java/com/ragapi/config/OpenAIConfig.java`
- `src/main/resources/application.yml`

MongoDB còn có `LlmProviderOverride`. Vì vậy Admin có thể bật, tắt hoặc đổi model lúc runtime; giá trị effective có thể khác env sau khi có override.

## 3. Danh sách model chat đang được nạp vào runtime

Runtime Docker ngày 26/08/2026 báo chuỗi sau:

| Thứ tự | Provider slot | Model | Vai trò trong dự án | Nhận xét |
|---:|---|---|---|---|
| 1 | Groq 1 | `openai/gpt-oss-120b` | Model chat/reasoning chính; tạo câu trả lời RAG, utility prompt và chấm thi Q&A khi flow gọi chat service | 117B tổng, 5,1B active/token, context 128K. Bản self-host chính thức cần khoảng một GPU 80 GB. |
| 2 | Groq 2 | `qwen/qwen3.6-27b` | Fallback Groq thứ hai, cân bằng chất lượng và độ trễ | Hosted trên Groq; không tiêu thụ GPU của BE. Cần kiểm tra quyền model của Groq organization. |
| 3 | Groq 3 | `llama-3.3-70b-versatile` | Fallback cũ | Đã shutdown với free/developer tier ngày 16/08/2026; nên xóa khỏi danh sách. |
| 4 | Groq 4 | `openai/gpt-oss-20b` | Fallback nhanh, nhẹ hơn 120B | 21B tổng, 3,6B active/token; bản local MXFP4 cần khoảng 16 GB memory. |
| 5 | Groq 5 | `llama-3.1-8b-instant` | Fallback cũ ưu tiên tốc độ | Đã shutdown với free/developer tier ngày 16/08/2026; nên xóa khỏi danh sách. |
| 6 | NVIDIA NIM 1 | `nvidia/nemotron-3-super-120b-a12b` | Fallback cloud chất lượng cao cho RAG, reasoning và tool use | 120B tổng, 12B active; NVIDIA ghi cấu hình tối thiểu self-host là 8 x H100 80 GB. Không phù hợp tự host trong một server phổ thông. |
| 7 | OpenRouter primary | `nvidia/nemotron-3-super-120b-a12b:free` | Thêm quota/provider route cho cùng họ Nemotron Super | Model giống về họ model với slot NVIDIA nhưng đi qua provider/quota khác. |
| 8 | OpenRouter fallback | `nvidia/nemotron-3-ultra-550b-a55b:free` | Fallback reasoning rất lớn | 550B tổng, 55B active. Chỉ nên dùng hosted; tự host đòi hỏi cụm GPU rất lớn. |
| 9 | OpenRouter free router | `openrouter/free` | Router cuối phía cloud, tự chọn model free còn khả dụng | Chất lượng, context và latency thay đổi theo model được router chọn; không nên coi là SLA production. |
| 10 | Ollama | `gemma3:4b` | Fallback local cuối cùng khi các provider cloud không dùng được | Ollama artifact Q4_K_M khoảng 3,3 GB; code giới hạn context 4.096 và output tối đa 1.536 token. |

### Cấu hình Groq nên sửa

```dotenv
GROQ_MODELS=openai/gpt-oss-120b,qwen/qwen3.6-27b,openai/gpt-oss-20b
```

Khi `GROQ_MODELS` có giá trị, code tách toàn bộ danh sách thành các slot theo đúng thứ tự. `GROQ_MODEL` chỉ có ý nghĩa dự phòng khi danh sách rỗng.

## 4. Model embedding, rerank và visual

| Pipeline | Trạng thái | Model | Mục đích | Cấu hình quan trọng |
|---|---|---|---|---|
| Text embedding chính | Đang dùng | `nvidia/nemotron-3-embed-1b` | Embed tài liệu khi index và embed câu hỏi khi search semantic | Vector 2.048 chiều; index hiện tại là `course_material_vectors_nemotron3_2048`; timeout 30 giây; 3 retry. |
| OpenRouter embedding | Đã khai báo, không active | `nvidia/llama-nemotron-embed-vl-1b-v2:free` | Phương án embedding qua OpenRouter hoặc dùng cho dữ liệu text/image | Model gốc hỗ trợ text/image và vector tối đa 2.048 chiều. Chỉ active khi đổi `RAG_EMBEDDING_PROVIDER=openrouter`. |
| Ollama embedding | Đã cài, không active | `embeddinggemma` | Embedding local khi chuyển provider sang Ollama | 300M parameter, artifact khoảng 622 MB, context 2K trên Ollama. Nếu đổi sang model này phải tạo index mới và re-index toàn bộ. |
| Rerank | Đang dùng | `nvidia/llama-nemotron-rerank-vl-1b-v2:free` | Chấm relevance của các chunk đã retrieve | `topK 20 -> 5`; nếu API/quota lỗi thì code giữ thứ tự Elasticsearch. |
| Visual embedding | Đang tắt | `nvidia/llama-nemotron-embed-vl-1b-v2:free` | Embed trang PDF dạng ảnh, bảng, chart và infographic | `RAG_VISUAL_ENABLED=false`; không tiêu thụ tài nguyên runtime hiện tại. |

### Quy tắc bắt buộc khi đổi embedding model

Không trộn vector từ hai model/dimension khác nhau trong cùng Elasticsearch index. Khi đổi embedding model phải:

1. Tạo index mới có đúng dimension.
2. Re-index toàn bộ tài liệu bằng model mới.
3. Chuyển cả indexing và query embedding sang cùng model.
4. Chỉ đổi alias/index production sau khi kiểm tra recall.

Vector `float32` 2.048 chiều tốn khoảng `2.048 x 4 = 8.192 byte` dữ liệu thô cho mỗi chunk. Một triệu chunk tương đương khoảng 8,2 GB chỉ cho vector thô; cần dự trù khoảng 20-35 GB sau HNSW, metadata, source và overhead Elasticsearch.

## 5. Cấu hình generation hiện tại

| Biến | Runtime hiện tại | Ý nghĩa |
|---|---:|---|
| `OLLAMA_CHAT_MODEL` | `gemma3:4b` | Model chat local |
| `OLLAMA_CHAT_NUM_CTX` | `4096` | Context tối đa cấp cho mỗi request Ollama |
| `OLLAMA_CHAT_NUM_PREDICT` | `1536` | Số token output tối đa; giá trị này khá lớn cho tải đồng thời |
| `OLLAMA_CHAT_TEMPERATURE` | `0.2` | Giảm ngẫu nhiên, phù hợp trả lời theo giáo trình |
| `OLLAMA_CHAT_TOP_K` | `40` | Giới hạn sampling candidates |
| `OLLAMA_CHAT_TIMEOUT_SECONDS` | `120` | Timeout Ollama ở backend |
| `RAG_GENERATION_MAX_CONTEXT_CHARS` | `12000` | Giới hạn context cloud |
| `RAG_GENERATION_OLLAMA_MAX_CONTEXT_CHARS` | `8000` | Context RAG rút gọn cho Ollama |
| `RAG_RETRIEVAL_TOP_K` | `20` | Số chunk trước rerank |
| `RAG_RERANK_TOP_K_AFTER` | `5` | Số chunk sau rerank |
| `LLM_CLOUD_FAILOVER_TIMEOUT_SECONDS` | `20` | Khi Ollama active, cloud provider chậm quá 20 giây sẽ failover sớm hơn |
| `LLM_PROVIDER_COOLDOWN_SECONDS` | `60` | Tạm bỏ qua provider lỗi |
| `LLM_QUOTA_SOFT_COOLDOWN_SECONDS` | `120` | Cooldown quota nhẹ |
| `LLM_QUOTA_COOLDOWN_SECONDS` | `900` | Cooldown quota thường |
| `LLM_DAILY_QUOTA_COOLDOWN_SECONDS` | `86400` | Cooldown khi chạm quota ngày |

Để tăng throughput local, nên giảm `OLLAMA_CHAT_NUM_PREDICT` về 384-512 cho câu trả lời sinh viên thông thường. Output 1.536 token làm thời gian giữ GPU và hàng đợi tăng khoảng ba lần so với cap 512 token.

## 6. Hiểu đúng bài toán 1.000 sinh viên

`1.000 sinh viên online` không đồng nghĩa `1.000 request đang sinh token`.

Sizing phải dựa trên:

- số request generation đồng thời;
- token input trung bình sau khi ghép RAG;
- token output trung bình;
- mục tiêu p95 time-to-first-token và p95 total latency;
- tỷ lệ cache hit;
- tỷ lệ request được cloud xử lý trước khi tới local fallback.

Công thức ước lượng tối thiểu cho output throughput:

```text
required_output_tokens_per_second
  = concurrent_generations * average_output_tokens / target_completion_seconds
```

Ví dụ giả định mỗi câu trả lời 350 token và cần hoàn thành trong 15 giây:

| Sinh viên đang sinh câu trả lời | Output throughput tối thiểu | Ghi chú |
|---:|---:|---|
| 20 | khoảng 467 token/s | Có thể chạy trên một GPU tốt với model 4B, cần benchmark thật. |
| 50 | khoảng 1.167 token/s | Nên có từ hai replica GPU để giữ p95 và dự phòng. |
| 100 | khoảng 2.333 token/s | Cần continuous batching và nhiều replica. |
| 1.000 | khoảng 23.333 token/s | Không phù hợp một tiến trình Ollama đơn; đây là bài toán cluster inference. |

Các con số trên mới tính output decode, chưa tính prefill cho khoảng 2.000 token input RAG mỗi request.

## 7. Sizing server đề xuất

### 7.1 Ollama chỉ là fallback, đúng với kiến trúc hiện tại

Đây là phương án hợp lý nhất vì Groq/NVIDIA/OpenRouter xử lý trước và Ollama chỉ chịu tải khi cloud lỗi/quota.

| Thành phần | Khuyến nghị tối thiểu production |
|---|---|
| GPU | 2 node, mỗi node 1 x NVIDIA L40S 48 GB hoặc RTX 6000 Ada 48 GB; active-active |
| CPU | 16-24 core/node |
| RAM | 64-128 GB/node |
| Disk | 500 GB-1 TB NVMe/node |
| Network | 10 Gbps giữa load balancer và inference nodes |
| Runtime | 1 replica `gemma3:4b`/GPU; bắt đầu 8-16 request parallel/replica sau load test |
| Availability | Load balancer health check, hàng đợi giới hạn, circuit breaker và tối thiểu 2 node |

Với phương án này, khi toàn bộ cloud cùng lỗi, hệ thống nên chấp nhận degraded mode: giới hạn output 384-512 token, ưu tiên câu hỏi mới, hiển thị trạng thái chờ và không cố chạy 1.000 generation đồng thời.

### 7.2 1.000 người online, peak khoảng 50-100 generation đồng thời

| Thành phần | Khuyến nghị |
|---|---|
| GPU | 4 x L40S 48 GB, hoặc 2-4 x H100 80 GB |
| CPU | Tổng 64-128 core |
| RAM | Tổng 256-512 GB |
| Disk inference | 2 TB NVMe; model thực tế dưới 10 GB nhưng cần image, cache, logs và rolling version |
| Serving engine | Ưu tiên vLLM hoặc NVIDIA NIM; Ollama phù hợp dev/fallback hơn là high-concurrency production |
| Replication | Một model replica/GPU, load balance least-request, rolling update không làm mất toàn bộ capacity |

Đây là cấu hình khởi điểm để benchmark, không phải cam kết throughput. Gemma 3 4B nhỏ nhưng KV cache, prompt RAG, batching và p99 latency mới là giới hạn thật.

### 7.3 Có đúng 1.000 generation bắt đầu cùng lúc

Nếu yêu cầu là cả 1.000 sinh viên bấm gửi gần như cùng thời điểm và đều cần trả lời mượt:

- Không dùng một Ollama instance.
- Dùng vLLM/NIM với continuous batching, autoscaling và admission queue.
- Lập ngân sách thử nghiệm ban đầu khoảng 8-16 x H100 80 GB hoặc H200, chia nhiều node/replica.
- Dự trù tổng 512 GB-1 TB system RAM, 4 TB NVMe cho inference cluster và mạng 25-100 Gbps tùy topology.
- Chỉ chốt số GPU sau benchmark với prompt RAG thật. Mục tiêu 23.333 output token/s trong ví dụ trên có thể cần thay đổi lớn theo độ dài câu trả lời và SLA.

Nếu muốn tự host `gpt-oss-120b` thay cho Gemma 3 4B, một replica đã cần khoảng 80 GB GPU memory. Muốn chịu concurrency cao và có HA phải có nhiều GPU 80 GB. Nếu muốn tự host Nemotron 3 Super, tài liệu NVIDIA ghi tối thiểu 8 x H100 80 GB cho một deployment; Ultra 550B còn lớn hơn nhiều. Vì vậy không nên chọn các model này làm local fallback kinh tế.

## 8. Cấu hình Ollama service nên dùng làm điểm xuất phát

Các biến sau đặt trên service Ollama, không đặt nhầm vào service Spring Boot:

```dotenv
OLLAMA_KEEP_ALIVE=24h
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=8
OLLAMA_MAX_QUEUE=2000
OLLAMA_CONTEXT_LENGTH=4096
```

Lý do để `OLLAMA_MAX_LOADED_MODELS=1`: production hiện embed qua NVIDIA, vì vậy Ollama chỉ cần giữ `gemma3:4b` trong VRAM. Nếu chuyển embedding về local, nên tách embedding và chat thành hai service/GPU pool thay vì để hai model tranh VRAM.

Ollama nêu rõ RAM/VRAM tăng theo `OLLAMA_NUM_PARALLEL x OLLAMA_CONTEXT_LENGTH`; tăng parallel phải đi cùng quan sát VRAM và load test. Khi queue đầy Ollama sẽ trả 503.

Cấu hình BE khuyến nghị cho tải lớn:

```dotenv
OLLAMA_CHAT_ENABLED=true
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_CHAT_NUM_CTX=4096
OLLAMA_CHAT_NUM_PREDICT=512
OLLAMA_CHAT_TEMPERATURE=0.2
OLLAMA_CHAT_TIMEOUT_SECONDS=60
OLLAMA_CHAT_MAX_RETRIES=0
RAG_GENERATION_OLLAMA_MAX_CONTEXT_CHARS=6000
RAG_QUERY_TRANSLATION_SKIP_WHEN_OLLAMA_ONLY=true
```

## 9. Kiến trúc production khuyến nghị

```text
FE / Mobile
    |
CDN + WAF + rate limit
    |
Load balancer
    |
3+ Backend replicas (stateless)
    |---------------- MongoDB Atlas
    |---------------- Elasticsearch cluster
    |---------------- Redis/cache + distributed queue
    |
LLM gateway
    |---- Groq / NVIDIA / OpenRouter
    `---- Local inference load balancer
             |---- GPU replica 1
             |---- GPU replica 2
             |---- GPU replica N
             `---- bounded queue
```

Không để mỗi backend replica tự tạo một hàng đợi không đồng bộ độc lập. Nên dùng Redis/message queue chung để kiểm soát backpressure, hủy request khi người dùng rời trang và ngăn retry storm khi provider hết quota.

## 10. Checklist benchmark trước khi mua server

1. Thu thập p50/p95 input token và output token từ traffic thật nhưng không log nội dung nhạy cảm.
2. Chạy các mức 20, 50, 100, 250, 500 và 1.000 concurrent requests.
3. Ghi lại p50/p95/p99 TTFT, total latency, token/s, queue time, 429/503 và timeout.
4. Theo dõi GPU utilization, VRAM, KV-cache usage, CPU, RAM và network.
5. Test riêng cache hit, cache miss, cloud healthy và toàn bộ cloud fail để Ollama nhận tải.
6. Test rolling deploy mất một GPU node mà hệ thống vẫn phục vụ được.
7. Chỉ chốt phần cứng khi p95 đạt SLA với tối thiểu 30% headroom.

SLA gợi ý cho AI Tutor:

- p95 time-to-first-token dưới 2-3 giây khi cloud khỏe;
- p95 hoàn thành câu trả lời dưới 15-20 giây;
- GPU steady-state dưới 85% và VRAM dưới 90%;
- không có 503 trong tải thiết kế;
- còn ít nhất 30% capacity khi một replica bị loại khỏi load balancer.

## 11. Việc cần làm ngay trong project

1. Xóa hai Groq model đã deprecated khỏi `GROQ_MODELS`.
2. Pull `gemma3:4b` vào Ollama Railway và gắn persistent volume trước khi bật fallback.
3. Thêm health/readiness check xác nhận model tồn tại, không chỉ kiểm tra endpoint Ollama trả HTTP 200.
4. Giảm `OLLAMA_CHAT_NUM_PREDICT` từ 1.536 xuống 512 cho production high-concurrency.
5. Không đổi `RAG_EMBEDDING_PROVIDER` hoặc `NVIDIA_EMBEDDING_MODEL` nếu chưa tạo index mới và re-index.
6. Thêm load test k6/Gatling cho flow hỏi RAG, không chỉ benchmark endpoint Ollama trực tiếp.
7. Tách Ollama inference khỏi Railway CPU/RAM container nếu cần GPU production; Railway service hiện không chứng minh có GPU/model persistent chỉ bằng public URL.

## 12. Nguồn kỹ thuật chính thức

- [NVIDIA Nemotron 3 Super 120B A12B model card](https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b/modelcard)
- [NVIDIA Nemotron 3 Ultra 550B A55B model card](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard)
- [NVIDIA Nemotron 3 Embed API và dimension](https://docs.nvidia.com/nim/nemo-retriever/text-embedding/latest/reference.html)
- [NVIDIA Llama-Nemotron Embed VL 1B v2 model card](https://build.nvidia.com/nvidia/llama-nemotron-embed-vl-1b-v2/modelcard)
- [NVIDIA Llama-Nemotron Rerank VL 1B v2 model card](https://build.nvidia.com/nvidia/llama-nemotron-rerank-vl-1b-v2/modelcard)
- [OpenAI giới thiệu gpt-oss 120B và 20B](https://openai.com/index/introducing-gpt-oss/)
- [Groq supported models](https://console.groq.com/docs/models)
- [Groq model deprecation](https://console.groq.com/docs/deprecations)
- [Google Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3)
- [Ollama Gemma 3 tags và artifact size](https://ollama.com/library/gemma3/tags)
- [Ollama EmbeddingGemma](https://ollama.com/library/embeddinggemma)
- [Ollama FAQ: concurrency, queue và memory](https://docs.ollama.com/faq)
- [NVIDIA NIM LLM performance benchmark](https://docs.nvidia.com/nim/benchmarking/llm/1.0.0/performance.html)
- [NVIDIA NIM multi-node deployment](https://docs.nvidia.com/nim/large-language-models/latest/deployment/multi-node-deployment.html)

## 13. Giới hạn của bản sizing này

Các cấu hình GPU nêu trên là planning envelope dựa trên model size, concurrency mechanics và throughput target giả định. Chúng không thay thế benchmark. Hiệu năng thật thay đổi theo GPU, quantization, serving engine, prompt RAG, output length, batching, phiên bản driver và SLA p95/p99.
