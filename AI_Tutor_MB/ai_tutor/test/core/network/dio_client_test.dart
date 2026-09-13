import 'package:ai_tutor/core/network/dio_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('optional TTS 401 does not log the student out', () {
    expect(
      shouldLogoutOnUnauthorized(
        statusCode: 401,
        path: '/api/tts/voices',
        extra: const {skipUnauthorizedRedirectExtra: true},
      ),
      isFalse,
    );
    expect(
      shouldLogoutOnUnauthorized(
        statusCode: 401,
        path: '/api/tts/synthesize',
        extra: const {skipUnauthorizedRedirectExtra: true},
      ),
      isFalse,
    );
  });

  test('a real 401 on a required API still logs the student out', () {
    expect(
      shouldLogoutOnUnauthorized(
        statusCode: 401,
        path: '/api/ai/conversations',
      ),
      isTrue,
    );
    expect(
      shouldLogoutOnUnauthorized(statusCode: 401, path: '/api/users/login'),
      isFalse,
    );
    expect(
      shouldLogoutOnUnauthorized(statusCode: 403, path: '/api/tts/voices'),
      isFalse,
    );
  });

  test('n8n workflow paths retain the webhook base path', () {
    const workflows = <String>[
      'student-chat',
      'answer-review',
      'quiz-generate',
      'quiz-submit',
      'teacher-answer-escalation',
      'senior-resolve-answer-review',
      'senior-knowledge-approval',
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
