import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'routes.dart';

extension SafeGoRouterPop on BuildContext {
  /// Quay lại màn trước nếu còn stack; nếu không thì [go] tới [fallback].
  void popOrGo(String fallback) {
    if (canPop()) {
      pop();
      return;
    }
    go(fallback);
  }

  /// Thoát màn live chat — ưu tiên pop stack, fallback theo role.
  void leaveLiveChat({String? role}) {
    if (canPop()) {
      pop();
      return;
    }
    final normalized = role?.toUpperCase() ?? '';
    if (normalized == 'TEACHER' ||
        normalized == 'SENIOR_MENTOR' ||
        normalized == 'MENTOR') {
      go(AppRoutes.teacherInbox);
      return;
    }
    go(AppRoutes.studentTutor);
  }
}
