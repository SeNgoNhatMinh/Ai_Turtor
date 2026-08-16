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
import '../models/rag_visual_evidence.dart';

/// Thumbnail trang PDF (legacy khi BE chỉ trả `visualEvidence` top-level).
class RagVisualEvidenceStrip extends ConsumerWidget {
  const RagVisualEvidenceStrip({
    super.key,
    required this.items,
  });

  final List<RagVisualEvidence> items;

  static const double _thumbWidth = 56;
  static const double _thumbHeight = 72;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) return const SizedBox.shrink();

    final headersAsync = ref.watch(authHeadersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 1, thickness: 1, color: AppColors.borderHairline),
        const Gap(Insets.sm),
        Text(
          'Minh chứng hình ảnh',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
        ),
        const Gap(Insets.sm),
        SizedBox(
          height: _thumbHeight + 22,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const Gap(Insets.sm),
            itemBuilder: (context, index) {
              final item = items[index];
              final imageUrl = item.resolveImageUrl();
              final labelParts = <String>[
                if (item.materialTitle != null && item.materialTitle!.isNotEmpty)
                  item.materialTitle!,
                if (item.pageNumber != null) 'Trang ${item.pageNumber}',
              ];
              final label = labelParts.isNotEmpty
                  ? labelParts.join(' · ')
                  : (item.caption ?? 'PDF');

              return InkWell(
                onTap: () async {
                  final doc = item.resolveDocumentUrl();
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
                },
                borderRadius: BorderRadius.circular(Radii.md),
                child: SizedBox(
                  width: _thumbWidth + 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        height: _thumbHeight,
                        decoration: BoxDecoration(
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
                                error: (_, __) => const Center(
                                  child: Icon(LucideIcons.fileText, size: 16),
                                ),
                              )
                            : const Center(
                                child: Icon(LucideIcons.fileText, size: 16),
                              ),
                      ),
                      const Gap(2),
                      Text(
                        label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontSize: 10,
                            ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
