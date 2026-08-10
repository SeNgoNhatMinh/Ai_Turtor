# Yêu Cầu BE: Phân Trang Cho Dữ Liệu Quản Trị Lớn

## Mục tiêu

Admin Academic và Admin Review Queue sẽ có thể chứa hàng trăm hoặc hàng nghìn bản ghi. FE hiện đã phân trang phía client và chỉ render trang đang xem, nhưng API vẫn trả toàn bộ mảng. Cách này giảm DOM nhưng không giảm dung lượng tải, bộ nhớ và thời gian truy vấn.

BE cần bổ sung server-side pagination, search và filter cho các collection quản trị.

## Contract chung

Query parameters:

- `page`: mặc định `0`.
- `size`: mặc định `20`, tối đa `100`.
- `q`: tìm kiếm không phân biệt hoa thường; BE quyết định các field nghiệp vụ được search.
- `sort`: ví dụ `updatedAt,desc`.
- Các filter theo domain như `status`, `courseId`, `classId`, `semesterId`.

Response thống nhất:

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

`content` chỉ chứa record của trang hiện tại. `totalElements` và `totalPages` phải là giá trị theo các filter đang áp dụng.

## Endpoint cần ưu tiên

### Admin Academic

- `GET /api/admin/semesters?page=&size=&q=&status=&sort=`
- `GET /api/admin/courses?page=&size=&q=&semesterId=&status=&sort=`
- `GET /api/courses/{courseId}/class-sections?page=&size=&q=&status=&sort=`
- `GET /api/courses/{courseId}/materials?page=&size=&q=&status=&classId=&sort=`
- `GET /api/courses/{courseId}/class-sections/{classId}/students?page=&size=&q=&status=&sort=`

### Admin Review Queue

- `GET /api/tutor/answer-reviews/senior-pending?page=&size=&q=&courseId=&classId=&reviewType=&sort=`
- `GET /api/tutor/answer-reviews?status=RESOLVED&page=&size=&q=&courseId=&classId=&sort=`
- `GET /api/tutor/knowledge-candidates?page=&size=&q=&courseId=&status=&candidateType=&sort=`

Search Review Queue cần hỗ trợ tối thiểu: câu hỏi, câu trả lời, tên/email sinh viên, course, class và trạng thái.

## Quy tắc phân quyền và tính nhất quán

- Chỉ trả dữ liệu mà role trong JWT được phép xem.
- Không tin role, reviewerId hoặc scope chỉ từ query parameter.
- Khi record bị thêm, xóa hoặc đổi trạng thái, REST response sau refetch là nguồn chuẩn.
- WebSocket chỉ báo FE refetch trang/filter hiện tại; không thay response phân trang canonical.
- Giữ alias API cũ trong giai đoạn chuyển tiếp hoặc thông báo contract migration rõ ràng, vì FE hiện đang nhận array.

## Trạng thái FE hiện tại

- FE chỉ mount 10/20/50 record theo trang, có search không phân biệt dấu và page navigation.
- Admin Academic có table body giới hạn chiều cao và sticky header.
- Admin Review Queue có phân trang riêng cho feedback, Knowledge Candidate và history.
- FE không giả lập server pagination và không báo thành công giả.

