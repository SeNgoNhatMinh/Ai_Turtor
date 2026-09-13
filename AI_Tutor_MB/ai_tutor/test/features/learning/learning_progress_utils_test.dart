import 'package:ai_tutor/features/learning/application/learning_progress_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses comma-separated topics', () {
    expect(parseTopicList('MVC, JPA; SQL\nREST'), [
      'MVC',
      'JPA',
      'SQL',
      'REST',
    ]);
  });

  test('computes mastery from learned versus weak topics', () {
    expect(
      masteryPercent(learnedTopics: ['A', 'B', 'C'], weakTopics: ['D']),
      75,
    );
    expect(masteryPercent(learnedTopics: [], weakTopics: []), 0);
  });
}
