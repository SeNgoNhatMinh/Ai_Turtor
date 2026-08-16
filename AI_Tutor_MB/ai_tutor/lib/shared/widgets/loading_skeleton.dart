import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:skeletonizer/skeletonizer.dart';

import '../../core/theme/app_tokens.dart';
import 'fpt_card.dart';

class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key, this.itemCount = 5});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Skeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          0,
        ),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const Gap(Insets.md),
        itemBuilder: (_, __) => const FptCard(
          child: ListTile(
            leading: CircleAvatar(),
            title: Text('Tiêu đề giả lập dài vừa phải'),
            subtitle: Text('Phụ đề • Chi tiết • Metadata'),
          ),
        ),
      ),
    );
  }
}
