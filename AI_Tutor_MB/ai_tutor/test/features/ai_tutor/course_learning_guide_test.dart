import 'package:ai_tutor/features/ai_tutor/application/ai_tutor_controller.dart';
import 'package:ai_tutor/features/ai_tutor/data/course_learning_guide.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the student learning-guide contract used by web', () {
    final guide = CourseLearningGuide.fromJson({
      'courseId': 'PRJ301',
      'courseName': 'Java Web Application Development',
      'status': 'FALLBACK',
      'source': 'SYLLABUS_PARSER',
      'welcomeMarkdown': '# Chào mừng bạn đến với môn PRJ301',
      'topics': [
        {'title': 'Servlet lifecycle', 'detail': 'init, service, destroy'},
        {'title': 'JSP and JSTL'},
      ],
      'keywords': ['Servlet', 'JSP'],
    });

    expect(guide.courseId, 'PRJ301');
    expect(guide.topicTitles, ['Servlet lifecycle', 'JSP and JSTL']);
    expect(guide.welcomeMarkdown, contains('PRJ301'));
  });

  test('reuses only an unused conversation in the selected course', () {
    const unused = AiConversation(
      id: 'unused',
      title: 'Cuộc trò chuyện mới',
      courseId: 'PRJ301',
      messageCount: 1,
    );
    const used = AiConversation(
      id: 'used',
      title: 'Servlet',
      courseId: 'PRJ301',
      userQuestionCount: 1,
    );
    const otherCourse = AiConversation(
      id: 'other',
      title: 'DBI',
      courseId: 'DBI202',
    );

    expect(
      isUnusedCourseConversation(
        unused,
        courseId: 'course-object-id',
        courseCode: 'PRJ301',
      ),
      isTrue,
    );
    expect(isUnusedCourseConversation(used, courseCode: 'PRJ301'), isFalse);
    expect(
      isUnusedCourseConversation(otherCourse, courseCode: 'PRJ301'),
      isFalse,
    );
  });
}
