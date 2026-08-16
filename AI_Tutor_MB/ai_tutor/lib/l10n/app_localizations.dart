import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('vi')];

  /// No description provided for @appTitle.
  ///
  /// In vi, this message translates to:
  /// **'AI Tutor FPT'**
  String get appTitle;

  /// No description provided for @brandName.
  ///
  /// In vi, this message translates to:
  /// **'FPT University'**
  String get brandName;

  /// No description provided for @tabHome.
  ///
  /// In vi, this message translates to:
  /// **'Trang chủ'**
  String get tabHome;

  /// No description provided for @tabCourses.
  ///
  /// In vi, this message translates to:
  /// **'Môn học'**
  String get tabCourses;

  /// No description provided for @tabAiTutor.
  ///
  /// In vi, this message translates to:
  /// **'AI Tutor'**
  String get tabAiTutor;

  /// No description provided for @tabAssignments.
  ///
  /// In vi, this message translates to:
  /// **'Bài tập'**
  String get tabAssignments;

  /// No description provided for @tabProfile.
  ///
  /// In vi, this message translates to:
  /// **'Cá nhân'**
  String get tabProfile;

  /// No description provided for @tabDashboard.
  ///
  /// In vi, this message translates to:
  /// **'Tổng quan'**
  String get tabDashboard;

  /// No description provided for @tabClasses.
  ///
  /// In vi, this message translates to:
  /// **'Lớp học'**
  String get tabClasses;

  /// No description provided for @tabInbox.
  ///
  /// In vi, this message translates to:
  /// **'Hộp thư'**
  String get tabInbox;

  /// No description provided for @loginTitle.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get loginTitle;

  /// No description provided for @loginWelcomeBack.
  ///
  /// In vi, this message translates to:
  /// **'Chào mừng trở lại'**
  String get loginWelcomeBack;

  /// No description provided for @loginSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập bằng email sinh viên FPT.'**
  String get loginSubtitle;

  /// No description provided for @registerTitle.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản'**
  String get registerTitle;

  /// No description provided for @registerTagline.
  ///
  /// In vi, this message translates to:
  /// **'Gia nhập cộng đồng học tập FPT'**
  String get registerTagline;

  /// No description provided for @studentEmailLabel.
  ///
  /// In vi, this message translates to:
  /// **'Email sinh viên'**
  String get studentEmailLabel;

  /// No description provided for @rememberMe.
  ///
  /// In vi, this message translates to:
  /// **'Ghi nhớ'**
  String get rememberMe;

  /// No description provided for @forgotPassword.
  ///
  /// In vi, this message translates to:
  /// **'Quên mật khẩu?'**
  String get forgotPassword;

  /// No description provided for @orDivider.
  ///
  /// In vi, this message translates to:
  /// **'hoặc'**
  String get orDivider;

  /// No description provided for @continueWithGoogle.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục với Google'**
  String get continueWithGoogle;

  /// No description provided for @googleSignInComingSoon.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập Google sẽ sớm có mặt.'**
  String get googleSignInComingSoon;

  /// No description provided for @forgotPasswordComingSoon.
  ///
  /// In vi, this message translates to:
  /// **'Tính năng quên mật khẩu đang được phát triển.'**
  String get forgotPasswordComingSoon;

  /// No description provided for @termsAgreementPrefix.
  ///
  /// In vi, this message translates to:
  /// **'Tôi đồng ý với '**
  String get termsAgreementPrefix;

  /// No description provided for @termsLink.
  ///
  /// In vi, this message translates to:
  /// **'Điều khoản'**
  String get termsLink;

  /// No description provided for @termsAgreementMiddle.
  ///
  /// In vi, this message translates to:
  /// **' & '**
  String get termsAgreementMiddle;

  /// No description provided for @privacyLink.
  ///
  /// In vi, this message translates to:
  /// **'Chính sách bảo mật'**
  String get privacyLink;

  /// No description provided for @termsAgreementSuffix.
  ///
  /// In vi, this message translates to:
  /// **' của FPT.'**
  String get termsAgreementSuffix;

  /// No description provided for @termsRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng đồng ý với điều khoản để tiếp tục.'**
  String get termsRequired;

  /// No description provided for @passwordStrengthLabel.
  ///
  /// In vi, this message translates to:
  /// **'Độ mạnh: {level}'**
  String passwordStrengthLabel(String level);

  /// No description provided for @passwordStrengthWeak.
  ///
  /// In vi, this message translates to:
  /// **'Yếu'**
  String get passwordStrengthWeak;

  /// No description provided for @passwordStrengthFair.
  ///
  /// In vi, this message translates to:
  /// **'Khá'**
  String get passwordStrengthFair;

  /// No description provided for @passwordStrengthGood.
  ///
  /// In vi, this message translates to:
  /// **'Tốt'**
  String get passwordStrengthGood;

  /// No description provided for @passwordStrengthStrong.
  ///
  /// In vi, this message translates to:
  /// **'Mạnh'**
  String get passwordStrengthStrong;

  /// No description provided for @retry.
  ///
  /// In vi, this message translates to:
  /// **'Thử lại'**
  String get retry;

  /// No description provided for @offlineMessage.
  ///
  /// In vi, this message translates to:
  /// **'Mất kết nối mạng'**
  String get offlineMessage;

  /// No description provided for @emailLabel.
  ///
  /// In vi, this message translates to:
  /// **'Email'**
  String get emailLabel;

  /// No description provided for @emailHint.
  ///
  /// In vi, this message translates to:
  /// **'se18xxxx@fpt.edu.vn'**
  String get emailHint;

  /// No description provided for @passwordLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu'**
  String get passwordLabel;

  /// No description provided for @passwordHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập mật khẩu'**
  String get passwordHint;

  /// No description provided for @fullNameLabel.
  ///
  /// In vi, this message translates to:
  /// **'Họ và tên'**
  String get fullNameLabel;

  /// No description provided for @phoneLabel.
  ///
  /// In vi, this message translates to:
  /// **'Số điện thoại'**
  String get phoneLabel;

  /// No description provided for @loginButton.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get loginButton;

  /// No description provided for @registerButton.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản'**
  String get registerButton;

  /// No description provided for @noAccount.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có tài khoản?'**
  String get noAccount;

  /// No description provided for @hasAccount.
  ///
  /// In vi, this message translates to:
  /// **'Đã có tài khoản?'**
  String get hasAccount;

  /// No description provided for @greeting.
  ///
  /// In vi, this message translates to:
  /// **'Chào, {name} 👋'**
  String greeting(String name);

  /// No description provided for @askAiTutor.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi AI Tutor'**
  String get askAiTutor;

  /// No description provided for @askAiTutorSub.
  ///
  /// In vi, this message translates to:
  /// **'Giải đáp theo tài liệu môn học của bạn'**
  String get askAiTutorSub;

  /// No description provided for @myCourses.
  ///
  /// In vi, this message translates to:
  /// **'Môn học của bạn'**
  String get myCourses;

  /// No description provided for @viewAllCourses.
  ///
  /// In vi, this message translates to:
  /// **'Xem tất cả'**
  String get viewAllCourses;

  /// No description provided for @homeGreetingMorning.
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi sáng,'**
  String get homeGreetingMorning;

  /// No description provided for @homeGreetingAfternoon.
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi chiều,'**
  String get homeGreetingAfternoon;

  /// No description provided for @homeGreetingEvening.
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi tối,'**
  String get homeGreetingEvening;

  /// No description provided for @homeHeroTitle.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay học gì nào?'**
  String get homeHeroTitle;

  /// No description provided for @homeHeroSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi Cóc về bài giảng, code, hay deadline.'**
  String get homeHeroSubtitle;

  /// No description provided for @homeAskQuestion.
  ///
  /// In vi, this message translates to:
  /// **'+ Đặt câu hỏi'**
  String get homeAskQuestion;

  /// No description provided for @questionsAskedStat.
  ///
  /// In vi, this message translates to:
  /// **'Câu đã hỏi'**
  String get questionsAskedStat;

  /// No description provided for @enrolledCoursesStat.
  ///
  /// In vi, this message translates to:
  /// **'Môn đang học'**
  String get enrolledCoursesStat;

  /// No description provided for @tabAskCoc.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi Cóc'**
  String get tabAskCoc;

  /// No description provided for @classroomSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Học kỳ {semester} · {count} môn'**
  String classroomSubtitle(String semester, int count);

  /// No description provided for @classroomFilterActive.
  ///
  /// In vi, this message translates to:
  /// **'Đang học'**
  String get classroomFilterActive;

  /// No description provided for @classroomFilterCompleted.
  ///
  /// In vi, this message translates to:
  /// **'Đã xong'**
  String get classroomFilterCompleted;

  /// No description provided for @classroomMaterialsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} tài liệu'**
  String classroomMaterialsCount(int count);

  /// No description provided for @classroomAssignmentsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} bài tập'**
  String classroomAssignmentsCount(int count);

  /// No description provided for @classroomQuestionsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} câu đã hỏi'**
  String classroomQuestionsCount(int count);

  /// No description provided for @aiTutorName.
  ///
  /// In vi, this message translates to:
  /// **'Cóc Vàng AI'**
  String get aiTutorName;

  /// No description provided for @aiLanguageHintTooltip.
  ///
  /// In vi, this message translates to:
  /// **'Gợi ý ngôn ngữ'**
  String get aiLanguageHintTooltip;

  /// No description provided for @aiLanguageHintTitle.
  ///
  /// In vi, this message translates to:
  /// **'Ngôn ngữ hỗ trợ'**
  String get aiLanguageHintTitle;

  /// No description provided for @aiLanguageHintBody.
  ///
  /// In vi, this message translates to:
  /// **'Hệ thống chỉ hỗ trợ tiếng Việt và tiếng Anh.\n\nĐể độ chính xác cao nhất (đặc biệt thuật ngữ học thuật và kỹ thuật), hãy dùng từ khóa tiếng Anh trong câu hỏi khi có thể.'**
  String get aiLanguageHintBody;

  /// No description provided for @aiLanguageHintGotIt.
  ///
  /// In vi, this message translates to:
  /// **'Đã hiểu'**
  String get aiLanguageHintGotIt;

  /// No description provided for @aiTutorStatus.
  ///
  /// In vi, this message translates to:
  /// **'RAG Tutor · {course}'**
  String aiTutorStatus(String course);

  /// No description provided for @chatToday.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay'**
  String get chatToday;

  /// No description provided for @chatInputHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhắn cho Cóc...'**
  String get chatInputHint;

  /// No description provided for @confidenceLabel.
  ///
  /// In vi, this message translates to:
  /// **'Độ tin cậy {percent}%'**
  String confidenceLabel(int percent);

  /// No description provided for @reviewHelpfulPrompt.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá'**
  String get reviewHelpfulPrompt;

  /// No description provided for @pinnedLabel.
  ///
  /// In vi, this message translates to:
  /// **'Đã ghim'**
  String get pinnedLabel;

  /// No description provided for @pinnedMessagesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Tin đã ghim'**
  String get pinnedMessagesTitle;

  /// No description provided for @pinnedMessagesEmpty.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có câu trả lời nào được ghim'**
  String get pinnedMessagesEmpty;

  /// No description provided for @pinnedMessagesEmptyHint.
  ///
  /// In vi, this message translates to:
  /// **'Ghim câu trả lời AI quan trọng để xem lại nhanh trong cuộc trò chuyện này.'**
  String get pinnedMessagesEmptyHint;

  /// No description provided for @pinnedCountBanner.
  ///
  /// In vi, this message translates to:
  /// **'{count} câu trả lời đã ghim'**
  String pinnedCountBanner(int count);

  /// No description provided for @messagePinnedSnack.
  ///
  /// In vi, this message translates to:
  /// **'Đã ghim tin nhắn'**
  String get messagePinnedSnack;

  /// No description provided for @messageUnpinnedSnack.
  ///
  /// In vi, this message translates to:
  /// **'Đã bỏ ghim tin nhắn'**
  String get messageUnpinnedSnack;

  /// No description provided for @viewPinnedMessages.
  ///
  /// In vi, this message translates to:
  /// **'Xem tin đã ghim'**
  String get viewPinnedMessages;

  /// No description provided for @viewInConversation.
  ///
  /// In vi, this message translates to:
  /// **'Xem trong cuộc trò chuyện'**
  String get viewInConversation;

  /// No description provided for @unpinMessage.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ ghim'**
  String get unpinMessage;

  /// No description provided for @copiedSnack.
  ///
  /// In vi, this message translates to:
  /// **'Đã sao chép'**
  String get copiedSnack;

  /// No description provided for @todoSection.
  ///
  /// In vi, this message translates to:
  /// **'Cần làm'**
  String get todoSection;

  /// No description provided for @weakTopicsSection.
  ///
  /// In vi, this message translates to:
  /// **'Điểm yếu của bạn'**
  String get weakTopicsSection;

  /// No description provided for @viewImprovePlan.
  ///
  /// In vi, this message translates to:
  /// **'Xem kế hoạch cải thiện'**
  String get viewImprovePlan;

  /// No description provided for @emptyCoursesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bạn chưa có môn học nào'**
  String get emptyCoursesTitle;

  /// No description provided for @emptyCoursesMessage.
  ///
  /// In vi, this message translates to:
  /// **'Liên hệ giảng viên để được thêm vào lớp học.'**
  String get emptyCoursesMessage;

  /// No description provided for @refresh.
  ///
  /// In vi, this message translates to:
  /// **'Làm mới'**
  String get refresh;

  /// No description provided for @materialsTab.
  ///
  /// In vi, this message translates to:
  /// **'Tài liệu'**
  String get materialsTab;

  /// No description provided for @assignmentsTab.
  ///
  /// In vi, this message translates to:
  /// **'Bài tập'**
  String get assignmentsTab;

  /// No description provided for @memoryTab.
  ///
  /// In vi, this message translates to:
  /// **'Trí nhớ học tập'**
  String get memoryTab;

  /// No description provided for @askAboutCourse.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi AI về môn này'**
  String get askAboutCourse;

  /// No description provided for @emptyMaterialsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Giảng viên chưa tải tài liệu'**
  String get emptyMaterialsTitle;

  /// No description provided for @newConversation.
  ///
  /// In vi, this message translates to:
  /// **'Cuộc trò chuyện mới'**
  String get newConversation;

  /// No description provided for @emptyConversationsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có cuộc trò chuyện'**
  String get emptyConversationsTitle;

  /// No description provided for @emptyConversationsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu hỏi AI Tutor về bài học của bạn.'**
  String get emptyConversationsMessage;

  /// No description provided for @selectCourse.
  ///
  /// In vi, this message translates to:
  /// **'Chọn môn học'**
  String get selectCourse;

  /// No description provided for @selectCourseHint.
  ///
  /// In vi, this message translates to:
  /// **'AI trả lời theo tài liệu môn đã chọn'**
  String get selectCourseHint;

  /// No description provided for @sendMessage.
  ///
  /// In vi, this message translates to:
  /// **'Gửi'**
  String get sendMessage;

  /// No description provided for @messageHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập câu hỏi...'**
  String get messageHint;

  /// No description provided for @stopGenerating.
  ///
  /// In vi, this message translates to:
  /// **'Dừng'**
  String get stopGenerating;

  /// No description provided for @aiThinking.
  ///
  /// In vi, this message translates to:
  /// **'AI đang trả lời...'**
  String get aiThinking;

  /// No description provided for @codeMentor.
  ///
  /// In vi, this message translates to:
  /// **'Code Mentor'**
  String get codeMentor;

  /// No description provided for @codeMentorDisclaimer.
  ///
  /// In vi, this message translates to:
  /// **'Code Mentor hướng dẫn, không làm hộ bài tập.'**
  String get codeMentorDisclaimer;

  /// No description provided for @assignmentRelated.
  ///
  /// In vi, this message translates to:
  /// **'Liên quan bài tập?'**
  String get assignmentRelated;

  /// No description provided for @askCodeMentor.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi Code Mentor'**
  String get askCodeMentor;

  /// No description provided for @languageLabel.
  ///
  /// In vi, this message translates to:
  /// **'Ngôn ngữ'**
  String get languageLabel;

  /// No description provided for @codeLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mã nguồn'**
  String get codeLabel;

  /// No description provided for @questionLabel.
  ///
  /// In vi, this message translates to:
  /// **'Câu hỏi'**
  String get questionLabel;

  /// No description provided for @emptyAssignmentsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có bài tập'**
  String get emptyAssignmentsTitle;

  /// No description provided for @emptyAssignmentsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Các bài tập mới sẽ hiện ở đây.'**
  String get emptyAssignmentsMessage;

  /// No description provided for @submitAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Nộp bài'**
  String get submitAssignment;

  /// No description provided for @downloadAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Tải đề bài'**
  String get downloadAssignment;

  /// No description provided for @submissionNote.
  ///
  /// In vi, this message translates to:
  /// **'Ghi chú (tuỳ chọn)'**
  String get submissionNote;

  /// No description provided for @pickFile.
  ///
  /// In vi, this message translates to:
  /// **'Chọn file'**
  String get pickFile;

  /// No description provided for @logout.
  ///
  /// In vi, this message translates to:
  /// **'Đăng xuất'**
  String get logout;

  /// No description provided for @profileSettings.
  ///
  /// In vi, this message translates to:
  /// **'Cài đặt'**
  String get profileSettings;

  /// No description provided for @safetyBadge.
  ///
  /// In vi, this message translates to:
  /// **'Đã giới hạn để bảo vệ mục tiêu học tập'**
  String get safetyBadge;

  /// No description provided for @reviewHelpful.
  ///
  /// In vi, this message translates to:
  /// **'Hữu ích'**
  String get reviewHelpful;

  /// No description provided for @reviewWrong.
  ///
  /// In vi, this message translates to:
  /// **'Sai'**
  String get reviewWrong;

  /// No description provided for @reviewReport.
  ///
  /// In vi, this message translates to:
  /// **'Báo lỗi'**
  String get reviewReport;

  /// No description provided for @reviewSuggest.
  ///
  /// In vi, this message translates to:
  /// **'Góp ý'**
  String get reviewSuggest;

  /// No description provided for @reviewSubmittedSnack.
  ///
  /// In vi, this message translates to:
  /// **'Cảm ơn phản hồi! AI chưa cập nhật ngay từ đánh giá này.'**
  String get reviewSubmittedSnack;

  /// No description provided for @reviewSubmittedSnackMentor.
  ///
  /// In vi, this message translates to:
  /// **'Đã gửi phản hồi — mentor sẽ kiểm tra. AI chưa học từ review này.'**
  String get reviewSubmittedSnackMentor;

  /// No description provided for @reviewSubmittedSnackSenior.
  ///
  /// In vi, this message translates to:
  /// **'Đã gửi báo lỗi — Senior sẽ xem xét. AI chưa học từ review này.'**
  String get reviewSubmittedSnackSenior;

  /// No description provided for @reviewWrongDialogTitle.
  ///
  /// In vi, this message translates to:
  /// **'Báo câu trả lời sai'**
  String get reviewWrongDialogTitle;

  /// No description provided for @reviewReportDialogTitle.
  ///
  /// In vi, this message translates to:
  /// **'Báo lỗi nguồn hoặc tài liệu'**
  String get reviewReportDialogTitle;

  /// No description provided for @reviewFeedbackHint.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả vấn đề (mentor/senior sẽ kiểm tra)'**
  String get reviewFeedbackHint;

  /// No description provided for @reviewCorrectionHint.
  ///
  /// In vi, this message translates to:
  /// **'Gợi ý câu trả lời đúng (tuỳ chọn)'**
  String get reviewCorrectionHint;

  /// No description provided for @reviewFeedbackRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng mô tả vấn đề'**
  String get reviewFeedbackRequired;

  /// No description provided for @reviewSubmitFeedback.
  ///
  /// In vi, this message translates to:
  /// **'Gửi phản hồi'**
  String get reviewSubmitFeedback;

  /// No description provided for @reviewAlreadySubmitted.
  ///
  /// In vi, this message translates to:
  /// **'Đã gửi phản hồi'**
  String get reviewAlreadySubmitted;

  /// No description provided for @generatePlan.
  ///
  /// In vi, this message translates to:
  /// **'Tạo gợi ý mới'**
  String get generatePlan;

  /// No description provided for @completePlan.
  ///
  /// In vi, this message translates to:
  /// **'Đánh dấu hoàn thành'**
  String get completePlan;

  /// No description provided for @emptyPlanTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có kế hoạch cải thiện'**
  String get emptyPlanTitle;

  /// No description provided for @deleteConversation.
  ///
  /// In vi, this message translates to:
  /// **'Xóa'**
  String get deleteConversation;

  /// No description provided for @requestMentorSupport.
  ///
  /// In vi, this message translates to:
  /// **'Nhận hỗ trợ từ giảng viên/mentor'**
  String get requestMentorSupport;

  /// No description provided for @escalationOfferTitle.
  ///
  /// In vi, this message translates to:
  /// **'Đề xuất người hỗ trợ'**
  String get escalationOfferTitle;

  /// No description provided for @escalationOfferHeading.
  ///
  /// In vi, this message translates to:
  /// **'Chọn người hỗ trợ'**
  String get escalationOfferHeading;

  /// No description provided for @escalationClassTeacherHint.
  ///
  /// In vi, this message translates to:
  /// **'Giảng viên lớp của bạn sẽ hỗ trợ bạn xác minh câu trả lời.'**
  String get escalationClassTeacherHint;

  /// No description provided for @escalationMatchingHint.
  ///
  /// In vi, this message translates to:
  /// **'Chúng tôi gợi ý mentor phù hợp nhất với câu hỏi của bạn.'**
  String get escalationMatchingHint;

  /// No description provided for @originalQuestion.
  ///
  /// In vi, this message translates to:
  /// **'Câu hỏi gốc'**
  String get originalQuestion;

  /// No description provided for @suggestedMentors.
  ///
  /// In vi, this message translates to:
  /// **'Người hỗ trợ đề xuất'**
  String get suggestedMentors;

  /// No description provided for @noMentorsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có mentor khả dụng'**
  String get noMentorsTitle;

  /// No description provided for @noMentorsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Thử lại sau hoặc huỷ yêu cầu hỗ trợ.'**
  String get noMentorsMessage;

  /// No description provided for @cancelEscalation.
  ///
  /// In vi, this message translates to:
  /// **'Huỷ yêu cầu'**
  String get cancelEscalation;

  /// No description provided for @liveChatTitle.
  ///
  /// In vi, this message translates to:
  /// **'Trò chuyện trực tiếp'**
  String get liveChatTitle;

  /// No description provided for @liveChatInputHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhắn cho mentor...'**
  String get liveChatInputHint;

  /// No description provided for @liveChatEmptyTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu trò chuyện'**
  String get liveChatEmptyTitle;

  /// No description provided for @liveChatEmptyMessage.
  ///
  /// In vi, this message translates to:
  /// **'Gửi tin nhắn để trao đổi với giảng viên/mentor về câu hỏi của bạn.'**
  String get liveChatEmptyMessage;

  /// No description provided for @liveChatAiPreviewLabel.
  ///
  /// In vi, this message translates to:
  /// **'Phản hồi AI (tham khảo)'**
  String get liveChatAiPreviewLabel;

  /// No description provided for @liveChatOnline.
  ///
  /// In vi, this message translates to:
  /// **'Trực tuyến'**
  String get liveChatOnline;

  /// No description provided for @chatRoomClosed.
  ///
  /// In vi, this message translates to:
  /// **'Phòng chat đã đóng — chỉ xem lại tin nhắn.'**
  String get chatRoomClosed;

  /// No description provided for @escalationContext.
  ///
  /// In vi, this message translates to:
  /// **'Ngữ cảnh câu hỏi'**
  String get escalationContext;

  /// No description provided for @closeChatTitle.
  ///
  /// In vi, this message translates to:
  /// **'Kết thúc trò chuyện'**
  String get closeChatTitle;

  /// No description provided for @rateMentor.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá mentor'**
  String get rateMentor;

  /// No description provided for @feedbackLabel.
  ///
  /// In vi, this message translates to:
  /// **'Phản hồi (tuỳ chọn)'**
  String get feedbackLabel;

  /// No description provided for @closeChatConfirm.
  ///
  /// In vi, this message translates to:
  /// **'Đóng phòng chat'**
  String get closeChatConfirm;

  /// No description provided for @escalationHistoryTitle.
  ///
  /// In vi, this message translates to:
  /// **'Lịch sử hỗ trợ'**
  String get escalationHistoryTitle;

  /// No description provided for @emptyEscalationHistoryTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có lịch sử hỗ trợ'**
  String get emptyEscalationHistoryTitle;

  /// No description provided for @emptyEscalationHistoryMessage.
  ///
  /// In vi, this message translates to:
  /// **'Các yêu cầu escalate sẽ hiện ở đây.'**
  String get emptyEscalationHistoryMessage;

  /// No description provided for @viewEscalationHistory.
  ///
  /// In vi, this message translates to:
  /// **'Lịch sử hỗ trợ escalate'**
  String get viewEscalationHistory;

  /// No description provided for @teacherGreeting.
  ///
  /// In vi, this message translates to:
  /// **'Xin chào, {name}'**
  String teacherGreeting(String name);

  /// No description provided for @statClasses.
  ///
  /// In vi, this message translates to:
  /// **'Lớp đang dạy'**
  String get statClasses;

  /// No description provided for @teacherQuizTitle.
  ///
  /// In vi, this message translates to:
  /// **'Quiz AI'**
  String get teacherQuizTitle;

  /// No description provided for @teacherQuizSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Tạo quiz bằng AI và giao cho sinh viên luyện tập'**
  String get teacherQuizSubtitle;

  /// No description provided for @teacherQuizManage.
  ///
  /// In vi, this message translates to:
  /// **'Quản lý Quiz AI'**
  String get teacherQuizManage;

  /// No description provided for @statEscalations.
  ///
  /// In vi, this message translates to:
  /// **'Escalation chờ'**
  String get statEscalations;

  /// No description provided for @statGrading.
  ///
  /// In vi, this message translates to:
  /// **'Bài cần chấm'**
  String get statGrading;

  /// No description provided for @statReviews.
  ///
  /// In vi, this message translates to:
  /// **'Review chờ'**
  String get statReviews;

  /// No description provided for @weakTopicsAllClasses.
  ///
  /// In vi, this message translates to:
  /// **'Điểm yếu toàn lớp'**
  String get weakTopicsAllClasses;

  /// No description provided for @emptyWeakTopicsChart.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có dữ liệu điểm yếu.'**
  String get emptyWeakTopicsChart;

  /// No description provided for @todayTasks.
  ///
  /// In vi, this message translates to:
  /// **'Cần xử lý hôm nay'**
  String get todayTasks;

  /// No description provided for @emptyTodayTasksTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có việc gấp'**
  String get emptyTodayTasksTitle;

  /// No description provided for @emptyTodayTasksMessage.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đã xử lý xong các hạng mục ưu tiên.'**
  String get emptyTodayTasksMessage;

  /// No description provided for @emptyClassesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có lớp học'**
  String get emptyClassesTitle;

  /// No description provided for @emptyClassesMessage.
  ///
  /// In vi, this message translates to:
  /// **'Liên hệ quản trị để được gán lớp.'**
  String get emptyClassesMessage;

  /// No description provided for @studentCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} sinh viên'**
  String studentCount(int count);

  /// No description provided for @viewRoster.
  ///
  /// In vi, this message translates to:
  /// **'Xem danh sách'**
  String get viewRoster;

  /// No description provided for @rosterTitle.
  ///
  /// In vi, this message translates to:
  /// **'Danh sách lớp'**
  String get rosterTitle;

  /// No description provided for @emptyRosterTitle.
  ///
  /// In vi, this message translates to:
  /// **'Lớp chưa có sinh viên'**
  String get emptyRosterTitle;

  /// No description provided for @emptyRosterMessage.
  ///
  /// In vi, this message translates to:
  /// **'Sinh viên sẽ hiện khi được thêm vào lớp.'**
  String get emptyRosterMessage;

  /// No description provided for @inboxLiveChat.
  ///
  /// In vi, this message translates to:
  /// **'Live chat'**
  String get inboxLiveChat;

  /// No description provided for @inboxEscalations.
  ///
  /// In vi, this message translates to:
  /// **'Escalation'**
  String get inboxEscalations;

  /// No description provided for @inboxReviews.
  ///
  /// In vi, this message translates to:
  /// **'Review mentor'**
  String get inboxReviews;

  /// No description provided for @emptyLiveChatTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có chat đang mở'**
  String get emptyLiveChatTitle;

  /// No description provided for @emptyLiveChatMessage.
  ///
  /// In vi, this message translates to:
  /// **'Cuộc trò chuyện trực tiếp sẽ hiện ở đây.'**
  String get emptyLiveChatMessage;

  /// No description provided for @openLiveChat.
  ///
  /// In vi, this message translates to:
  /// **'Mở trò chuyện'**
  String get openLiveChat;

  /// No description provided for @emptyEscalationInboxTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có escalation chờ'**
  String get emptyEscalationInboxTitle;

  /// No description provided for @emptyEscalationInboxMessage.
  ///
  /// In vi, this message translates to:
  /// **'Các câu hỏi cần trả lời sẽ hiện ở đây.'**
  String get emptyEscalationInboxMessage;

  /// No description provided for @aiResponseLabel.
  ///
  /// In vi, this message translates to:
  /// **'Câu trả lời AI'**
  String get aiResponseLabel;

  /// No description provided for @answerEscalation.
  ///
  /// In vi, this message translates to:
  /// **'Trả lời escalation'**
  String get answerEscalation;

  /// No description provided for @emptyReviewQueueTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có review chờ'**
  String get emptyReviewQueueTitle;

  /// No description provided for @emptyReviewQueueMessage.
  ///
  /// In vi, this message translates to:
  /// **'Các câu trả lời AI bị dispute sẽ hiện ở đây.'**
  String get emptyReviewQueueMessage;

  /// No description provided for @reviewQueueHint.
  ///
  /// In vi, this message translates to:
  /// **'Giải thích lại cho sinh viên qua live chat — review không tự train AI.'**
  String get reviewQueueHint;

  /// No description provided for @studentFallback.
  ///
  /// In vi, this message translates to:
  /// **'Sinh viên'**
  String get studentFallback;

  /// No description provided for @answerEscalationTitle.
  ///
  /// In vi, this message translates to:
  /// **'Trả lời escalation'**
  String get answerEscalationTitle;

  /// No description provided for @escalationNotFound.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy escalation. Quay lại hộp thư và thử lại.'**
  String get escalationNotFound;

  /// No description provided for @yourAnswerLabel.
  ///
  /// In vi, this message translates to:
  /// **'Câu trả lời của bạn'**
  String get yourAnswerLabel;

  /// No description provided for @yourAnswerHint.
  ///
  /// In vi, this message translates to:
  /// **'Viết hướng dẫn rõ ràng cho sinh viên...'**
  String get yourAnswerHint;

  /// No description provided for @answerRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập câu trả lời.'**
  String get answerRequired;

  /// No description provided for @proposeKnowledgeToggle.
  ///
  /// In vi, this message translates to:
  /// **'Đề xuất làm tri thức cho AI?'**
  String get proposeKnowledgeToggle;

  /// No description provided for @proposeKnowledgeHint.
  ///
  /// In vi, this message translates to:
  /// **'Bật sẽ tạo candidate chờ Senior duyệt — không tự vào AI ngay.'**
  String get proposeKnowledgeHint;

  /// No description provided for @candidateTypeLabel.
  ///
  /// In vi, this message translates to:
  /// **'Loại tri thức'**
  String get candidateTypeLabel;

  /// No description provided for @candidateAcademic.
  ///
  /// In vi, this message translates to:
  /// **'Tri thức học thuật'**
  String get candidateAcademic;

  /// No description provided for @candidateMaterial.
  ///
  /// In vi, this message translates to:
  /// **'Sửa tài liệu'**
  String get candidateMaterial;

  /// No description provided for @candidateFaq.
  ///
  /// In vi, this message translates to:
  /// **'Làm rõ FAQ'**
  String get candidateFaq;

  /// No description provided for @submitAnswer.
  ///
  /// In vi, this message translates to:
  /// **'Gửi câu trả lời'**
  String get submitAnswer;

  /// No description provided for @answerSubmitted.
  ///
  /// In vi, this message translates to:
  /// **'Đã gửi câu trả lời.'**
  String get answerSubmitted;

  /// No description provided for @teacherAssignmentsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Quản lý bài tập'**
  String get teacherAssignmentsTitle;

  /// No description provided for @manageAssignments.
  ///
  /// In vi, this message translates to:
  /// **'Quản lý'**
  String get manageAssignments;

  /// No description provided for @classAssignmentsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bài tập lớp'**
  String get classAssignmentsTitle;

  /// No description provided for @createAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bài tập'**
  String get createAssignment;

  /// No description provided for @emptyTeacherAssignmentsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài tập'**
  String get emptyTeacherAssignmentsTitle;

  /// No description provided for @emptyTeacherAssignmentsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bài tập mới cho lớp này.'**
  String get emptyTeacherAssignmentsMessage;

  /// No description provided for @pendingGradeCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} bài chờ chấm'**
  String pendingGradeCount(int count);

  /// No description provided for @viewSubmissions.
  ///
  /// In vi, this message translates to:
  /// **'Xem bài nộp'**
  String get viewSubmissions;

  /// No description provided for @assignmentTitleLabel.
  ///
  /// In vi, this message translates to:
  /// **'Tiêu đề bài tập'**
  String get assignmentTitleLabel;

  /// No description provided for @assignmentDescLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả (tuỳ chọn)'**
  String get assignmentDescLabel;

  /// No description provided for @pickDueDate.
  ///
  /// In vi, this message translates to:
  /// **'Chọn hạn nộp'**
  String get pickDueDate;

  /// No description provided for @createAssignmentValidation.
  ///
  /// In vi, this message translates to:
  /// **'Nhập tiêu đề và chọn file đề bài.'**
  String get createAssignmentValidation;

  /// No description provided for @submissionsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bài nộp'**
  String get submissionsTitle;

  /// No description provided for @emptySubmissionsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài nộp'**
  String get emptySubmissionsTitle;

  /// No description provided for @emptySubmissionsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Sinh viên chưa nộp bài nào.'**
  String get emptySubmissionsMessage;

  /// No description provided for @gradeSubmissionTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chấm bài'**
  String get gradeSubmissionTitle;

  /// No description provided for @submissionNotFound.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy bài nộp.'**
  String get submissionNotFound;

  /// No description provided for @downloadSubmission.
  ///
  /// In vi, this message translates to:
  /// **'Tải bài nộp'**
  String get downloadSubmission;

  /// No description provided for @scoreLabel.
  ///
  /// In vi, this message translates to:
  /// **'Điểm'**
  String get scoreLabel;

  /// No description provided for @scoreRequired.
  ///
  /// In vi, this message translates to:
  /// **'Nhập điểm hợp lệ.'**
  String get scoreRequired;

  /// No description provided for @weakTopicHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập chủ đề yếu'**
  String get weakTopicHint;

  /// No description provided for @addWeakTopic.
  ///
  /// In vi, this message translates to:
  /// **'Thêm'**
  String get addWeakTopic;

  /// No description provided for @submitGrade.
  ///
  /// In vi, this message translates to:
  /// **'Lưu điểm'**
  String get submitGrade;

  /// No description provided for @gradeSubmitted.
  ///
  /// In vi, this message translates to:
  /// **'Đã lưu điểm.'**
  String get gradeSubmitted;

  /// No description provided for @editAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Sửa bài tập'**
  String get editAssignment;

  /// No description provided for @deleteAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Xoá bài tập'**
  String get deleteAssignment;

  /// No description provided for @deleteAssignmentConfirm.
  ///
  /// In vi, this message translates to:
  /// **'Xoá bài tập \"{title}\"? Chỉ xoá được khi chưa có bài nộp.'**
  String deleteAssignmentConfirm(String title);

  /// No description provided for @classSubmissionsSummary.
  ///
  /// In vi, this message translates to:
  /// **'Tổng hợp bài nộp cả lớp'**
  String get classSubmissionsSummary;

  /// No description provided for @notificationsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Thông báo'**
  String get notificationsTitle;

  /// No description provided for @notificationsSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Tổng hợp từ chat, bài tập và hàng đợi'**
  String get notificationsSubtitle;

  /// No description provided for @emptyNotificationsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có thông báo'**
  String get emptyNotificationsTitle;

  /// No description provided for @emptyNotificationsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Mọi thứ đã được cập nhật.'**
  String get emptyNotificationsMessage;

  /// No description provided for @appearanceTitle.
  ///
  /// In vi, this message translates to:
  /// **'Giao diện'**
  String get appearanceTitle;

  /// No description provided for @themeLight.
  ///
  /// In vi, this message translates to:
  /// **'Sáng'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In vi, this message translates to:
  /// **'Tối'**
  String get themeDark;

  /// No description provided for @themeSystem.
  ///
  /// In vi, this message translates to:
  /// **'Theo hệ thống'**
  String get themeSystem;

  /// No description provided for @seniorSectionTitle.
  ///
  /// In vi, this message translates to:
  /// **'Senior / Admin'**
  String get seniorSectionTitle;

  /// No description provided for @seniorReviewQueueTitle.
  ///
  /// In vi, this message translates to:
  /// **'Review chờ Senior'**
  String get seniorReviewQueueTitle;

  /// No description provided for @emptySeniorReviewsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có review chờ'**
  String get emptySeniorReviewsTitle;

  /// No description provided for @emptySeniorReviewsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Các dispute cần Senior sẽ hiện ở đây.'**
  String get emptySeniorReviewsMessage;

  /// No description provided for @resolveReview.
  ///
  /// In vi, this message translates to:
  /// **'Xử lý review'**
  String get resolveReview;

  /// No description provided for @resolveReviewTitle.
  ///
  /// In vi, this message translates to:
  /// **'Phân giải review'**
  String get resolveReviewTitle;

  /// No description provided for @decisionApproveFeedback.
  ///
  /// In vi, this message translates to:
  /// **'Chấp nhận phản hồi'**
  String get decisionApproveFeedback;

  /// No description provided for @decisionRejectFeedback.
  ///
  /// In vi, this message translates to:
  /// **'Từ chối phản hồi'**
  String get decisionRejectFeedback;

  /// No description provided for @decisionCreateCandidate.
  ///
  /// In vi, this message translates to:
  /// **'Tạo knowledge candidate'**
  String get decisionCreateCandidate;

  /// No description provided for @reviewNotesLabel.
  ///
  /// In vi, this message translates to:
  /// **'Ghi chú review'**
  String get reviewNotesLabel;

  /// No description provided for @correctedAnswerLabel.
  ///
  /// In vi, this message translates to:
  /// **'Câu trả lời đã sửa'**
  String get correctedAnswerLabel;

  /// No description provided for @createCandidateFromReview.
  ///
  /// In vi, this message translates to:
  /// **'Tạo candidate từ câu trả lời sửa'**
  String get createCandidateFromReview;

  /// No description provided for @submitResolution.
  ///
  /// In vi, this message translates to:
  /// **'Gửi quyết định'**
  String get submitResolution;

  /// No description provided for @knowledgeCandidatesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Tri thức chờ duyệt'**
  String get knowledgeCandidatesTitle;

  /// No description provided for @emptyCandidatesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có candidate chờ'**
  String get emptyCandidatesTitle;

  /// No description provided for @emptyCandidatesMessage.
  ///
  /// In vi, this message translates to:
  /// **'Candidate mới sẽ hiện khi mentor/GV đề xuất.'**
  String get emptyCandidatesMessage;

  /// No description provided for @candidateDetailTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chi tiết candidate'**
  String get candidateDetailTitle;

  /// No description provided for @candidateNotFound.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy candidate.'**
  String get candidateNotFound;

  /// No description provided for @aiLearningGateNotice.
  ///
  /// In vi, this message translates to:
  /// **'Đây là cổng duy nhất AI được học — mọi candidate cần Senior duyệt trước khi vào RAG.'**
  String get aiLearningGateNotice;

  /// No description provided for @proposedAnswerLabel.
  ///
  /// In vi, this message translates to:
  /// **'Câu trả lời đề xuất'**
  String get proposedAnswerLabel;

  /// No description provided for @contentOverrideLabel.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung index (tuỳ chọn)'**
  String get contentOverrideLabel;

  /// No description provided for @rejectionReasonLabel.
  ///
  /// In vi, this message translates to:
  /// **'Lý do từ chối'**
  String get rejectionReasonLabel;

  /// No description provided for @rejectionReasonRequired.
  ///
  /// In vi, this message translates to:
  /// **'Nhập lý do từ chối.'**
  String get rejectionReasonRequired;

  /// No description provided for @approveIndexRag.
  ///
  /// In vi, this message translates to:
  /// **'Duyệt — Index vào RAG'**
  String get approveIndexRag;

  /// No description provided for @rejectCandidate.
  ///
  /// In vi, this message translates to:
  /// **'Từ chối candidate'**
  String get rejectCandidate;

  /// No description provided for @candidateApproved.
  ///
  /// In vi, this message translates to:
  /// **'Đã duyệt và index vào AI.'**
  String get candidateApproved;

  /// No description provided for @candidateRejected.
  ///
  /// In vi, this message translates to:
  /// **'Đã từ chối candidate.'**
  String get candidateRejected;

  /// No description provided for @cannotApproveOwnCandidate.
  ///
  /// In vi, this message translates to:
  /// **'Bạn không thể duyệt candidate do chính mình tạo.'**
  String get cannotApproveOwnCandidate;

  /// No description provided for @pendingItemsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} mục đang chờ'**
  String pendingItemsCount(int count);

  /// No description provided for @noPendingItems.
  ///
  /// In vi, this message translates to:
  /// **'Không có mục chờ'**
  String get noPendingItems;

  /// No description provided for @cancelAction.
  ///
  /// In vi, this message translates to:
  /// **'Huỷ'**
  String get cancelAction;

  /// No description provided for @editProfileTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chỉnh sửa hồ sơ'**
  String get editProfileTitle;

  /// No description provided for @fullNameRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập họ và tên'**
  String get fullNameRequired;

  /// No description provided for @profileUpdated.
  ///
  /// In vi, this message translates to:
  /// **'Đã cập nhật hồ sơ'**
  String get profileUpdated;

  /// No description provided for @saveChanges.
  ///
  /// In vi, this message translates to:
  /// **'Lưu thay đổi'**
  String get saveChanges;

  /// No description provided for @bioLabel.
  ///
  /// In vi, this message translates to:
  /// **'Giới thiệu'**
  String get bioLabel;

  /// No description provided for @addressLabel.
  ///
  /// In vi, this message translates to:
  /// **'Địa chỉ'**
  String get addressLabel;

  /// No description provided for @cityLabel.
  ///
  /// In vi, this message translates to:
  /// **'Thành phố'**
  String get cityLabel;

  /// No description provided for @teacherMaterialsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Quản lý tài liệu'**
  String get teacherMaterialsTitle;

  /// No description provided for @uploadMaterial.
  ///
  /// In vi, this message translates to:
  /// **'Tải tài liệu lên'**
  String get uploadMaterial;

  /// No description provided for @materialTitleLabel.
  ///
  /// In vi, this message translates to:
  /// **'Tiêu đề tài liệu'**
  String get materialTitleLabel;

  /// No description provided for @uploadMaterialValidation.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập tiêu đề và chọn file'**
  String get uploadMaterialValidation;

  /// No description provided for @emptyTeacherMaterialsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có tài liệu'**
  String get emptyTeacherMaterialsTitle;

  /// No description provided for @emptyTeacherMaterialsMessage.
  ///
  /// In vi, this message translates to:
  /// **'Tải tài liệu lên để AI và sinh viên sử dụng.'**
  String get emptyTeacherMaterialsMessage;

  /// No description provided for @viewPdf.
  ///
  /// In vi, this message translates to:
  /// **'Xem PDF'**
  String get viewPdf;

  /// No description provided for @reindexMaterial.
  ///
  /// In vi, this message translates to:
  /// **'Lập chỉ mục lại'**
  String get reindexMaterial;

  /// No description provided for @deleteMaterial.
  ///
  /// In vi, this message translates to:
  /// **'Xoá tài liệu'**
  String get deleteMaterial;

  /// No description provided for @deleteMaterialConfirm.
  ///
  /// In vi, this message translates to:
  /// **'Xoá \"{title}\"? Hành động này không thể hoàn tác.'**
  String deleteMaterialConfirm(String title);

  /// No description provided for @materialDeleted.
  ///
  /// In vi, this message translates to:
  /// **'Đã xoá tài liệu'**
  String get materialDeleted;

  /// No description provided for @materialReindexed.
  ///
  /// In vi, this message translates to:
  /// **'Đã lập chỉ mục lại tài liệu'**
  String get materialReindexed;

  /// No description provided for @materialUploaded.
  ///
  /// In vi, this message translates to:
  /// **'Đã tải tài liệu lên'**
  String get materialUploaded;

  /// No description provided for @importFromUrl.
  ///
  /// In vi, this message translates to:
  /// **'Import từ URL'**
  String get importFromUrl;

  /// No description provided for @importUrlHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập URL trang tài liệu HTML (vd. javadoc, docs online) để xem trước mục lục rồi chọn phần cần import.'**
  String get importUrlHint;

  /// No description provided for @importUrlLabel.
  ///
  /// In vi, this message translates to:
  /// **'URL tài liệu HTML'**
  String get importUrlLabel;

  /// No description provided for @importUrlRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập URL'**
  String get importUrlRequired;

  /// No description provided for @previewToc.
  ///
  /// In vi, this message translates to:
  /// **'Xem mục lục'**
  String get previewToc;

  /// No description provided for @importUrlNoToc.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy mục lục trên trang này. Bạn có thể import trực tiếp trang này, tuỳ chọn theo dõi các liên kết \"Next\" để lấy thêm trang.'**
  String get importUrlNoToc;

  /// No description provided for @importUrlFollowNext.
  ///
  /// In vi, this message translates to:
  /// **'Tự động lấy các trang \"Next\" tiếp theo'**
  String get importUrlFollowNext;

  /// No description provided for @importUrlSelectPages.
  ///
  /// In vi, this message translates to:
  /// **'Chọn trang cần import ({count} trang)'**
  String importUrlSelectPages(int count);

  /// No description provided for @importUrlSelectAll.
  ///
  /// In vi, this message translates to:
  /// **'Chọn tất cả'**
  String get importUrlSelectAll;

  /// No description provided for @importUrlDeselectAll.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ chọn tất cả'**
  String get importUrlDeselectAll;

  /// No description provided for @editMaterialTitle.
  ///
  /// In vi, this message translates to:
  /// **'Sửa thông tin'**
  String get editMaterialTitle;

  /// No description provided for @materialCategoryLabel.
  ///
  /// In vi, this message translates to:
  /// **'Danh mục (tuỳ chọn)'**
  String get materialCategoryLabel;

  /// No description provided for @courseDetailSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'{courseName} · {percent}% hoàn thành'**
  String courseDetailSubtitle(String courseName, int percent);

  /// No description provided for @courseInfoTab.
  ///
  /// In vi, this message translates to:
  /// **'Thông tin'**
  String get courseInfoTab;

  /// No description provided for @courseProgressLabel.
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ môn học: {percent}%'**
  String courseProgressLabel(int percent);

  /// No description provided for @materialsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} tài liệu'**
  String materialsCount(int count);

  /// No description provided for @materialsRagCount.
  ///
  /// In vi, this message translates to:
  /// **'✓ {count} đã vào RAG'**
  String materialsRagCount(int count);

  /// No description provided for @materialIndexing.
  ///
  /// In vi, this message translates to:
  /// **'Đang index...'**
  String get materialIndexing;

  /// No description provided for @materialReady.
  ///
  /// In vi, this message translates to:
  /// **'Sẵn sàng'**
  String get materialReady;

  /// No description provided for @materialPagesUnit.
  ///
  /// In vi, this message translates to:
  /// **'trang'**
  String get materialPagesUnit;

  /// No description provided for @materialSlidesUnit.
  ///
  /// In vi, this message translates to:
  /// **'slide'**
  String get materialSlidesUnit;

  /// No description provided for @materialNotFound.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy tài liệu'**
  String get materialNotFound;

  /// No description provided for @materialDefaultCategory.
  ///
  /// In vi, this message translates to:
  /// **'TÀI LIỆU'**
  String get materialDefaultCategory;

  /// No description provided for @materialReaderHint.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung bài đọc được lấy từ tài liệu môn học. Bạn có thể mở file PDF để đọc đầy đủ hoặc hỏi Cóc về phần đang học.'**
  String get materialReaderHint;

  /// No description provided for @openMaterialPdf.
  ///
  /// In vi, this message translates to:
  /// **'Mở file PDF'**
  String get openMaterialPdf;

  /// No description provided for @materialHighlightHint.
  ///
  /// In vi, this message translates to:
  /// **'Highlight để hỏi Cóc về đoạn vừa đọc.'**
  String get materialHighlightHint;

  /// No description provided for @materialAskHint.
  ///
  /// In vi, this message translates to:
  /// **'Hỏi Cóc về trang {page}...'**
  String materialAskHint(int page);

  /// No description provided for @assignmentFilterPending.
  ///
  /// In vi, this message translates to:
  /// **'Cần nộp • {count}'**
  String assignmentFilterPending(int count);

  /// No description provided for @assignmentFilterSubmitted.
  ///
  /// In vi, this message translates to:
  /// **'Đã nộp'**
  String get assignmentFilterSubmitted;

  /// No description provided for @assignmentFilterReviewed.
  ///
  /// In vi, this message translates to:
  /// **'Đã chấm'**
  String get assignmentFilterReviewed;

  /// No description provided for @assignmentStatusPending.
  ///
  /// In vi, this message translates to:
  /// **'Chưa nộp'**
  String get assignmentStatusPending;

  /// No description provided for @assignmentStatusSubmitted.
  ///
  /// In vi, this message translates to:
  /// **'Đã nộp'**
  String get assignmentStatusSubmitted;

  /// No description provided for @assignmentStatusReviewed.
  ///
  /// In vi, this message translates to:
  /// **'Đã chấm'**
  String get assignmentStatusReviewed;

  /// No description provided for @viewAssignment.
  ///
  /// In vi, this message translates to:
  /// **'Xem'**
  String get viewAssignment;

  /// No description provided for @assignmentNotFound.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy bài tập'**
  String get assignmentNotFound;

  /// No description provided for @assignmentDownloadSuccess.
  ///
  /// In vi, this message translates to:
  /// **'Đã tải đề bài'**
  String get assignmentDownloadSuccess;

  /// No description provided for @assignmentNoAttachment.
  ///
  /// In vi, this message translates to:
  /// **'Bài tập chưa có file đính kèm'**
  String get assignmentNoAttachment;

  /// No description provided for @assignmentGradeLabel.
  ///
  /// In vi, this message translates to:
  /// **'Điểm bài tập'**
  String get assignmentGradeLabel;

  /// No description provided for @submitAssignmentTitle.
  ///
  /// In vi, this message translates to:
  /// **'Nộp bài'**
  String get submitAssignmentTitle;

  /// No description provided for @submitDeadlineLabel.
  ///
  /// In vi, this message translates to:
  /// **'Hạn còn {time}'**
  String submitDeadlineLabel(String time);

  /// No description provided for @submitFileLabel.
  ///
  /// In vi, this message translates to:
  /// **'File nộp'**
  String get submitFileLabel;

  /// No description provided for @submitPickFile.
  ///
  /// In vi, this message translates to:
  /// **'Chọn file để tải lên'**
  String get submitPickFile;

  /// No description provided for @submitFileTypes.
  ///
  /// In vi, this message translates to:
  /// **'.java .zip .pdf · tối đa 25 MB'**
  String get submitFileTypes;

  /// No description provided for @submitNoteLabel.
  ///
  /// In vi, this message translates to:
  /// **'Ghi chú cho giảng viên'**
  String get submitNoteLabel;

  /// No description provided for @submitNoteHint.
  ///
  /// In vi, this message translates to:
  /// **'Em đã hoàn thành 3 lớp con. Phần tính diện tích hình tròn em chưa chắc...'**
  String get submitNoteHint;

  /// No description provided for @submitConfirm.
  ///
  /// In vi, this message translates to:
  /// **'Xác nhận nộp bài'**
  String get submitConfirm;

  /// No description provided for @submitResubmitHint.
  ///
  /// In vi, this message translates to:
  /// **'Bạn có thể nộp lại trước khi hết hạn.'**
  String get submitResubmitHint;

  /// No description provided for @submitAttached.
  ///
  /// In vi, this message translates to:
  /// **'đã đính kèm'**
  String get submitAttached;

  /// No description provided for @improvePlanTitle.
  ///
  /// In vi, this message translates to:
  /// **'Kế hoạch cải thiện'**
  String get improvePlanTitle;

  /// No description provided for @improvePlanSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'{courseCode} · Cóc gợi ý cho bạn'**
  String improvePlanSubtitle(String courseCode);

  /// No description provided for @improvePlanDefaultSummary.
  ///
  /// In vi, this message translates to:
  /// **'Bạn yếu ở một số chủ đề. Hoàn thành kế hoạch để nâng điểm cuối kỳ.'**
  String get improvePlanDefaultSummary;

  /// No description provided for @improveTopicsHeading.
  ///
  /// In vi, this message translates to:
  /// **'CHỦ ĐỀ CẦN CỦNG CỐ'**
  String get improveTopicsHeading;

  /// No description provided for @improveRoadmapHeading.
  ///
  /// In vi, this message translates to:
  /// **'LỘ TRÌNH 3 BƯỚC'**
  String get improveRoadmapHeading;

  /// No description provided for @learnNow.
  ///
  /// In vi, this message translates to:
  /// **'Học ngay'**
  String get learnNow;

  /// No description provided for @pinSuggestion.
  ///
  /// In vi, this message translates to:
  /// **'Ghim gợi ý'**
  String get pinSuggestion;

  /// No description provided for @unpinSuggestion.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ ghim'**
  String get unpinSuggestion;

  /// No description provided for @riskLevelLabel.
  ///
  /// In vi, this message translates to:
  /// **'MỨC RỦI RO: {level}'**
  String riskLevelLabel(String level);

  /// No description provided for @riskLevelHigh.
  ///
  /// In vi, this message translates to:
  /// **'CAO'**
  String get riskLevelHigh;

  /// No description provided for @riskLevelMedium.
  ///
  /// In vi, this message translates to:
  /// **'TRUNG BÌNH'**
  String get riskLevelMedium;

  /// No description provided for @riskLevelLow.
  ///
  /// In vi, this message translates to:
  /// **'THẤP'**
  String get riskLevelLow;

  /// No description provided for @planStepCompleted.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành'**
  String get planStepCompleted;

  /// No description provided for @planStepInProgress.
  ///
  /// In vi, this message translates to:
  /// **'Đang làm'**
  String get planStepInProgress;

  /// No description provided for @planStepNotStarted.
  ///
  /// In vi, this message translates to:
  /// **'Chưa bắt đầu'**
  String get planStepNotStarted;

  /// No description provided for @profileStreakStat.
  ///
  /// In vi, this message translates to:
  /// **'Streak'**
  String get profileStreakStat;

  /// No description provided for @profileQuestionsStat.
  ///
  /// In vi, this message translates to:
  /// **'Câu hỏi'**
  String get profileQuestionsStat;

  /// No description provided for @profileCoursesStat.
  ///
  /// In vi, this message translates to:
  /// **'Môn học'**
  String get profileCoursesStat;

  /// No description provided for @profileHelpFeedback.
  ///
  /// In vi, this message translates to:
  /// **'Trợ giúp & Phản hồi'**
  String get profileHelpFeedback;

  /// No description provided for @profileHelpComingSoon.
  ///
  /// In vi, this message translates to:
  /// **'Tính năng trợ giúp đang được phát triển.'**
  String get profileHelpComingSoon;

  /// No description provided for @changePasswordTitle.
  ///
  /// In vi, this message translates to:
  /// **'Đổi mật khẩu'**
  String get changePasswordTitle;

  /// No description provided for @changePasswordCurrentLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu hiện tại'**
  String get changePasswordCurrentLabel;

  /// No description provided for @changePasswordNewLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu mới'**
  String get changePasswordNewLabel;

  /// No description provided for @changePasswordConfirmLabel.
  ///
  /// In vi, this message translates to:
  /// **'Xác nhận mật khẩu mới'**
  String get changePasswordConfirmLabel;

  /// No description provided for @changePasswordSaveBtn.
  ///
  /// In vi, this message translates to:
  /// **'Cập nhật mật khẩu'**
  String get changePasswordSaveBtn;

  /// No description provided for @changePasswordSuccess.
  ///
  /// In vi, this message translates to:
  /// **'Đổi mật khẩu thành công.'**
  String get changePasswordSuccess;

  /// No description provided for @changePasswordMismatch.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu mới không khớp.'**
  String get changePasswordMismatch;

  /// No description provided for @changePasswordTooShort.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu phải có ít nhất 6 ký tự.'**
  String get changePasswordTooShort;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
