import 'package:ai_tutor/features/quiz/application/quiz_topic_suggestions.dart';
import 'package:ai_tutor/shared/models/quiz.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('prioritizes weak topics then unique syllabus units like web', () {
    final topics = buildQuizTopicSuggestions(
      weakTopics: const ['Servlet lifecycle', 'AI learning plan', 'JSP'],
      curriculumTopics: const ['JSP', 'JDBC', 'Servlet lifecycle'],
    );

    expect(topics, ['Servlet lifecycle', 'JSP', 'JDBC']);
  });

  test('keeps quiz source provenance for later remediation', () {
    final question = QuizQuestion.fromJson({
      'questionId': 'q1',
      'questionText': 'Servlet lifecycle starts with which method?',
      'sourceMaterialIds': ['material-java-core'],
    });

    expect(question.sourceMaterialIds, ['material-java-core']);
    expect(question.toJson()['sourceMaterialIds'], ['material-java-core']);
  });
}
