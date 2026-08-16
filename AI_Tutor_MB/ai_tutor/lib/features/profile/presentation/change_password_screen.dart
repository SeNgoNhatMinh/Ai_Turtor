import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/fpt_app_bar.dart';
import '../../../shared/widgets/fpt_button.dart';
import '../../auth/application/auth_controller.dart';
import '../data/profile_repository.dart';

class ChangePasswordScreen extends HookConsumerWidget {
  const ChangePasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final currentCtrl = useTextEditingController();
    final newCtrl = useTextEditingController();
    final confirmCtrl = useTextEditingController();
    final obscureCurrent = useState(true);
    final obscureNew = useState(true);
    final obscureConfirm = useState(true);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> save() async {
      errorText.value = null;
      final current = currentCtrl.text.trim();
      final newPw = newCtrl.text.trim();
      final confirm = confirmCtrl.text.trim();

      if (current.isEmpty || newPw.isEmpty || confirm.isEmpty) return;
      if (newPw.length < 6) {
        errorText.value = l10n.changePasswordTooShort;
        return;
      }
      if (newPw != confirm) {
        errorText.value = l10n.changePasswordMismatch;
        return;
      }

      submitting.value = true;
      try {
        final userId = ref.read(currentUserIdProvider);
        await ref.read(profileRepositoryProvider).changePassword(
          userId: userId,
          currentPassword: current,
          newPassword: newPw,
        );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.changePasswordSuccess)),
          );
          context.pop();
        }
      } catch (e) {
        errorText.value = describeError(e);
      } finally {
        submitting.value = false;
      }
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.changePasswordTitle),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Insets.screenH),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _PasswordField(
              controller: currentCtrl,
              label: l10n.changePasswordCurrentLabel,
              obscure: obscureCurrent,
            ),
            const Gap(Insets.lg),
            _PasswordField(
              controller: newCtrl,
              label: l10n.changePasswordNewLabel,
              obscure: obscureNew,
            ),
            const Gap(Insets.lg),
            _PasswordField(
              controller: confirmCtrl,
              label: l10n.changePasswordConfirmLabel,
              obscure: obscureConfirm,
            ),
            if (errorText.value != null) ...[
              const Gap(Insets.md),
              Text(
                errorText.value!,
                style: TextStyle(color: AppColors.error, fontSize: 13),
              ),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: l10n.changePasswordSaveBtn,
              loading: submitting.value,
              expand: true,
              onPressed: submitting.value ? null : save,
            ),
          ],
        ),
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    required this.obscure,
  });

  final TextEditingController controller;
  final String label;
  final ValueNotifier<bool> obscure;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: obscure,
      builder: (context, isObscure, _) {
        return TextFormField(
          controller: controller,
          obscureText: isObscure,
          decoration: InputDecoration(
            labelText: label,
            suffixIcon: IconButton(
              icon: Icon(
                isObscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              ),
              onPressed: () => obscure.value = !isObscure,
            ),
          ),
        );
      },
    );
  }
}
