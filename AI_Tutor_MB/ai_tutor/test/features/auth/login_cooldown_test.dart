import 'package:ai_tutor/features/auth/presentation/login_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('blocks a second login tap inside the 900ms cooldown', () {
    expect(isLoginSubmitCoolingDown(lastSubmitAtMs: 1000, nowMs: 1899), isTrue);
    expect(
      isLoginSubmitCoolingDown(lastSubmitAtMs: 1000, nowMs: 1900),
      isFalse,
    );
  });
}
