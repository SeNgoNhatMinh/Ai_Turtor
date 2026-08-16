import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/utils/vietnamese_text_input.dart';

/// Ô nhập chat — dùng IME tiếng Việt của hệ điều hành (không Telex formatter).
class ChatMessageInput extends StatefulWidget {
  const ChatMessageInput({
    super.key,
    required this.controller,
    required this.hint,
    this.focusNode,
    this.enabled = true,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final FocusNode? focusNode;
  final bool enabled;
  final ValueChanged<String>? onSubmitted;

  @override
  State<ChatMessageInput> createState() => _ChatMessageInputState();
}

class _ChatMessageInputState extends State<ChatMessageInput> {
  late final FocusNode _focusNode;
  bool _ownsFocusNode = false;

  @override
  void initState() {
    super.initState();
    if (widget.focusNode != null) {
      _focusNode = widget.focusNode!;
    } else {
      _focusNode = FocusNode();
      _ownsFocusNode = true;
    }
  }

  @override
  void dispose() {
    if (_ownsFocusNode) {
      _focusNode.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: TextField(
        controller: widget.controller,
        focusNode: _focusNode,
        enabled: widget.enabled,
        minLines: 4,
        maxLines: 4,
        keyboardType: TextInputType.multiline,
        textInputAction: TextInputAction.newline,
        autocorrect: VietnameseTextInput.autocorrect,
        enableSuggestions: VietnameseTextInput.enableSuggestions,
        enableIMEPersonalizedLearning:
            VietnameseTextInput.enableIMEPersonalizedLearning,
        textCapitalization: TextCapitalization.none,
        smartDashesType: VietnameseTextInput.smartDashesType,
        smartQuotesType: VietnameseTextInput.smartQuotesType,
        style: Theme.of(context).textTheme.bodyLarge,
        onSubmitted: widget.onSubmitted,
        decoration: InputDecoration(
          hintText: widget.hint,
          filled: true,
          fillColor: AppColors.raised,
          contentPadding: const EdgeInsets.all(Insets.md),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            borderSide: const BorderSide(color: AppColors.borderHairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            borderSide: const BorderSide(color: AppColors.borderHairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            borderSide: const BorderSide(color: AppColors.borderHairline),
          ),
        ),
      ),
    );
  }
}
