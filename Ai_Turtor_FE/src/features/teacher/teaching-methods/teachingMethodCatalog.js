/** Friendly teaching methods shown to teachers (maps to backend strategies). */
export const TEACHING_METHODS = [
  {
    id: 'step_by_step',
    title: 'Giải thích từng bước',
    description: 'Chia kiến thức thành các bước nhỏ, dễ hiểu',
    strategy: 'Giải thích khái niệm',
    instruction: 'Giải thích từng bước nhỏ, rõ ràng trước khi đưa ví dụ.',
  },
  {
    id: 'examples',
    title: 'Học qua ví dụ',
    description: 'Dùng ví dụ thực tế và ví dụ lập trình',
    strategy: 'Ví dụ thực tế',
    instruction: 'Luôn kèm một ví dụ thực tế hoặc ví dụ lập trình ngắn cho khái niệm đang dạy.',
  },
  {
    id: 'visual',
    title: 'Học qua hình ảnh',
    description: 'Sử dụng sơ đồ, bảng và minh họa',
    strategy: 'Minh họa trực quan',
    instruction: 'Dùng sơ đồ, bảng hoặc minh họa trực quan khi giải thích.',
  },
  {
    id: 'compare',
    title: 'So sánh và đối chiếu',
    description: 'So sánh các khái niệm để thấy điểm giống và khác',
    strategy: 'Bảng so sánh',
    instruction: 'So sánh khái niệm hiện tại với khái niệm gần nhất bằng bảng ngắn.',
  },
  {
    id: 'guiding_questions',
    title: 'Đặt câu hỏi gợi mở',
    description: 'Dẫn dắt sinh viên tự suy nghĩ và tìm câu trả lời',
    strategy: 'Tự kiểm tra',
    instruction: 'Đặt câu hỏi gợi mở để sinh viên tự suy nghĩ trước khi chốt đáp án.',
  },
  {
    id: 'guided_practice',
    title: 'Luyện tập từng bước',
    description: 'Bắt đầu từ bài tập dễ rồi tăng dần độ khó',
    strategy: 'Bài tập có hướng dẫn',
    instruction: 'Cho bài tập có khung gợi ý, từ dễ đến khó, không đưa lời giải hoàn chỉnh ngay.',
  },
  {
    id: 'reteach',
    title: 'Giải thích lại khi chưa hiểu',
    description: 'Đổi cách giải thích và đưa ví dụ khác',
    strategy: 'Giải thích khái niệm',
    instruction: 'Khi sinh viên chưa hiểu, đổi cách diễn giải và đưa ví dụ khác, không lặp nguyên câu trước.',
  },
  {
    id: 'real_world',
    title: 'Học qua tình huống thực tế',
    description: 'Liên hệ kiến thức với tình huống trong thực tế',
    strategy: 'Ví dụ thực tế',
    instruction: 'Liên hệ kiến thức với một tình huống thực tế gần gũi với sinh viên.',
  },
];

export const SUPPORT_LEVEL_CARDS = [
  {
    value: 'HIGH_SUPPORT',
    title: 'Hỗ trợ nhiều',
    description: 'AI giải thích chậm và kỹ, chia nhỏ vấn đề, gợi ý từng bước.',
  },
  {
    value: 'STANDARD',
    title: 'Bình thường',
    description: 'AI giải thích đầy đủ, có ví dụ và bài tập phù hợp.',
  },
  {
    value: 'CHALLENGE',
    title: 'Thử thách',
    description: 'AI khuyến khích tự suy luận, hạn chế gợi ý ngay.',
  },
];

export const CUSTOM_NOTE_CHIPS = [
  'Ưu tiên ví dụ thực tế.',
  'Không đưa đáp án ngay.',
  'Luôn kiểm tra sinh viên đã hiểu chưa.',
  'Liên hệ với nội dung đã học trước đó.',
];
