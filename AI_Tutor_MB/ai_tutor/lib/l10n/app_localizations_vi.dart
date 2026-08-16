// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appTitle => 'AI Tutor FPT';

  @override
  String get brandName => 'FPT University';

  @override
  String get tabHome => 'Trang chủ';

  @override
  String get tabCourses => 'Môn học';

  @override
  String get tabAiTutor => 'AI Tutor';

  @override
  String get tabAssignments => 'Bài tập';

  @override
  String get tabProfile => 'Cá nhân';

  @override
  String get tabDashboard => 'Tổng quan';

  @override
  String get tabClasses => 'Lớp học';

  @override
  String get tabInbox => 'Hộp thư';

  @override
  String get loginTitle => 'Đăng nhập';

  @override
  String get loginWelcomeBack => 'Chào mừng trở lại';

  @override
  String get loginSubtitle => 'Đăng nhập bằng email sinh viên FPT.';

  @override
  String get registerTitle => 'Tạo tài khoản';

  @override
  String get registerTagline => 'Gia nhập cộng đồng học tập FPT';

  @override
  String get studentEmailLabel => 'Email sinh viên';

  @override
  String get rememberMe => 'Ghi nhớ';

  @override
  String get forgotPassword => 'Quên mật khẩu?';

  @override
  String get orDivider => 'hoặc';

  @override
  String get continueWithGoogle => 'Tiếp tục với Google';

  @override
  String get googleSignInComingSoon => 'Đăng nhập Google sẽ sớm có mặt.';

  @override
  String get forgotPasswordComingSoon =>
      'Tính năng quên mật khẩu đang được phát triển.';

  @override
  String get termsAgreementPrefix => 'Tôi đồng ý với ';

  @override
  String get termsLink => 'Điều khoản';

  @override
  String get termsAgreementMiddle => ' & ';

  @override
  String get privacyLink => 'Chính sách bảo mật';

  @override
  String get termsAgreementSuffix => ' của FPT.';

  @override
  String get termsRequired => 'Vui lòng đồng ý với điều khoản để tiếp tục.';

  @override
  String passwordStrengthLabel(String level) {
    return 'Độ mạnh: $level';
  }

  @override
  String get passwordStrengthWeak => 'Yếu';

  @override
  String get passwordStrengthFair => 'Khá';

  @override
  String get passwordStrengthGood => 'Tốt';

  @override
  String get passwordStrengthStrong => 'Mạnh';

  @override
  String get retry => 'Thử lại';

  @override
  String get offlineMessage => 'Mất kết nối mạng';

  @override
  String get emailLabel => 'Email';

  @override
  String get emailHint => 'se18xxxx@fpt.edu.vn';

  @override
  String get passwordLabel => 'Mật khẩu';

  @override
  String get passwordHint => 'Nhập mật khẩu';

  @override
  String get fullNameLabel => 'Họ và tên';

  @override
  String get phoneLabel => 'Số điện thoại';

  @override
  String get loginButton => 'Đăng nhập';

  @override
  String get registerButton => 'Tạo tài khoản';

  @override
  String get noAccount => 'Chưa có tài khoản?';

  @override
  String get hasAccount => 'Đã có tài khoản?';

  @override
  String greeting(String name) {
    return 'Chào, $name 👋';
  }

  @override
  String get askAiTutor => 'Hỏi AI Tutor';

  @override
  String get askAiTutorSub => 'Giải đáp theo tài liệu môn học của bạn';

  @override
  String get myCourses => 'Môn học của bạn';

  @override
  String get viewAllCourses => 'Xem tất cả';

  @override
  String get homeGreetingMorning => 'Chào buổi sáng,';

  @override
  String get homeGreetingAfternoon => 'Chào buổi chiều,';

  @override
  String get homeGreetingEvening => 'Chào buổi tối,';

  @override
  String get homeHeroTitle => 'Hôm nay học gì nào?';

  @override
  String get homeHeroSubtitle => 'Hỏi Cóc về bài giảng, code, hay deadline.';

  @override
  String get homeAskQuestion => '+ Đặt câu hỏi';

  @override
  String get questionsAskedStat => 'Câu đã hỏi';

  @override
  String get enrolledCoursesStat => 'Môn đang học';

  @override
  String get tabAskCoc => 'Hỏi Cóc';

  @override
  String classroomSubtitle(String semester, int count) {
    return 'Học kỳ $semester · $count môn';
  }

  @override
  String get classroomFilterActive => 'Đang học';

  @override
  String get classroomFilterCompleted => 'Đã xong';

  @override
  String classroomMaterialsCount(int count) {
    return '$count tài liệu';
  }

  @override
  String classroomAssignmentsCount(int count) {
    return '$count bài tập';
  }

  @override
  String classroomQuestionsCount(int count) {
    return '$count câu đã hỏi';
  }

  @override
  String get aiTutorName => 'Cóc Vàng AI';

  @override
  String get aiLanguageHintTooltip => 'Gợi ý ngôn ngữ';

  @override
  String get aiLanguageHintTitle => 'Ngôn ngữ hỗ trợ';

  @override
  String get aiLanguageHintBody =>
      'Hệ thống chỉ hỗ trợ tiếng Việt và tiếng Anh.\n\nĐể độ chính xác cao nhất (đặc biệt thuật ngữ học thuật và kỹ thuật), hãy dùng từ khóa tiếng Anh trong câu hỏi khi có thể.';

  @override
  String get aiLanguageHintGotIt => 'Đã hiểu';

  @override
  String aiTutorStatus(String course) {
    return 'RAG Tutor · $course';
  }

  @override
  String get chatToday => 'Hôm nay';

  @override
  String get chatInputHint => 'Nhắn cho Cóc...';

  @override
  String confidenceLabel(int percent) {
    return 'Độ tin cậy $percent%';
  }

  @override
  String get reviewHelpfulPrompt => 'Đánh giá';

  @override
  String get pinnedLabel => 'Đã ghim';

  @override
  String get pinnedMessagesTitle => 'Tin đã ghim';

  @override
  String get pinnedMessagesEmpty => 'Chưa có câu trả lời nào được ghim';

  @override
  String get pinnedMessagesEmptyHint =>
      'Ghim câu trả lời AI quan trọng để xem lại nhanh trong cuộc trò chuyện này.';

  @override
  String pinnedCountBanner(int count) {
    return '$count câu trả lời đã ghim';
  }

  @override
  String get messagePinnedSnack => 'Đã ghim tin nhắn';

  @override
  String get messageUnpinnedSnack => 'Đã bỏ ghim tin nhắn';

  @override
  String get viewPinnedMessages => 'Xem tin đã ghim';

  @override
  String get viewInConversation => 'Xem trong cuộc trò chuyện';

  @override
  String get unpinMessage => 'Bỏ ghim';

  @override
  String get copiedSnack => 'Đã sao chép';

  @override
  String get todoSection => 'Cần làm';

  @override
  String get weakTopicsSection => 'Điểm yếu của bạn';

  @override
  String get viewImprovePlan => 'Xem kế hoạch cải thiện';

  @override
  String get emptyCoursesTitle => 'Bạn chưa có môn học nào';

  @override
  String get emptyCoursesMessage =>
      'Liên hệ giảng viên để được thêm vào lớp học.';

  @override
  String get refresh => 'Làm mới';

  @override
  String get materialsTab => 'Tài liệu';

  @override
  String get assignmentsTab => 'Bài tập';

  @override
  String get memoryTab => 'Trí nhớ học tập';

  @override
  String get askAboutCourse => 'Hỏi AI về môn này';

  @override
  String get emptyMaterialsTitle => 'Giảng viên chưa tải tài liệu';

  @override
  String get newConversation => 'Cuộc trò chuyện mới';

  @override
  String get emptyConversationsTitle => 'Chưa có cuộc trò chuyện';

  @override
  String get emptyConversationsMessage =>
      'Bắt đầu hỏi AI Tutor về bài học của bạn.';

  @override
  String get selectCourse => 'Chọn môn học';

  @override
  String get selectCourseHint => 'AI trả lời theo tài liệu môn đã chọn';

  @override
  String get sendMessage => 'Gửi';

  @override
  String get messageHint => 'Nhập câu hỏi...';

  @override
  String get stopGenerating => 'Dừng';

  @override
  String get aiThinking => 'AI đang trả lời...';

  @override
  String get codeMentor => 'Code Mentor';

  @override
  String get codeMentorDisclaimer =>
      'Code Mentor hướng dẫn, không làm hộ bài tập.';

  @override
  String get assignmentRelated => 'Liên quan bài tập?';

  @override
  String get askCodeMentor => 'Hỏi Code Mentor';

  @override
  String get languageLabel => 'Ngôn ngữ';

  @override
  String get codeLabel => 'Mã nguồn';

  @override
  String get questionLabel => 'Câu hỏi';

  @override
  String get emptyAssignmentsTitle => 'Không có bài tập';

  @override
  String get emptyAssignmentsMessage => 'Các bài tập mới sẽ hiện ở đây.';

  @override
  String get submitAssignment => 'Nộp bài';

  @override
  String get downloadAssignment => 'Tải đề bài';

  @override
  String get submissionNote => 'Ghi chú (tuỳ chọn)';

  @override
  String get pickFile => 'Chọn file';

  @override
  String get logout => 'Đăng xuất';

  @override
  String get profileSettings => 'Cài đặt';

  @override
  String get safetyBadge => 'Đã giới hạn để bảo vệ mục tiêu học tập';

  @override
  String get reviewHelpful => 'Hữu ích';

  @override
  String get reviewWrong => 'Sai';

  @override
  String get reviewReport => 'Báo lỗi';

  @override
  String get reviewSuggest => 'Góp ý';

  @override
  String get reviewSubmittedSnack =>
      'Cảm ơn phản hồi! AI chưa cập nhật ngay từ đánh giá này.';

  @override
  String get reviewSubmittedSnackMentor =>
      'Đã gửi phản hồi — mentor sẽ kiểm tra. AI chưa học từ review này.';

  @override
  String get reviewSubmittedSnackSenior =>
      'Đã gửi báo lỗi — Senior sẽ xem xét. AI chưa học từ review này.';

  @override
  String get reviewWrongDialogTitle => 'Báo câu trả lời sai';

  @override
  String get reviewReportDialogTitle => 'Báo lỗi nguồn hoặc tài liệu';

  @override
  String get reviewFeedbackHint => 'Mô tả vấn đề (mentor/senior sẽ kiểm tra)';

  @override
  String get reviewCorrectionHint => 'Gợi ý câu trả lời đúng (tuỳ chọn)';

  @override
  String get reviewFeedbackRequired => 'Vui lòng mô tả vấn đề';

  @override
  String get reviewSubmitFeedback => 'Gửi phản hồi';

  @override
  String get reviewAlreadySubmitted => 'Đã gửi phản hồi';

  @override
  String get generatePlan => 'Tạo gợi ý mới';

  @override
  String get completePlan => 'Đánh dấu hoàn thành';

  @override
  String get emptyPlanTitle => 'Chưa có kế hoạch cải thiện';

  @override
  String get deleteConversation => 'Xóa';

  @override
  String get requestMentorSupport => 'Nhận hỗ trợ từ giảng viên/mentor';

  @override
  String get escalationOfferTitle => 'Đề xuất người hỗ trợ';

  @override
  String get escalationOfferHeading => 'Chọn người hỗ trợ';

  @override
  String get escalationClassTeacherHint =>
      'Giảng viên lớp của bạn sẽ hỗ trợ bạn xác minh câu trả lời.';

  @override
  String get escalationMatchingHint =>
      'Chúng tôi gợi ý mentor phù hợp nhất với câu hỏi của bạn.';

  @override
  String get originalQuestion => 'Câu hỏi gốc';

  @override
  String get suggestedMentors => 'Người hỗ trợ đề xuất';

  @override
  String get noMentorsTitle => 'Chưa có mentor khả dụng';

  @override
  String get noMentorsMessage => 'Thử lại sau hoặc huỷ yêu cầu hỗ trợ.';

  @override
  String get cancelEscalation => 'Huỷ yêu cầu';

  @override
  String get liveChatTitle => 'Trò chuyện trực tiếp';

  @override
  String get liveChatInputHint => 'Nhắn cho mentor...';

  @override
  String get liveChatEmptyTitle => 'Bắt đầu trò chuyện';

  @override
  String get liveChatEmptyMessage =>
      'Gửi tin nhắn để trao đổi với giảng viên/mentor về câu hỏi của bạn.';

  @override
  String get liveChatAiPreviewLabel => 'Phản hồi AI (tham khảo)';

  @override
  String get liveChatOnline => 'Trực tuyến';

  @override
  String get chatRoomClosed => 'Phòng chat đã đóng — chỉ xem lại tin nhắn.';

  @override
  String get escalationContext => 'Ngữ cảnh câu hỏi';

  @override
  String get closeChatTitle => 'Kết thúc trò chuyện';

  @override
  String get rateMentor => 'Đánh giá mentor';

  @override
  String get feedbackLabel => 'Phản hồi (tuỳ chọn)';

  @override
  String get closeChatConfirm => 'Đóng phòng chat';

  @override
  String get escalationHistoryTitle => 'Lịch sử hỗ trợ';

  @override
  String get emptyEscalationHistoryTitle => 'Chưa có lịch sử hỗ trợ';

  @override
  String get emptyEscalationHistoryMessage =>
      'Các yêu cầu escalate sẽ hiện ở đây.';

  @override
  String get viewEscalationHistory => 'Lịch sử hỗ trợ escalate';

  @override
  String teacherGreeting(String name) {
    return 'Xin chào, $name';
  }

  @override
  String get statClasses => 'Lớp đang dạy';

  @override
  String get teacherQuizTitle => 'Quiz AI';

  @override
  String get teacherQuizSubtitle =>
      'Tạo quiz bằng AI và giao cho sinh viên luyện tập';

  @override
  String get teacherQuizManage => 'Quản lý Quiz AI';

  @override
  String get statEscalations => 'Escalation chờ';

  @override
  String get statGrading => 'Bài cần chấm';

  @override
  String get statReviews => 'Review chờ';

  @override
  String get weakTopicsAllClasses => 'Điểm yếu toàn lớp';

  @override
  String get emptyWeakTopicsChart => 'Chưa có dữ liệu điểm yếu.';

  @override
  String get todayTasks => 'Cần xử lý hôm nay';

  @override
  String get emptyTodayTasksTitle => 'Không có việc gấp';

  @override
  String get emptyTodayTasksMessage =>
      'Bạn đã xử lý xong các hạng mục ưu tiên.';

  @override
  String get emptyClassesTitle => 'Chưa có lớp học';

  @override
  String get emptyClassesMessage => 'Liên hệ quản trị để được gán lớp.';

  @override
  String studentCount(int count) {
    return '$count sinh viên';
  }

  @override
  String get viewRoster => 'Xem danh sách';

  @override
  String get rosterTitle => 'Danh sách lớp';

  @override
  String get emptyRosterTitle => 'Lớp chưa có sinh viên';

  @override
  String get emptyRosterMessage => 'Sinh viên sẽ hiện khi được thêm vào lớp.';

  @override
  String get inboxLiveChat => 'Live chat';

  @override
  String get inboxEscalations => 'Escalation';

  @override
  String get inboxReviews => 'Review mentor';

  @override
  String get emptyLiveChatTitle => 'Không có chat đang mở';

  @override
  String get emptyLiveChatMessage => 'Cuộc trò chuyện trực tiếp sẽ hiện ở đây.';

  @override
  String get openLiveChat => 'Mở trò chuyện';

  @override
  String get emptyEscalationInboxTitle => 'Không có escalation chờ';

  @override
  String get emptyEscalationInboxMessage =>
      'Các câu hỏi cần trả lời sẽ hiện ở đây.';

  @override
  String get aiResponseLabel => 'Câu trả lời AI';

  @override
  String get answerEscalation => 'Trả lời escalation';

  @override
  String get emptyReviewQueueTitle => 'Không có review chờ';

  @override
  String get emptyReviewQueueMessage =>
      'Các câu trả lời AI bị dispute sẽ hiện ở đây.';

  @override
  String get reviewQueueHint =>
      'Giải thích lại cho sinh viên qua live chat — review không tự train AI.';

  @override
  String get studentFallback => 'Sinh viên';

  @override
  String get answerEscalationTitle => 'Trả lời escalation';

  @override
  String get escalationNotFound =>
      'Không tìm thấy escalation. Quay lại hộp thư và thử lại.';

  @override
  String get yourAnswerLabel => 'Câu trả lời của bạn';

  @override
  String get yourAnswerHint => 'Viết hướng dẫn rõ ràng cho sinh viên...';

  @override
  String get answerRequired => 'Vui lòng nhập câu trả lời.';

  @override
  String get proposeKnowledgeToggle => 'Đề xuất làm tri thức cho AI?';

  @override
  String get proposeKnowledgeHint =>
      'Bật sẽ tạo candidate chờ Senior duyệt — không tự vào AI ngay.';

  @override
  String get candidateTypeLabel => 'Loại tri thức';

  @override
  String get candidateAcademic => 'Tri thức học thuật';

  @override
  String get candidateMaterial => 'Sửa tài liệu';

  @override
  String get candidateFaq => 'Làm rõ FAQ';

  @override
  String get submitAnswer => 'Gửi câu trả lời';

  @override
  String get answerSubmitted => 'Đã gửi câu trả lời.';

  @override
  String get teacherAssignmentsTitle => 'Quản lý bài tập';

  @override
  String get manageAssignments => 'Quản lý';

  @override
  String get classAssignmentsTitle => 'Bài tập lớp';

  @override
  String get createAssignment => 'Tạo bài tập';

  @override
  String get emptyTeacherAssignmentsTitle => 'Chưa có bài tập';

  @override
  String get emptyTeacherAssignmentsMessage => 'Tạo bài tập mới cho lớp này.';

  @override
  String pendingGradeCount(int count) {
    return '$count bài chờ chấm';
  }

  @override
  String get viewSubmissions => 'Xem bài nộp';

  @override
  String get assignmentTitleLabel => 'Tiêu đề bài tập';

  @override
  String get assignmentDescLabel => 'Mô tả (tuỳ chọn)';

  @override
  String get pickDueDate => 'Chọn hạn nộp';

  @override
  String get createAssignmentValidation => 'Nhập tiêu đề và chọn file đề bài.';

  @override
  String get submissionsTitle => 'Bài nộp';

  @override
  String get emptySubmissionsTitle => 'Chưa có bài nộp';

  @override
  String get emptySubmissionsMessage => 'Sinh viên chưa nộp bài nào.';

  @override
  String get gradeSubmissionTitle => 'Chấm bài';

  @override
  String get submissionNotFound => 'Không tìm thấy bài nộp.';

  @override
  String get downloadSubmission => 'Tải bài nộp';

  @override
  String get scoreLabel => 'Điểm';

  @override
  String get scoreRequired => 'Nhập điểm hợp lệ.';

  @override
  String get weakTopicHint => 'Nhập chủ đề yếu';

  @override
  String get addWeakTopic => 'Thêm';

  @override
  String get submitGrade => 'Lưu điểm';

  @override
  String get gradeSubmitted => 'Đã lưu điểm.';

  @override
  String get editAssignment => 'Sửa bài tập';

  @override
  String get deleteAssignment => 'Xoá bài tập';

  @override
  String deleteAssignmentConfirm(String title) {
    return 'Xoá bài tập \"$title\"? Chỉ xoá được khi chưa có bài nộp.';
  }

  @override
  String get classSubmissionsSummary => 'Tổng hợp bài nộp cả lớp';

  @override
  String get notificationsTitle => 'Thông báo';

  @override
  String get notificationsSubtitle => 'Tổng hợp từ chat, bài tập và hàng đợi';

  @override
  String get emptyNotificationsTitle => 'Không có thông báo';

  @override
  String get emptyNotificationsMessage => 'Mọi thứ đã được cập nhật.';

  @override
  String get appearanceTitle => 'Giao diện';

  @override
  String get themeLight => 'Sáng';

  @override
  String get themeDark => 'Tối';

  @override
  String get themeSystem => 'Theo hệ thống';

  @override
  String get seniorSectionTitle => 'Senior / Admin';

  @override
  String get seniorReviewQueueTitle => 'Review chờ Senior';

  @override
  String get emptySeniorReviewsTitle => 'Không có review chờ';

  @override
  String get emptySeniorReviewsMessage =>
      'Các dispute cần Senior sẽ hiện ở đây.';

  @override
  String get resolveReview => 'Xử lý review';

  @override
  String get resolveReviewTitle => 'Phân giải review';

  @override
  String get decisionApproveFeedback => 'Chấp nhận phản hồi';

  @override
  String get decisionRejectFeedback => 'Từ chối phản hồi';

  @override
  String get decisionCreateCandidate => 'Tạo knowledge candidate';

  @override
  String get reviewNotesLabel => 'Ghi chú review';

  @override
  String get correctedAnswerLabel => 'Câu trả lời đã sửa';

  @override
  String get createCandidateFromReview => 'Tạo candidate từ câu trả lời sửa';

  @override
  String get submitResolution => 'Gửi quyết định';

  @override
  String get knowledgeCandidatesTitle => 'Tri thức chờ duyệt';

  @override
  String get emptyCandidatesTitle => 'Không có candidate chờ';

  @override
  String get emptyCandidatesMessage =>
      'Candidate mới sẽ hiện khi mentor/GV đề xuất.';

  @override
  String get candidateDetailTitle => 'Chi tiết candidate';

  @override
  String get candidateNotFound => 'Không tìm thấy candidate.';

  @override
  String get aiLearningGateNotice =>
      'Đây là cổng duy nhất AI được học — mọi candidate cần Senior duyệt trước khi vào RAG.';

  @override
  String get proposedAnswerLabel => 'Câu trả lời đề xuất';

  @override
  String get contentOverrideLabel => 'Nội dung index (tuỳ chọn)';

  @override
  String get rejectionReasonLabel => 'Lý do từ chối';

  @override
  String get rejectionReasonRequired => 'Nhập lý do từ chối.';

  @override
  String get approveIndexRag => 'Duyệt — Index vào RAG';

  @override
  String get rejectCandidate => 'Từ chối candidate';

  @override
  String get candidateApproved => 'Đã duyệt và index vào AI.';

  @override
  String get candidateRejected => 'Đã từ chối candidate.';

  @override
  String get cannotApproveOwnCandidate =>
      'Bạn không thể duyệt candidate do chính mình tạo.';

  @override
  String pendingItemsCount(int count) {
    return '$count mục đang chờ';
  }

  @override
  String get noPendingItems => 'Không có mục chờ';

  @override
  String get cancelAction => 'Huỷ';

  @override
  String get editProfileTitle => 'Chỉnh sửa hồ sơ';

  @override
  String get fullNameRequired => 'Vui lòng nhập họ và tên';

  @override
  String get profileUpdated => 'Đã cập nhật hồ sơ';

  @override
  String get saveChanges => 'Lưu thay đổi';

  @override
  String get bioLabel => 'Giới thiệu';

  @override
  String get addressLabel => 'Địa chỉ';

  @override
  String get cityLabel => 'Thành phố';

  @override
  String get teacherMaterialsTitle => 'Quản lý tài liệu';

  @override
  String get uploadMaterial => 'Tải tài liệu lên';

  @override
  String get materialTitleLabel => 'Tiêu đề tài liệu';

  @override
  String get uploadMaterialValidation => 'Vui lòng nhập tiêu đề và chọn file';

  @override
  String get emptyTeacherMaterialsTitle => 'Chưa có tài liệu';

  @override
  String get emptyTeacherMaterialsMessage =>
      'Tải tài liệu lên để AI và sinh viên sử dụng.';

  @override
  String get viewPdf => 'Xem PDF';

  @override
  String get reindexMaterial => 'Lập chỉ mục lại';

  @override
  String get deleteMaterial => 'Xoá tài liệu';

  @override
  String deleteMaterialConfirm(String title) {
    return 'Xoá \"$title\"? Hành động này không thể hoàn tác.';
  }

  @override
  String get materialDeleted => 'Đã xoá tài liệu';

  @override
  String get materialReindexed => 'Đã lập chỉ mục lại tài liệu';

  @override
  String get materialUploaded => 'Đã tải tài liệu lên';

  @override
  String get importFromUrl => 'Import từ URL';

  @override
  String get importUrlHint =>
      'Nhập URL trang tài liệu HTML (vd. javadoc, docs online) để xem trước mục lục rồi chọn phần cần import.';

  @override
  String get importUrlLabel => 'URL tài liệu HTML';

  @override
  String get importUrlRequired => 'Vui lòng nhập URL';

  @override
  String get previewToc => 'Xem mục lục';

  @override
  String get importUrlNoToc =>
      'Không tìm thấy mục lục trên trang này. Bạn có thể import trực tiếp trang này, tuỳ chọn theo dõi các liên kết \"Next\" để lấy thêm trang.';

  @override
  String get importUrlFollowNext => 'Tự động lấy các trang \"Next\" tiếp theo';

  @override
  String importUrlSelectPages(int count) {
    return 'Chọn trang cần import ($count trang)';
  }

  @override
  String get importUrlSelectAll => 'Chọn tất cả';

  @override
  String get importUrlDeselectAll => 'Bỏ chọn tất cả';

  @override
  String get editMaterialTitle => 'Sửa thông tin';

  @override
  String get materialCategoryLabel => 'Danh mục (tuỳ chọn)';

  @override
  String courseDetailSubtitle(String courseName, int percent) {
    return '$courseName · $percent% hoàn thành';
  }

  @override
  String get courseInfoTab => 'Thông tin';

  @override
  String courseProgressLabel(int percent) {
    return 'Tiến độ môn học: $percent%';
  }

  @override
  String materialsCount(int count) {
    return '$count tài liệu';
  }

  @override
  String materialsRagCount(int count) {
    return '✓ $count đã vào RAG';
  }

  @override
  String get materialIndexing => 'Đang index...';

  @override
  String get materialReady => 'Sẵn sàng';

  @override
  String get materialPagesUnit => 'trang';

  @override
  String get materialSlidesUnit => 'slide';

  @override
  String get materialNotFound => 'Không tìm thấy tài liệu';

  @override
  String get materialDefaultCategory => 'TÀI LIỆU';

  @override
  String get materialReaderHint =>
      'Nội dung bài đọc được lấy từ tài liệu môn học. Bạn có thể mở file PDF để đọc đầy đủ hoặc hỏi Cóc về phần đang học.';

  @override
  String get openMaterialPdf => 'Mở file PDF';

  @override
  String get materialHighlightHint => 'Highlight để hỏi Cóc về đoạn vừa đọc.';

  @override
  String materialAskHint(int page) {
    return 'Hỏi Cóc về trang $page...';
  }

  @override
  String assignmentFilterPending(int count) {
    return 'Cần nộp • $count';
  }

  @override
  String get assignmentFilterSubmitted => 'Đã nộp';

  @override
  String get assignmentFilterReviewed => 'Đã chấm';

  @override
  String get assignmentStatusPending => 'Chưa nộp';

  @override
  String get assignmentStatusSubmitted => 'Đã nộp';

  @override
  String get assignmentStatusReviewed => 'Đã chấm';

  @override
  String get viewAssignment => 'Xem';

  @override
  String get assignmentNotFound => 'Không tìm thấy bài tập';

  @override
  String get assignmentDownloadSuccess => 'Đã tải đề bài';

  @override
  String get assignmentNoAttachment => 'Bài tập chưa có file đính kèm';

  @override
  String get assignmentGradeLabel => 'Điểm bài tập';

  @override
  String get submitAssignmentTitle => 'Nộp bài';

  @override
  String submitDeadlineLabel(String time) {
    return 'Hạn còn $time';
  }

  @override
  String get submitFileLabel => 'File nộp';

  @override
  String get submitPickFile => 'Chọn file để tải lên';

  @override
  String get submitFileTypes => '.java .zip .pdf · tối đa 25 MB';

  @override
  String get submitNoteLabel => 'Ghi chú cho giảng viên';

  @override
  String get submitNoteHint =>
      'Em đã hoàn thành 3 lớp con. Phần tính diện tích hình tròn em chưa chắc...';

  @override
  String get submitConfirm => 'Xác nhận nộp bài';

  @override
  String get submitResubmitHint => 'Bạn có thể nộp lại trước khi hết hạn.';

  @override
  String get submitAttached => 'đã đính kèm';

  @override
  String get improvePlanTitle => 'Kế hoạch cải thiện';

  @override
  String improvePlanSubtitle(String courseCode) {
    return '$courseCode · Cóc gợi ý cho bạn';
  }

  @override
  String get improvePlanDefaultSummary =>
      'Bạn yếu ở một số chủ đề. Hoàn thành kế hoạch để nâng điểm cuối kỳ.';

  @override
  String get improveTopicsHeading => 'CHỦ ĐỀ CẦN CỦNG CỐ';

  @override
  String get improveRoadmapHeading => 'LỘ TRÌNH 3 BƯỚC';

  @override
  String get learnNow => 'Học ngay';

  @override
  String get pinSuggestion => 'Ghim gợi ý';

  @override
  String get unpinSuggestion => 'Bỏ ghim';

  @override
  String riskLevelLabel(String level) {
    return 'MỨC RỦI RO: $level';
  }

  @override
  String get riskLevelHigh => 'CAO';

  @override
  String get riskLevelMedium => 'TRUNG BÌNH';

  @override
  String get riskLevelLow => 'THẤP';

  @override
  String get planStepCompleted => 'Hoàn thành';

  @override
  String get planStepInProgress => 'Đang làm';

  @override
  String get planStepNotStarted => 'Chưa bắt đầu';

  @override
  String get profileStreakStat => 'Streak';

  @override
  String get profileQuestionsStat => 'Câu hỏi';

  @override
  String get profileCoursesStat => 'Môn học';

  @override
  String get profileHelpFeedback => 'Trợ giúp & Phản hồi';

  @override
  String get profileHelpComingSoon =>
      'Tính năng trợ giúp đang được phát triển.';

  @override
  String get changePasswordTitle => 'Đổi mật khẩu';

  @override
  String get changePasswordCurrentLabel => 'Mật khẩu hiện tại';

  @override
  String get changePasswordNewLabel => 'Mật khẩu mới';

  @override
  String get changePasswordConfirmLabel => 'Xác nhận mật khẩu mới';

  @override
  String get changePasswordSaveBtn => 'Cập nhật mật khẩu';

  @override
  String get changePasswordSuccess => 'Đổi mật khẩu thành công.';

  @override
  String get changePasswordMismatch => 'Mật khẩu mới không khớp.';

  @override
  String get changePasswordTooShort => 'Mật khẩu phải có ít nhất 6 ký tự.';
}
