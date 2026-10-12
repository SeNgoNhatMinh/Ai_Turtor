import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../data/student_own_llm.dart';

Future<void> showStudentOwnLlmSheet(
  BuildContext context, {
  required String userId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
    ),
    builder: (context) => StudentOwnLlmSheet(userId: userId),
  );
}

class StudentOwnLlmSheet extends ConsumerStatefulWidget {
  const StudentOwnLlmSheet({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<StudentOwnLlmSheet> createState() => _StudentOwnLlmSheetState();
}

class _StudentOwnLlmSheetState extends ConsumerState<StudentOwnLlmSheet> {
  late final TextEditingController _modelController;
  late final TextEditingController _keyController;
  late String _provider;

  @override
  void initState() {
    super.initState();
    final saved = ref
        .read(studentOwnLlmProvider.notifier)
        .forUser(widget.userId);
    _provider = saved?.provider ?? studentLlmProviders.first.id;
    _modelController = TextEditingController(text: saved?.model ?? '');
    _keyController = TextEditingController(text: saved?.apiKey ?? '');
  }

  @override
  void dispose() {
    _modelController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  bool get _canSave =>
      parseStudentOwnLlm(
        userId: widget.userId,
        provider: _provider,
        model: _modelController.text,
        apiKey: _keyController.text,
      ) !=
      null;

  void _save() {
    final value = parseStudentOwnLlm(
      userId: widget.userId,
      provider: _provider,
      model: _modelController.text,
      apiKey: _keyController.text,
    );
    if (value == null) return;
    ref.read(studentOwnLlmProvider.notifier).save(value);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        Insets.lg + bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Học tiếp bằng API của bạn',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const Gap(Insets.sm),
          Text(
            'Hết 10 câu của hệ thống. API này chỉ viết câu trả lời từ đoạn tài liệu nhà trường đã truy xuất. Khóa nằm trong phiên này và không được lưu trên hệ thống.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const Gap(Insets.md),
          DropdownButtonFormField<String>(
            initialValue: _provider,
            decoration: const InputDecoration(labelText: 'Nhà cung cấp'),
            items: [
              for (final item in studentLlmProviders)
                DropdownMenuItem(value: item.id, child: Text(item.label)),
            ],
            onChanged: (value) {
              if (value == null) return;
              setState(() => _provider = value);
            },
          ),
          const Gap(Insets.sm),
          TextField(
            controller: _modelController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Model',
              hintText: 'ví dụ openai/gpt-oss-20b',
            ),
          ),
          const Gap(Insets.sm),
          TextField(
            controller: _keyController,
            obscureText: true,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'API key'),
          ),
          const Gap(Insets.lg),
          Row(
            children: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Đóng'),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _canSave ? _save : null,
                child: const Text('Dùng API này'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
