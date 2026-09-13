export '../../../core/utils/code_mentor_mode.dart';

const codeMentorMaxChars = 12000;
const codeMentorMaxLines = 100;
const codeOnlyQuestion = 'Hãy xem giúp em đoạn mã này.';

class CodeInputValidation {
  const CodeInputValidation({
    required this.ok,
    required this.value,
    this.message = '',
  });

  final bool ok;
  final String value;
  final String message;
}

bool isCodeMentorMode(String? mode) {
  final value = (mode ?? '').trim().toUpperCase();
  return value == 'CODE' || value == 'CODE_MENTOR';
}

CodeInputValidation validateOptionalCodeInput(String? input) {
  final value = (input ?? '').trim();
  if (value.isEmpty) {
    return const CodeInputValidation(ok: true, value: '');
  }
  if (value.length > codeMentorMaxChars) {
    return CodeInputValidation(
      ok: false,
      value: value,
      message:
          'Mã nguồn quá dài. Vui lòng giới hạn trong $codeMentorMaxChars ký tự.',
    );
  }
  final lineCount = value.split(RegExp(r'\r\n|\r|\n')).length;
  if (lineCount > codeMentorMaxLines) {
    return CodeInputValidation(
      ok: false,
      value: value,
      message:
          'Mã nguồn quá dài. Vui lòng giới hạn trong $codeMentorMaxLines dòng.',
    );
  }
  return CodeInputValidation(ok: true, value: value);
}
