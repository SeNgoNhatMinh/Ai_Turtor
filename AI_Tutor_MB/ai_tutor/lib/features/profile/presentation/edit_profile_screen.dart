import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/profile_controller.dart';

class EditProfileScreen extends HookConsumerWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final profileAsync = ref.watch(profileControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.editProfileTitle),
      body: profileAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(profileControllerProvider),
        ),
        data: (profile) => _EditProfileForm(
          initialFullName: profile.fullName,
          initialPhone: profile.phone,
          initialBio: profile.bio,
          initialAddress: profile.address,
          initialCity: profile.city,
          initialAvatarUrl: profile.avatarUrl,
        ),
      ),
    );
  }
}

class _EditProfileForm extends HookConsumerWidget {
  const _EditProfileForm({
    required this.initialFullName,
    this.initialPhone,
    this.initialBio,
    this.initialAddress,
    this.initialCity,
    this.initialAvatarUrl,
  });

  final String initialFullName;
  final String? initialPhone;
  final String? initialBio;
  final String? initialAddress;
  final String? initialCity;
  final String? initialAvatarUrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final fullNameController = useTextEditingController(text: initialFullName);
    final phoneController = useTextEditingController(text: initialPhone ?? '');
    final bioController = useTextEditingController(text: initialBio ?? '');
    final addressController = useTextEditingController(text: initialAddress ?? '');
    final cityController = useTextEditingController(text: initialCity ?? '');
    final avatarUrlController = useTextEditingController(text: initialAvatarUrl ?? '');
    final avatarPreview = useState<String?>(initialAvatarUrl);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    String? trimmedOrNull(String value) {
      final v = value.trim();
      return v.isEmpty ? null : v;
    }

    Future<void> save() async {
      final fullName = fullNameController.text.trim();
      if (fullName.isEmpty) {
        errorText.value = l10n.fullNameRequired;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(profileControllerProvider.notifier)
            .updateProfile(
              fullName: fullName,
              phone: trimmedOrNull(phoneController.text),
              avatarUrl: trimmedOrNull(avatarUrlController.text),
              bio: trimmedOrNull(bioController.text),
              address: trimmedOrNull(addressController.text),
              city: trimmedOrNull(cityController.text),
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.profileUpdated),
              backgroundColor: AppColors.success,
            ),
          );
          context.pop();
        }
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.screenTop,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        // ── Avatar preview ───────────────────────────────────────
        Center(
          child: Stack(
            alignment: Alignment.bottomRight,
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: AppColors.primaryWash,
                backgroundImage: avatarPreview.value != null && avatarPreview.value!.isNotEmpty
                    ? NetworkImage(avatarPreview.value!)
                    : null,
                child: avatarPreview.value == null || avatarPreview.value!.isEmpty
                    ? const Icon(LucideIcons.user, size: 40, color: AppColors.primary)
                    : null,
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.pencil, size: 14, color: Colors.white),
              ),
            ],
          ),
        ),
        const Gap(Insets.md),
        FptTextField(
          controller: avatarUrlController,
          label: 'URL ảnh đại diện',
          keyboardType: TextInputType.url,
          onChanged: (v) => avatarPreview.value = v.trim().isEmpty ? null : v.trim(),
        ),
        const Gap(Insets.xl),
        FptTextField(
          controller: fullNameController,
          label: l10n.fullNameLabel,
        ),
        const Gap(Insets.md),
        FptTextField(
          controller: phoneController,
          label: l10n.phoneLabel,
          keyboardType: TextInputType.phone,
        ),
        const Gap(Insets.md),
        FptTextField(
          controller: cityController,
          label: l10n.cityLabel,
        ),
        const Gap(Insets.md),
        FptTextField(
          controller: addressController,
          label: l10n.addressLabel,
        ),
        const Gap(Insets.md),
        FptTextField(
          controller: bioController,
          label: l10n.bioLabel,
          maxLines: 4,
        ),
        if (errorText.value != null) ...[
          const Gap(Insets.md),
          Text(
            errorText.value!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error),
          ),
        ],
        const Gap(Insets.xl),
        FptButton(
          label: l10n.saveChanges,
          loading: submitting.value,
          expand: true,
          onPressed: submitting.value ? null : save,
        ),
      ],
    );
  }
}
