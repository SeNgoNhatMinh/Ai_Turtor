import 'package:ai_tutor/shared/models/rag_source_evidence.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses chunk provenance and shows only verified PDF pages', () {
    final verified = RagSourceEvidence.fromJson({
      'materialId': 'material-1',
      'chunkId': 'chunk-1',
      'materialTitle': 'Giáo trình Java',
      'chapter': 'Servlet',
      'pageStart': 12,
      'pageEnd': 13,
      'pageEstimated': false,
    });
    final estimated = RagSourceEvidence.fromJson({
      'materialId': 'material-1',
      'chunkId': 'chunk-2',
      'materialTitle': 'Giáo trình Java',
      'pageStart': 20,
      'pageEstimated': true,
    });

    expect(verified.chunkId, 'chunk-1');
    expect(verified.pageLabel, 'Trang PDF 12–13');
    expect(verified.subtitle, 'Servlet · Vị trí chính xác: Trang PDF 12–13');
    expect(estimated.pageLabel, 'Chưa đối chiếu được với trang PDF gốc');
  });
}
