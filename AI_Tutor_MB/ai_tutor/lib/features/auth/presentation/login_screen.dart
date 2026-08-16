import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_form_widgets.dart';
import 'widgets/login_splash_header.dart';

class LoginScreen extends HookConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscure = useState(true);
    final rememberMe = useState(true);
    final shake = useState(false);
    final auth = ref.watch(authControllerProvider);
    final screenH = MediaQuery.sizeOf(context).height;
    final headerH = screenH * 0.34;

    ref.listen(authControllerProvider, (prev, next) {
      if (next.hasError) shake.value = true;
    });

    Future<void> submit() async {
      shake.value = false;
      final emailError = Validators.email(emailController.text);
      final passwordError = Validators.password(passwordController.text);
      if (emailError != null || passwordError != null) {
        shake.value = true;
        return;
      }
      await ref
          .read(authControllerProvider.notifier)
          .login(emailController.text.trim(), passwordController.text);
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: AppColors.homeBgBottom,
        resizeToAvoidBottomInset: true,
        body: Column(
          children: [
            LoginSplashHeader(height: headerH),
            Expanded(
              child: Transform.translate(
                offset: const Offset(0, -20),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(28),
                    ),
                    border: Border.all(color: AppColors.borderHairline),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 20,
                        offset: Offset(0, -4),
                      ),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        Insets.screenH,
                        Insets.lg,
                        Insets.screenH,
                        Insets.xxxl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.loginWelcomeBack,
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                          ),
                          const Gap(Insets.sm),
                          Text(
                            l10n.loginSubtitle,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: AppColors.textTertiary),
                          ),
                          const Gap(Insets.xl),
                          Animate(
                            effects: shake.value
                                ? [
                                    ShakeEffect(
                                      duration: Motion.base,
                                      hz: 3,
                                      curve: Curves.easeInOut,
                                    ),
                                  ]
                                : const [],
                            child: AutofillGroup(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  FptTextField(
                                    controller: emailController,
                                    label: l10n.emailLabel,
                                    hint: l10n.emailHint,
                                    keyboardType: TextInputType.emailAddress,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const [
                                      AutofillHints.email,
                                      AutofillHints.username,
                                    ],
                                    prefixIcon: const Icon(
                                      LucideIcons.mail,
                                      size: 20,
                                      color: AppColors.textTertiary,
                                    ),
                                  ),
                                  const Gap(Insets.lg),
                                  FptTextField(
                                    controller: passwordController,
                                    label: l10n.passwordLabel,
                                    hint: l10n.passwordHint,
                                    obscureText: obscure.value,
                                    textInputAction: TextInputAction.done,
                                    autofillHints: const [AutofillHints.password],
                                    onSubmitted: (_) => submit(),
                                    prefixIcon: const Icon(
                                      LucideIcons.lock,
                                      size: 20,
                                      color: AppColors.textTertiary,
                                    ),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        obscure.value
                                            ? LucideIcons.eye
                                            : LucideIcons.eyeOff,
                                        size: 20,
                                        color: AppColors.textTertiary,
                                      ),
                                      onPressed: () =>
                                          obscure.value = !obscure.value,
                                    ),
                                  ),
                                if (auth.hasError) ...[
                                  const Gap(Insets.md),
                                  Text(
                                    describeAuthError(auth.error!),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: AppColors.error,
                                          height: 1.4,
                                        ),
                                  ),
                                ],
                              ],
                            ),
                            ),
                          ),
                          const Gap(Insets.md),
                          Row(
                            children: [
                              Expanded(
                                child: AuthCheckboxTile(
                                  value: rememberMe.value,
                                  onChanged: (v) =>
                                      rememberMe.value = v ?? false,
                                  child: Text(
                                    l10n.rememberMe,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                  ),
                                ),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        l10n.forgotPasswordComingSoon,
                                      ),
                                    ),
                                  );
                                },
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  l10n.forgotPassword,
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(
                                        color: AppColors.peacockBlue,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              ),
                            ],
                          ),
                          const Gap(Insets.xl),
                          FptButton(
                            label: l10n.loginButton,
                            onPressed: auth.isLoading ? null : submit,
                            loading: auth.isLoading,
                            expand: true,
                          ),
                          const Gap(Insets.lg),
                          AuthOrDivider(label: l10n.orDivider),
                          const Gap(Insets.lg),
                          GoogleSignInButton(
                            label: l10n.continueWithGoogle,
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(l10n.googleSignInComingSoon),
                                ),
                              );
                            },
                          ),
                          const Gap(Insets.xl),
                          Center(
                            child: TextButton(
                              onPressed: () => context.push('/register'),
                              child: Text.rich(
                                TextSpan(
                                  text: '${l10n.noAccount} ',
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                  children: [
                                    TextSpan(
                                      text: l10n.registerTitle,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class RegisterScreen extends HookConsumerWidget {
  const RegisterScreen({super.key});

  String _strengthLabel(AppLocalizations l10n, PasswordStrength strength) {
    final level = switch (strength) {
      PasswordStrength.weak => l10n.passwordStrengthWeak,
      PasswordStrength.fair => l10n.passwordStrengthFair,
      PasswordStrength.good => l10n.passwordStrengthGood,
      PasswordStrength.strong => l10n.passwordStrengthStrong,
      PasswordStrength.empty => '',
    };
    return l10n.passwordStrengthLabel(level);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final fullNameController = useTextEditingController();
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscure = useState(true);
    final agreedTerms = useState(false);
    final password = useListenable(passwordController).text;
    final strength = evaluatePasswordStrength(password);
    final auth = ref.watch(authControllerProvider);
    final screenH = MediaQuery.sizeOf(context).height;
    final headerH = screenH * 0.28;
    final topPad = MediaQuery.paddingOf(context).top;

    Future<void> submit() async {
      if (!agreedTerms.value) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.termsRequired)));
        return;
      }
      final nameError = Validators.requiredField(
        fullNameController.text,
        label: 'họ tên',
      );
      final emailError = Validators.email(emailController.text);
      final passwordError = Validators.password(passwordController.text);
      if (nameError != null ||
          emailError != null ||
          passwordError != null) {
        return;
      }
      await ref
          .read(authControllerProvider.notifier)
          .register(
            email: emailController.text.trim(),
            password: passwordController.text,
            fullName: fullNameController.text.trim(),
          );
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: AppColors.homeBgBottom,
        resizeToAvoidBottomInset: true,
        body: Column(
          children: [
            SizedBox(
              height: headerH,
              child: Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  LoginSplashHeader(height: headerH),
                  Positioned(
                    top: topPad,
                    left: 0,
                    child: PortalBackButton(onPressed: () => context.pop()),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Transform.translate(
                offset: const Offset(0, -20),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(28),
                    ),
                    border: Border.all(color: AppColors.borderHairline),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 20,
                        offset: Offset(0, -4),
                      ),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        Insets.screenH,
                        Insets.lg,
                        Insets.screenH,
                        Insets.xxxl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.registerTitle,
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                          ),
                          const Gap(Insets.sm),
                          Text(
                            l10n.registerTagline,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: AppColors.textTertiary),
                          ),
                          const Gap(Insets.xl),
                          FptTextField(
                            controller: fullNameController,
                            label: l10n.fullNameLabel,
                            hint: 'Nguyễn Văn A',
                            textInputAction: TextInputAction.next,
                            prefixIcon: const Icon(
                              LucideIcons.user,
                              size: 20,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const Gap(Insets.lg),
                          FptTextField(
                            controller: emailController,
                            label: l10n.studentEmailLabel,
                            hint: l10n.emailHint,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            prefixIcon: const Icon(
                              LucideIcons.mail,
                              size: 20,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const Gap(Insets.lg),
                          FptTextField(
                            controller: passwordController,
                            label: l10n.passwordLabel,
                            obscureText: obscure.value,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => submit(),
                            prefixIcon: const Icon(
                              LucideIcons.lock,
                              size: 20,
                              color: AppColors.textTertiary,
                            ),
                            suffixIcon: IconButton(
                              icon: Icon(
                                obscure.value
                                    ? LucideIcons.eye
                                    : LucideIcons.eyeOff,
                                size: 20,
                                color: AppColors.textTertiary,
                              ),
                              onPressed: () => obscure.value = !obscure.value,
                            ),
                          ),
                          if (auth.hasError) ...[
                            const Gap(Insets.md),
                            Text(
                              describeAuthError(auth.error!),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: AppColors.error,
                                    height: 1.4,
                                  ),
                            ),
                          ],
                          const Gap(Insets.md),
                          PasswordStrengthIndicator(
                            strength: strength,
                            label: _strengthLabel(l10n, strength),
                          ),
                          const Gap(Insets.lg),
                          AuthCheckboxTile(
                            value: agreedTerms.value,
                            onChanged: (v) => agreedTerms.value = v ?? false,
                            child: Text.rich(
                              TextSpan(
                                text: l10n.termsAgreementPrefix,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      color: AppColors.textSecondary,
                                      height: 1.4,
                                    ),
                                children: [
                                  TextSpan(
                                    text: l10n.termsLink,
                                    style: const TextStyle(
                                      color: AppColors.peacockBlue,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  TextSpan(text: l10n.termsAgreementMiddle),
                                  TextSpan(
                                    text: l10n.privacyLink,
                                    style: const TextStyle(
                                      color: AppColors.peacockBlue,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  TextSpan(text: l10n.termsAgreementSuffix),
                                ],
                              ),
                            ),
                          ),
                          const Gap(Insets.xl),
                          FptButton(
                            label: l10n.registerButton,
                            onPressed: auth.isLoading ? null : submit,
                            loading: auth.isLoading,
                            expand: true,
                          ),
                          const Gap(Insets.xl),
                          Center(
                            child: TextButton(
                              onPressed: () => context.pop(),
                              child: Text.rich(
                                TextSpan(
                                  text: '${l10n.hasAccount} ',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                  children: [
                                    TextSpan(
                                      text: l10n.loginTitle,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
