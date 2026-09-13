import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../application/tts_controller.dart';
import '../../data/tts_models.dart';

class TtsCopy {
  static const read = 'Đọc';
  static const loading = 'Đang tạo giọng...';
  static const pause = 'Tạm dừng';
  static const resume = 'Tiếp tục';
  static const stop = 'Dừng';
  static const stopHint = 'Dừng đọc câu trả lời';
  static const chooseVoice = 'Chọn giọng đọc';
  static const loadingVoices = 'Đang tải giọng...';
  static const voicesUnavailable = 'Không tải được giọng';
  static const voiceLabel = 'Chọn giọng đọc AI Tutor';
  static const seekLabel = 'Vị trí phát giọng đọc';
  static const playerLabel = 'Tiến trình giọng đọc AI Tutor';

  static String actionLabel(TtsSpeechStatus status) {
    return switch (status) {
      TtsSpeechStatus.loading => loading,
      TtsSpeechStatus.playing => pause,
      TtsSpeechStatus.paused => resume,
      TtsSpeechStatus.idle || TtsSpeechStatus.failed => read,
    };
  }

  static String actionHint(TtsSpeechStatus status) {
    return '${actionLabel(status)} câu trả lời của AI Tutor';
  }
}

class TtsMessageAction extends StatelessWidget {
  const TtsMessageAction({
    super.key,
    required this.messageKey,
    required this.speech,
    required this.onToggle,
    required this.onStop,
    required this.onSeek,
    this.voicesError = '',
    this.child,
  });

  final String messageKey;
  final TtsSpeechState speech;
  final VoidCallback onToggle;
  final VoidCallback onStop;
  final ValueChanged<Duration> onSeek;
  final String voicesError;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final isCurrent = speech.messageKey == messageKey;
    final status = isCurrent ? speech.status : TtsSpeechStatus.idle;
    final loading = status == TtsSpeechStatus.loading;
    final playing = status == TtsSpeechStatus.playing;
    final paused = status == TtsSpeechStatus.paused;
    final showPlayer = isCurrent && speech.hasAudio && (playing || paused);
    final icon = switch (status) {
      TtsSpeechStatus.loading => LucideIcons.loaderCircle,
      TtsSpeechStatus.playing => LucideIcons.pause,
      TtsSpeechStatus.paused => LucideIcons.play,
      TtsSpeechStatus.idle || TtsSpeechStatus.failed => LucideIcons.volume2,
    };

