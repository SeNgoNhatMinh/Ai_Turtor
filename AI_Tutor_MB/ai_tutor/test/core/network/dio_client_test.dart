import 'package:ai_tutor/core/network/dio_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('n8n workflow paths retain the webhook base path', () {
    const workflows = <String>[
      'student-chat',
      'answer-review',
      'quiz-generate',
      'quiz-submit',
      'teacher-answer-escalation',
      'senior-resolve-answer-review',
      'senior-knowledge-approval',
      'v2-coverage-analyze',
      'v2-gold-qa-submit',
      'v2-rubric-submit',
      'v2-gold-qa-approve',
      'v2-rubric-approve',
      'v2-eval-run',
    ];
    final base = normalizeN8nWebhookBase(
      'https://n8n-production-1b35.up.railway.app/webhook',
    );

    for (final workflow in workflows) {
      final uri = Uri.parse(
        base,
      ).resolve(normalizeN8nWorkflowPath('/$workflow'));
      expect(
        uri.toString(),
        'https://n8n-production-1b35.up.railway.app/webhook/$workflow',
      );
    }
  });
}
