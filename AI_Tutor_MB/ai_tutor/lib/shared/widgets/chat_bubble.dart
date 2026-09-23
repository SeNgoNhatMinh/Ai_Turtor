import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/utils/ai_chat_content.dart';
import '../../core/utils/code_mentor_mode.dart';
import '../models/rag_source_evidence.dart';
import '../models/rag_visual_evidence.dart';
import 'ai_markdown_body.dart';
import 'ai_markdown_reveal.dart';
import 'ai_suggestion_json.dart';
import 'rag_source_evidence_panel.dart';
import 'rag_visual_evidence_strip.dart';

bool reportsInsufficientCourseMaterial(String content) {
  final text = content.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();
  final mentionsMaterial =
      text.contains('tài liệu') ||
      text.contains('tai lieu') ||
      text.contains('material');
  final saysInsufficient =
      text.contains('không đủ') ||
      text.contains('khong du') ||
      text.contains('không đề cập') ||
      text.contains('khong de cap') ||
      text.contains('not enough') ||
      text.contains('does not mention') ||
      text.contains('insufficient');
  return mentionsMaterial && saysInsufficient;
}

class ChatBubble extends StatelessWidget {
  const ChatBubble({
    super.key,
    required this.isUser,
    required this.content,
    this.mode,
    this.confidence,
    this.sources = const [],
    this.sourceEvidence = const [],
    this.visualEvidence = const [],
    this.escalated = false,
    this.trailing,
    this.useMarkdown = true,
    this.pinned = false,
    this.pinnedLabel,
    this.onStudyTipTap,
    this.afterContent,
    this.betweenContent,
    this.codeSnippet,
    this.revealMarkdown = false,
    this.onDownloadSource,
  });

  final bool isUser;
  final String content;
  final String? mode;
  final double? confidence;
  final List<String> sources;
  final List<RagSourceEvidence> sourceEvidence;
  final List<RagVisualEvidence> visualEvidence;
  final bool escalated;
  final Widget? trailing;
  final bool useMarkdown;
  final bool pinned;
  final String? pinnedLabel;
  final ValueChanged<String>? onStudyTipTap;
  final String? afterContent;
  final Widget? betweenContent;
  final String? codeSnippet;
  final bool revealMarkdown;
  final void Function(String materialId, String title)? onDownloadSource;

  @override
  Widget build(BuildContext context) {
    final insufficientMaterial = reportsInsufficientCourseMaterial(content);
    final visibleSourceEvidence = insufficientMaterial
        ? const <RagSourceEvidence>[]
        : sourceEvidence;
    final visibleSources = insufficientMaterial ? const <String>[] : sources;
    final visibleLegacyVisuals = insufficientMaterial
        ? const <RagVisualEvidence>[]
        : visibleSourceEvidence.isNotEmpty
        ? const <RagVisualEvidence>[]
        : visualEvidence;
    final hasMaterialEvidence =
        visibleSourceEvidence.isNotEmpty || visibleSources.isNotEmpty;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(Radii.lg),
      topRight: const Radius.circular(Radii.lg),
      bottomLeft: Radius.circular(isUser ? Radii.lg : Radii.sm),
      bottomRight: Radius.circular(isUser ? Radii.sm : Radii.lg),
    );

    final bgColor = isUser ? AppColors.primary : AppColors.card;

    final decoration = BoxDecoration(
      color: bgColor,
      borderRadius: radius,
      border: isUser ? null : Border.all(color: AppColors.borderHairline),
    );

