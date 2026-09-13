import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_form_widgets.dart';
import 'widgets/login_splash_header.dart';

class LoginScreen extends HookConsumerWidget {
  const LoginScreen({super.key});

  static Widget _fieldIcon(IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(left: 10, right: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.primaryWash,
          borderRadius: BorderRadius.circular(10),
        ),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, size: 18, color: AppColors.fptBlue),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscure = useState(true);
    final shake = useState(false);
    final auth = ref.watch(authControllerProvider);
    final screenH = MediaQuery.sizeOf(context).height;
    final topPad = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final headerH = (topPad + Insets.md + LoginSplashHeader.cocSize + Insets.md)
        .clamp(160.0, screenH * 0.30);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

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

    const cardRadius = 28.0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: AppColors.loginNavy,
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarDividerColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: AppColors.loginNavy,
        resizeToAvoidBottomInset: true,
        body: Column(
          children: [
            LoginSplashHeader(height: headerH),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(0, 0, 0, 10 + bottomPad),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(cardRadius),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 20,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(cardRadius),
                    child: Material(
                      color: AppColors.card,
                      child: SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(
                          Insets.screenH,
                          Insets.xl,
                          Insets.screenH,
                          Insets.lg + bottomInset,
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
                                    color: AppColors.loginNavy,
                                    letterSpacing: -0.4,
                                  ),
                            ),
                            const Gap(Insets.xs),
                            Text(
                              l10n.loginSubtitle,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: AppColors.textTertiary,
                                    height: 1.35,
                                  ),
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
                                      hint: l10n.emailHint,
                                      keyboardType: TextInputType.emailAddress,
                                      textInputAction: TextInputAction.next,
                                      autofillHints: const [
                                        AutofillHints.email,
                                        AutofillHints.username,
                                      ],
                                      prefixIcon: _fieldIcon(LucideIcons.mail),
                                    ),
                                    const Gap(Insets.md),
                                    FptTextField(
                                      controller: passwordController,
                                      hint: l10n.passwordHint,
                                      obscureText: obscure.value,
                                      textInputAction: TextInputAction.done,
                                      autofillHints: const [
                                        AutofillHints.password,
                                      ],
                                      onSubmitted: (_) => submit(),
                                      prefixIcon: _fieldIcon(LucideIcons.lock),
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
                            const Gap(Insets.sm),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
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
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: AppColors.fptBlue,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              ),
                            ),
                            const Gap(Insets.lg),
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
                                    content: Text(
                                      l10n.googleSignInComingSoon,
                                    ),
                                  ),
                                );
                              },
                            ),
                            const Gap(Insets.lg),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: AspectRatio(
                                aspectRatio: 16 / 10,
                                child: Image.asset(
                                  AppAssets.loginCampusIllustration,
                                  fit: BoxFit.cover,
                                  alignment: Alignment.topCenter,
                                  filterQuality: FilterQuality.high,
                                  gaplessPlayback: true,
                                  errorBuilder: (_, __, ___) =>
                                      const SizedBox.shrink(),
                                ),
                              ),
                            ),
                            const Gap(Insets.md),
                            Center(
                              child: TextButton(
                                onPressed: () => context.push('/register'),
                                child: Text.rich(
                                  TextSpan(
                                    text: '${l10n.noAccount} ',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
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
                                              color: AppColors.loginNavy,
                                              fontWeight: FontWeight.w800,
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
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: AppColors.card,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.loginNavy,
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
