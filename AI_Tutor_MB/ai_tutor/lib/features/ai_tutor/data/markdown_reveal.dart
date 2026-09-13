const revealMinChars = 32;

String revealSourceMarkdown(String markdown) {
  return markdown;
}

bool shouldRevealAnswer({
  required bool enabled,
  required String markdown,
  bool reducedMotion = false,
}) {
  if (!enabled || reducedMotion) return false;
  return revealSourceMarkdown(markdown).trim().length >= revealMinChars;
}

int revealStepSize(int length) {
  if (length <= 0) return 1;
  final frames = (length / 16).round().clamp(28, 120);
  return (length / frames).ceil().clamp(6, length);
}

int nextRevealIndex(String full, int current, int step) {
  final text = full;
  final from = current < 0 ? 0 : current;
  if (from >= text.length) return text.length;
  final stride = step < 1 ? 1 : step;
  var target = from + stride;
  if (target >= text.length) return text.length;
  var extra = 0;
  while (target < text.length && !RegExp(r'\s').hasMatch(text[target])) {
    target += 1;
    extra += 1;
    if (extra > 18) break;
  }
  if (target < text.length && RegExp(r'\s').hasMatch(text[target])) {
    target += 1;
  }
  return target;
}
