export const uiCopy = {
  common: {
    refresh: 'Làm mới',
    retry: 'Thử lại',
    cancel: 'Hủy',
    loading: 'Đang tải...',
    selectCourse: 'Chọn môn học',
  },
  app: {
    brandTitle: 'FPT University',
    brandSubtitle: 'AI Tutor',
  },
  student: {
    chat: {
      title: 'Trò chuyện với AI Tutor',
      subtitle: 'Hỏi theo môn học và xem lại lịch sử trao đổi của bạn.',
      empty: 'Hãy đặt câu hỏi đầu tiên',
      inputPlaceholder: 'Nhập câu hỏi...',
      searchPlaceholder: 'Tìm cuộc trò chuyện...',
      sessionLabel: 'Phiên học theo môn',
      questionCounter: (count) => `Câu hỏi ${count}/10`,
      almostFull: 'Cuộc trò chuyện sắp đầy. AI Tutor sẽ tạo cuộc trò chuyện mới sau 10 câu hỏi.',
      full: 'Cuộc trò chuyện đã đủ 10 câu hỏi. Hãy tạo cuộc trò chuyện mới để tiếp tục.',
      switchTitle: 'Đổi môn học?',
      switchDescription: 'Mỗi môn có lịch sử trò chuyện riêng. Khi đổi môn, hệ thống sẽ mở lịch sử của môn đó.',
      newConversationTitle: 'Đã tạo cuộc trò chuyện mới',
      rolloverMessage: 'Cuộc trò chuyện đã đủ 10 câu hỏi. AI Tutor đã tự động tạo cuộc trò chuyện mới.',
      previousConversation: 'Quay lại cuộc trò chuyện trước',
    },
    codeReview: {
      title: 'Kiểm tra mã nguồn',
      subtitle: 'Dán mã nguồn hoặc log lỗi để nhận hướng dẫn gỡ lỗi theo ngữ cảnh.',
      empty: 'Chưa có kết quả phân tích.',
      inputPlaceholder: 'Dán mã nguồn hoặc log lỗi...',
      action: 'Phân tích mã nguồn',
    },
    avatar: {
      title: 'Trạng thái AI Tutor',
      subtitle: 'Robot thể hiện trạng thái của AI Tutor, không phải một chatbot riêng.',
    },
    progress: {
      title: 'Tiến độ học tập',
      subtitle: 'Theo dõi kiến thức đã học, nội dung còn yếu và kế hoạch ôn tập theo từng môn.',
      learnedTitle: 'Đã nắm vững',
      weakTitle: 'Cần cải thiện',
      suggestionsTitle: 'Gợi ý học tập',
    },
    quizzes: {
      title: 'Luyện tập bằng quiz theo tài liệu môn học',
      subtitle: 'Tạo quiz tự ôn, làm quiz giảng viên giao và xem lại kết quả sau khi nộp.',
      noActive: 'Chưa có quiz đang làm. Hãy tạo mới hoặc tiếp tục một quiz.',
      noResult: 'Chưa chọn kết quả quiz để xem lại.',
      contextRequired: 'Cần chọn môn học đã đăng ký để sử dụng quiz luyện tập.',
      activeReady: 'Bạn có một quiz đang làm dở',
      preparing: 'Đang tạo quiz từ tài liệu môn học đã lập chỉ mục...',
    },
    materials: {
      title: 'Tài liệu & bài tập',
      subtitle: 'Xem tài liệu môn học, tải đề bài và nộp bài tập theo đúng lớp học phần.',
      empty: 'Chọn một bài tập để xem chi tiết',
      uploadText: 'Kéo thả tệp vào đây hoặc bấm để chọn',
      uploadHint: 'Hỗ trợ các định dạng được backend cho phép, tối đa 50 MB',
    },
    support: {
      title: 'Hỗ trợ từ giảng viên',
      subtitle: 'Theo dõi câu hỏi khó, trao đổi với giảng viên phù hợp và nhận câu trả lời chính thức.',
      listTitle: 'Yêu cầu hỗ trợ',
      emptyTitle: 'Chưa có yêu cầu hỗ trợ',
      emptyDescription: 'Hãy đặt câu hỏi trong AI Tutor. Câu trả lời thiếu chắc chắn có thể được chuyển tới giảng viên tại đây.',
      detailEmpty: 'Chọn một yêu cầu để xem chi tiết',
    },
  },
  teacher: {
    classes: {
      title: 'Lớp được phân công',
      subtitle: 'Theo dõi sinh viên và ưu tiên các chủ đề cần hỗ trợ trong từng lớp.',
    },
    quizzes: {
      title: 'Quiz được giao',
      subtitle: 'Tạo draft, kiểm tra đáp án, xuất bản và duyệt điểm quiz trực tuyến.',
    },
    materials: {
      title: 'Tài liệu & bài tập',
      subtitle: 'Quản lý học liệu theo lớp và giao bài tập có tệp đính kèm cho sinh viên.',
    },
    grading: {
      title: 'Chấm bài nộp',
      subtitle: 'Xem bài làm, điểm gợi ý và xác nhận điểm cuối cùng cho sinh viên.',
    },
    review: {
      title: 'Hàng chờ hỗ trợ & tri thức AI',
      subtitle: 'Xử lý câu hỏi được chuyển lên, phản hồi AI bị báo lỗi và đề xuất tri thức dùng lại.',
    },
    supportKnowledgeTitle: 'Hàng chờ hỗ trợ & tri thức AI',
    knowledgeUploadTitle: 'Trạng thái cập nhật tri thức AI',
    suggestedAnswerTitle: 'Kiểm tra câu trả lời AI được đề xuất',
  },
  admin: {
    dashboard: {
      title: 'Tổng quan hệ thống',
      subtitle: 'Theo dõi dữ liệu vận hành thật và kiểm tra kết nối các dịch vụ nền tảng.',
    },
    users: {
      title: 'Tài khoản & giảng viên',
      subtitle: 'Quản lý tài khoản, vai trò, hồ sơ giảng viên và dữ liệu import.',
    },
    academic: {
      title: 'Học kỳ & lớp học',
      subtitle: 'Quản lý học kỳ, môn học, lớp học phần, ghi danh và học liệu dùng chung.',
    },
  },
};
