import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/config/env.dart';
import '../../core/network/auth_headers.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/utils/authenticated_file_open.dart';
import '../models/rag_source_evidence.dart';
import '../models/rag_visual_evidence.dart';

/// Thẻ minh chứng RAG — mặc định ẩn, bấm nút mới mở rộng.
class RagSourceEvidencePanel extends ConsumerStatefulWidget {
  const RagSourceEvidencePanel({
    super.key,
    required this.items,
  });

  final List<RagSourceEvidence> items;

  static const double _thumbWidth = 52;
  static const double _thumbHeight = 68;

  @override
  ConsumerState<RagSourceEvidencePanel> createState() =>
      _RagSourceEvidencePanelState();
}

class _RagSourceEvidencePanelState extends ConsumerState<RagSourceEvidencePanel> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    final headersAsync = ref.watch(authHeadersProvider);
    final count = widget.items.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 1, thickness: 1, color: AppColors.borderHairline),
        const Gap(Insets.sm),
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(Radii.sm),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Insets.xs),
            child: Row(
              children: [
                Icon(
                  _expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                  size: 16,
                  color: AppColors.primary,
                ),
                const Gap(Insets.xs),
                const Icon(
                  LucideIcons.bookOpen,
                  size: 14,
                  color: AppColors.primary,
                ),
                const Gap(Insets.xs),
                Expanded(
                  child: Text(
                    _expanded
                        ? 'Bằng chứng tài liệu'
                        : 'Xem bằng chứng tài liệu ($count)',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_expanded) ...[
          const Gap(Insets.sm),
          ...widget.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: Insets.sm),
              child: _EvidenceCard(
                item: item,
                headersAsync: headersAsync,
                onOpenVisual: (visual) => _openVisual(context, visual),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _openVisual(
    BuildContext context,
    RagVisualEvidence visual,
  ) async {
    final imageUrl = visual.resolveImageUrl();
    if (imageUrl != null && context.mounted) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => _EvidenceImageDialog(
          imageUrl: imageUrl,
          title: visual.materialTitle ?? visual.caption ?? 'Minh chứng',
          pageLabel: visual.pageNumber != null ? 'Trang ${visual.pageNumber}' : null,
          headersAsync: ref.read(authHeadersProvider),
          onOpenPdf: () => _openPdf(visual),
        ),
      );
      return;
    }
    await _openPdf(visual);
  }

  Future<void> _openPdf(RagVisualEvidence visual) async {
    final doc = visual.resolveDocumentUrl();
    if (doc == null) return;
    try {
      final dio = ref.read(springDioProvider);
      final path = normalizeApiPath(doc, Env.apiBaseUrl);
      await openAuthenticatedApiDownload(
        dio,
        apiPath: path,
        fileName: 'material.pdf',
      );
    } catch (_) {}
  }
}

class _EvidenceCard extends StatelessWidget {
  const _EvidenceCard({
    required this.item,
    required this.headersAsync,
    required this.onOpenVisual,
  });

  final RagSourceEvidence item;
  final AsyncValue<Map<String, String>> headersAsync;
  final ValueChanged<RagVisualEvidence> onOpenVisual;

  @override
  Widget build(BuildContext context) {
    final visual = item.primaryVisual;
    final excerpt = item.excerpt?.trim();

    return Material(
      color: AppColors.raised,
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        onTap: visual != null ? () => onOpenVisual(visual) : null,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Container(
          padding: const EdgeInsets.all(Insets.sm),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.borderHairline),
            borderRadius: BorderRadius.circular(Radii.md),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (visual != null)
                _EvidenceThumbnail(
                  visual: visual,
                  headersAsync: headersAsync,
                  onTap: () => onOpenVisual(visual),
                )
              else
                const _EvidencePlaceholder(),
              const Gap(Insets.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.displayTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (item.subtitle.isNotEmpty) ...[
                      const Gap(2),
                      Text(
                        item.subtitle,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textTertiary,
                            ),
                      ),
                    ],
                    if (excerpt != null && excerpt.isNotEmpty) ...[
                      const Gap(Insets.xs),
                      Text(
                        '"$excerpt"',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontStyle: FontStyle.italic,
                              height: 1.35,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EvidenceThumbnail extends StatelessWidget {
  const _EvidenceThumbnail({
    required this.visual,
    required this.headersAsync,
    required this.onTap,
  });

  final RagVisualEvidence visual;
  final AsyncValue<Map<String, String>> headersAsync;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = visual.resolveImageUrl();

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.sm),
      child: Container(
        width: RagSourceEvidencePanel._thumbWidth,
        height: RagSourceEvidencePanel._thumbHeight,
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.borderHairline),
          borderRadius: BorderRadius.circular(Radii.sm),
        ),
        clipBehavior: Clip.antiAlias,
        child: imageUrl != null
            ? headersAsync.when(
                data: (headers) => CachedNetworkImage(
                  imageUrl: imageUrl,
                  httpHeaders: headers,
                  fit: BoxFit.cover,
                  memCacheWidth: 160,
                  memCacheHeight: 210,
                  filterQuality: FilterQuality.low,
                  placeholder: (_, __) => const Center(
                    child: SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                  errorWidget: (_, __, ___) => const Center(
                    child: Icon(LucideIcons.fileText, size: 16),
                  ),
                ),
                loading: () => const Center(
                  child: SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
                error: (_, __) =>
                    const Center(child: Icon(LucideIcons.fileText, size: 16)),
              )
            : const Center(child: Icon(LucideIcons.fileText, size: 16)),
      ),
    );
  }
}

class _EvidencePlaceholder extends StatelessWidget {
  const _EvidencePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: RagSourceEvidencePanel._thumbWidth,
      height: RagSourceEvidencePanel._thumbHeight,
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.borderHairline),
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: const Center(
        child: Icon(LucideIcons.fileText, size: 18, color: AppColors.textTertiary),
      ),
    );
  }
}

class _EvidenceImageDialog extends StatelessWidget {
  const _EvidenceImageDialog({
    required this.imageUrl,
    required this.title,
    required this.headersAsync,
    required this.onOpenPdf,
    this.pageLabel,
  });

  final String imageUrl;
  final String title;
  final String? pageLabel;
  final AsyncValue<Map<String, String>> headersAsync;
  final VoidCallback onOpenPdf;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(Insets.lg),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.92,
          maxHeight: MediaQuery.sizeOf(context).height * 0.82,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Insets.md, Insets.md, Insets.sm, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: Theme.of(context).textTheme.titleSmall),
                        if (pageLabel != null)
                          Text(
                            pageLabel!,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.textTertiary,
                                ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(Insets.md),
                child: headersAsync.when(
                  data: (headers) => InteractiveViewer(
                    child: CachedNetworkImage(
                      imageUrl: imageUrl,
                      httpHeaders: headers,
                      fit: BoxFit.contain,
                      placeholder: (_, __) => const Center(
                        child: CircularProgressIndicator(),
                      ),
                      errorWidget: (_, __, ___) => const Center(
                        child: Icon(LucideIcons.imageOff, size: 32),
                      ),
                    ),
                  ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, __) =>
                      const Center(child: Icon(LucideIcons.imageOff, size: 32)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(Insets.md, 0, Insets.md, Insets.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: onOpenPdf,
                    icon: const Icon(LucideIcons.fileDown, size: 16),
                    label: const Text('Mở PDF'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
