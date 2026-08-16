import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'realtime_providers.dart';

/// Widget gốc — giữ WebSocket events + listener refresh toàn app.
class RealtimeBootstrap extends ConsumerWidget {
  const RealtimeBootstrap({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(realtimeConnectionProvider);
    ref.watch(realtimeRefreshListenerProvider);
    return child;
  }
}
