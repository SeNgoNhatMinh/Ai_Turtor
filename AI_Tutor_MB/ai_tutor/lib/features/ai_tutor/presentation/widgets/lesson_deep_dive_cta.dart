import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/utils/study_suggestion_prompt.dart';
import '../../../../shared/widgets/fpt_button.dart';

class LessonDeepDiveCta extends StatelessWidget {
  const LessonDeepDiveCta({
    super.key,
    required this.question,
    required this.answer,
    this.onStudy,
    this.enabled = true,
  });

  final String question;
  final String answer;
  final ValueChanged<String>? onStudy;
  final bool enabled;

  static String promptFor(String question, String answer) {
    return buildDeepDiveListPrompt(question, answer);
  }

  @override
  Widget build(BuildContext context) {
    final prompt = promptFor(question, answer);
    if (prompt.isEmpty || onStudy == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(left: 44, bottom: Insets.md),
      child: Semantics(
        label: 'Học chuyên sâu bài vừa chọn',
        container: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Insets.md),
          decoration: BoxDecoration(
            color: AppColors.primaryWash,
            borderRadius: BorderRadius.circular(Radii.md),
            border: Border.all(color: AppColors.borderHairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Học chuyên sâu',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Gap(2),
              Text(
                'Muốn đào sâu bài vừa học? AI sẽ gợi ý thêm hướng từ tài liệu. Nếu đã hiểu, chọn Bài tiếp theo ở trên.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
              const Gap(Insets.sm),
              Text(
                'Gợi ý các khía cạnh sâu hơn của bài này, chưa nhảy sang bài kế.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textPrimary,
                  height: 1.35,
                ),
              ),
              const Gap(Insets.sm),
              FptButton(
                label: 'Học chuyên sâu bài này',
                icon: LucideIcons.sparkles,
                size: FptButtonSize.sm,
                variant: FptButtonVariant.tonal,
                onPressed: enabled ? () => onStudy!(prompt) : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