    return Padding(
      padding: const EdgeInsets.only(left: 44, bottom: Insets.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: Insets.sm,
            runSpacing: Insets.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _TtsPillButton(
                icon: icon,
                label: TtsCopy.actionLabel(status),
                spinning: loading,
                onPressed: loading ? null : onToggle,
                semanticLabel: TtsCopy.actionHint(status),
                pressed: playing,
              ),
              if (showPlayer)
                _TtsPillButton(
                  icon: LucideIcons.square,
                  label: TtsCopy.stop,
                  onPressed: onStop,
                  semanticLabel: TtsCopy.stopHint,
                ),
              if (child != null) child!,
            ],
          ),
          if (showPlayer) ...[
            const Gap(Insets.sm),
            _TtsMiniPlayer(
              currentTime: speech.currentTime,
              duration: speech.duration,
              onSeek: onSeek,
            ),
          ],
          if (isCurrent && speech.error.isNotEmpty) ...[
            const Gap(Insets.xs),
            Text(
              speech.error,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.error,
                height: 1.45,
              ),
            ),
          ] else if (voicesError.isNotEmpty) ...[
            const Gap(Insets.xs),
            Text(
              voicesError,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.error,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class TtsVoiceSelector extends StatelessWidget {
  const TtsVoiceSelector({
    super.key,
    required this.value,
    required this.voices,
    required this.onChange,
    this.loading = false,
    this.compact = true,
  });

  final String value;
  final List<TtsVoice> voices;
  final ValueChanged<String> onChange;
  final bool loading;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final selected = voices.where((voice) => voice.id == value).firstOrNull;
    final enabled = !loading && voices.isNotEmpty;
    final label = loading
        ? TtsCopy.loadingVoices
        : voices.isEmpty
        ? TtsCopy.voicesUnavailable
        : (selected?.name ?? TtsCopy.chooseVoice);

    return Semantics(
      button: true,
      label: TtsCopy.voiceLabel,
      child: _TtsPillButton(
        icon: LucideIcons.volume2,
        label: label,
        accentIcon: true,
        compact: compact,
        onPressed: enabled
            ? () => _openVoiceSheet(context, selectedId: value)
            : null,
      ),
    );
  }

  Future<void> _openVoiceSheet(
    BuildContext context, {
    required String selectedId,
  }) async {
    final next = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.lg,
              Insets.screenH,
              Insets.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  TtsCopy.chooseVoice,
                  style: Theme.of(sheetContext).textTheme.titleMedium,
                ),
                const Gap(Insets.md),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.5,
                  ),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: voices.length,
                    itemBuilder: (_, index) {
                      final voice = voices[index];
                      final selected = voice.id == selectedId;
                      return ListTile(
                        title: Text(voice.name),
                        subtitle: voice.description.isEmpty
                            ? null
                            : Text(voice.description),
                        trailing: selected
                            ? const Icon(
                                LucideIcons.check,
                                color: AppColors.accent,
                              )
                            : null,
                        selected: selected,
                        onTap: () => Navigator.of(sheetContext).pop(voice.id),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (next != null && next != value) onChange(next);
  }
}

class TtsAnswerControls extends ConsumerWidget {
  const TtsAnswerControls({
    super.key,
    required this.conversationId,
    required this.messageKey,
    required this.messageId,
    required this.courseId,
    required this.classId,
    required this.text,
    required this.voiceId,
    required this.voices,
    required this.onVoiceChange,
    this.voicesLoading = false,
    this.voicesError = '',
  });

  final String conversationId;
  final String messageKey;
  final String messageId;
  final String courseId;
  final String classId;
  final String text;
  final String voiceId;
  final List<TtsVoice> voices;
  final ValueChanged<String> onVoiceChange;
  final bool voicesLoading;
  final String voicesError;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final speech = ref.watch(
      chatMessageAudioProvider(conversationId).select(
        (value) => value.messageKey == messageKey ? value : TtsSpeechState.idle,
      ),
    );
    final audio = ref.read(chatMessageAudioProvider(conversationId).notifier);

    return TtsMessageAction(
      messageKey: messageKey,
      speech: speech,
      voicesError: voicesError,
      onToggle: () {
        audio.toggle(
          messageKey: messageKey,
          messageId: messageId,
          courseId: courseId,
          classId: classId,
          text: text,
          providerVoiceId: voiceId,
        );
      },
      onStop: () => audio.stop(messageKey),
      onSeek: (value) => audio.seek(messageKey, value),
      child: TtsVoiceSelector(
        value: voiceId,
        voices: voices,
        loading: voicesLoading,
        onChange: onVoiceChange,
      ),
    );
  }
}

class _TtsMiniPlayer extends StatelessWidget {
  const _TtsMiniPlayer({
    required this.currentTime,
    required this.duration,
    required this.onSeek,
  });

  final Duration currentTime;
  final Duration duration;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final maxSeconds = duration.inMilliseconds <= 0
        ? 0.1
        : duration.inMilliseconds / 1000;
    final valueSeconds = (currentTime.inMilliseconds / 1000).clamp(
      0,
      maxSeconds,
    );

    return Semantics(
      label: TtsCopy.playerLabel,
      child: Row(
        children: [
          Text(
            formatTtsClock(currentTime),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 3,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                activeTrackColor: AppColors.accent,
                inactiveTrackColor: AppColors.sunken,
                thumbColor: AppColors.accent,
              ),
              child: Slider(
                min: 0,
                max: maxSeconds,
                value: valueSeconds.toDouble(),
                onChanged: (next) =>
                    onSeek(Duration(milliseconds: (next * 1000).round())),
                semanticFormatterCallback: (_) => TtsCopy.seekLabel,
              ),
            ),
          ),
          Text(
            formatTtsClock(duration),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _TtsPillButton extends StatelessWidget {
  const _TtsPillButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.semanticLabel,
    this.spinning = false,
    this.pressed = false,
    this.accentIcon = false,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final String? semanticLabel;
  final bool spinning;
  final bool pressed;
  final bool accentIcon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel ?? label,
      child: Material(
        color: pressed ? AppColors.accentWash : AppColors.card,
        shape: StadiumBorder(
          side: BorderSide(
            color: pressed ? AppColors.accent : AppColors.borderHairline,
          ),
        ),
        child: InkWell(
          onTap: onPressed,
          customBorder: const StadiumBorder(),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: compact ? Insets.md : Insets.lg,
                vertical: Insets.sm,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  spinning
                      ? const SizedBox(
                          width: 15,
                          height: 15,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          icon,
                          size: 15,
                          color: accentIcon
                              ? AppColors.accent
                              : AppColors.textSecondary,
                        ),
                  const Gap(6),
                  ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: compact ? 150 : 220),
                    child: Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        color: AppColors.warm700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
