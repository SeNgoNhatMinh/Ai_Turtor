import 'package:ai_tutor/core/utils/reviewed_message_ids.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses and encodes reviewed message ids', () {
    expect(parseReviewedMessageIds(null), isEmpty);
    expect(parseReviewedMessageIds(' a, ,b '), {'a', 'b'});
    expect(encodeReviewedMessageIds({'m1', 'm2'}), 'm1,m2');
    expect(
      reviewedMessageIdsStorageKey('c1'),
      'reviewed_message_ids_c1',
    );
  });
}