    return Align(
          alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: isUser
                  ? MediaQuery.sizeOf(context).width * 0.78
                  : double.infinity,
            ),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: Insets.xs),
              padding: const EdgeInsets.all(Insets.md),
              decoration: decoration,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (pinned && !isUser)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Insets.xs),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            LucideIcons.pin,
                            size: 12,
                            color: AppColors.primary,
                          ),
                          const Gap(Insets.xs),
                          Text(
                            pinnedLabel ?? 'Đã ghim',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11,
                                ),
                          ),
                        ],
                      ),
                    ),
                  if (!isUser && isCodeMentorMode(mode)) ...[
                    _CodeModeBanner(label: codeModeLabel),
                    const Gap(Insets.sm),
                  ],
                  if (isUser && (codeSnippet ?? '').trim().isNotEmpty) ...[
                    _UserCodePreview(code: codeSnippet!.trim()),
                    if (content.trim().isNotEmpty) const Gap(Insets.sm),
                  ],
                  if (!isUser && useMarkdown) ...[
                    if (content.trim().isNotEmpty)
                      revealMarkdown
                          ? AiMarkdownReveal(
                              data: rewriteSuggestionJson(content),
                              enabled: true,
                              onStudyTipTap: onStudyTipTap,
                            )
                          : AiMarkdownBody(
                              data: prepareAiChatMarkdown(
                                rewriteSuggestionJson(content),
                              ),
                              onStudyTipTap: onStudyTipTap,
                            ),
                    if (betweenContent != null) betweenContent!,
                    if ((afterContent ?? '').trim().isNotEmpty)
                      AiMarkdownBody(
                        data: prepareAiChatMarkdown(
                          rewriteSuggestionJson(afterContent!),
                        ),
                        onStudyTipTap: onStudyTipTap,
                      ),
                  ] else
                    Text(
                      isUser
                          ? content
                          : sanitizeAiChatContent(
                              rewriteSuggestionJson(content),
                            ),
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: isUser
                            ? AppColors.onOrange
                            : AppColors.textPrimary,
                      ),
                    ),
                  if (!isUser && confidence != null && hasMaterialEvidence) ...[
                    _AiMetaRow(confidence: confidence),
                  ],
                  if (!isUser && visibleSourceEvidence.isNotEmpty)
                    RagSourceEvidencePanel(
                      items: visibleSourceEvidence,
                      onDownloadSource: onDownloadSource,
                    ),
                  if (!isUser &&
                      visibleSourceEvidence.isEmpty &&
                      visibleSources.isNotEmpty)
                    _SourceChipRow(sources: visibleSources),
                  if (!isUser && visibleLegacyVisuals.isNotEmpty)
                    RagVisualEvidenceStrip(items: visibleLegacyVisuals),
                  if (!isUser && isCodeMentorMode(mode)) ...[
                    const Gap(Insets.sm),
                    Text(
                      codeModeDisclaimer,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ],
                  if (trailing != null) ...[const Gap(Insets.sm), trailing!],
                ],
              ),
            ),
          ),
        )
        .animate()
        .fadeIn(duration: Motion.base)
        .slideY(begin: 0.15, end: 0, curve: Curves.easeOutCubic);
  }
}

class _CodeModeBanner extends StatelessWidget {
  const _CodeModeBanner({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(LucideIcons.code, size: 14, color: AppColors.primaryTint),
        const Gap(Insets.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.primaryTint,
          ),
        ),
      ],
    );
  }
}

class _UserCodePreview extends StatelessWidget {
  const _UserCodePreview({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Insets.sm),
      decoration: BoxDecoration(
        color: AppColors.primaryDark,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Text(
        code,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          fontFamily: 'monospace',
          height: 1.4,
          color: AppColors.onOrange,
        ),
      ),
    );
  }
}

class _SourceChipRow extends StatelessWidget {
  const _SourceChipRow({required this.sources});

  final List<String> sources;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 1, thickness: 1, color: AppColors.borderHairline),
        const Gap(Insets.sm),
        Text(
          'Nguồn tham khảo',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const Gap(Insets.sm),
        Wrap(
          spacing: Insets.xs,
          runSpacing: Insets.xs,
          children: sources
              .map(
                (s) => Chip(
                  visualDensity: VisualDensity.compact,
                  label: Text(s, style: Theme.of(context).textTheme.labelSmall),
                  avatar: const Icon(LucideIcons.bookOpen, size: 14),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _AiMetaRow extends StatelessWidget {
  const _AiMetaRow({required this.confidence});

  final double? confidence;

  @override
  Widget build(BuildContext context) {
    final pct = confidence != null ? (confidence! * 100).round() : null;
    if (pct == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 1, thickness: 1, color: AppColors.borderHairline),
        const Gap(Insets.sm),
        Row(
          children: [
            Icon(LucideIcons.checkCircle2, size: 14, color: AppColors.success),
            const Gap(Insets.xs),
            Text(
              'Độ khớp của nguồn với câu hỏi: $pct%',
              style: GoogleFonts.spaceGrotesk(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.success,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class TypingDots extends StatelessWidget {
  const TypingDots({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child:
                const CircleAvatar(
                      radius: 3,
                      backgroundColor: AppColors.textTertiary,
                    )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .fadeIn(duration: 700.ms, delay: (i * 160).ms),
          ),
      ],
    );
  }
}
