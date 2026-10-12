import 'package:flutter_riverpod/flutter_riverpod.dart';

const studentLlmProviders = <StudentLlmProvider>[
  StudentLlmProvider(id: 'openrouter', label: 'OpenRouter'),
  StudentLlmProvider(id: 'groq', label: 'Groq'),
  StudentLlmProvider(id: 'openai', label: 'OpenAI'),
  StudentLlmProvider(id: 'nvidia', label: 'NVIDIA'),
];

class StudentLlmProvider {
  const StudentLlmProvider({required this.id, required this.label});

  final String id;
  final String label;
}

class StudentOwnLlmCredentials {
  const StudentOwnLlmCredentials({
    required this.userId,
    required this.provider,
    required this.model,
    required this.apiKey,
  });

  final String userId;
  final String provider;
  final String model;
  final String apiKey;

  bool get isReady =>
      userId.trim().isNotEmpty &&
      provider.trim().isNotEmpty &&
      model.trim().isNotEmpty &&
      apiKey.trim().isNotEmpty;

  bool matches(String? userId) {
    return isReady && this.userId.trim() == (userId ?? '').trim();
  }
}

StudentOwnLlmCredentials? parseStudentOwnLlm({
  required String userId,
  required String provider,
  required String model,
  required String apiKey,
}) {
  final value = StudentOwnLlmCredentials(
    userId: userId.trim(),
    provider: provider.trim(),
    model: model.trim(),
    apiKey: apiKey.trim(),
  );
  return value.isReady ? value : null;
}

class StudentOwnLlmController extends Notifier<StudentOwnLlmCredentials?> {
  @override
  StudentOwnLlmCredentials? build() => null;

  StudentOwnLlmCredentials? forUser(String userId) {
    final current = state;
    return current != null && current.matches(userId) ? current : null;
  }

  void save(StudentOwnLlmCredentials value) {
    state = value.isReady ? value : null;
  }

  void clear() {
    state = null;
  }
}

final studentOwnLlmProvider =
    NotifierProvider<StudentOwnLlmController, StudentOwnLlmCredentials?>(
      StudentOwnLlmController.new,
    );
