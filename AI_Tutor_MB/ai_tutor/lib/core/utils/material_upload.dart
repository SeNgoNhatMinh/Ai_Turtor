import 'package:file_picker/file_picker.dart';

/// Backend `ai-tutor-api` chỉ nhận PDF (multipart `/materials/upload`).
const materialUploadAllowedExtensions = ['pdf'];

const materialUploadMaxSizeBytes = 50 * 1024 * 1024;

Future<PlatformFile?> pickCourseMaterialPdf() async {
  final result = await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: materialUploadAllowedExtensions,
    withData: false,
  );
  if (result == null || result.files.isEmpty) return null;
  return result.files.first;
}

String? validateCourseMaterialPdfFile(PlatformFile file) {
  final name = (file.name).toLowerCase();
  if (!name.endsWith('.pdf')) {
    return 'Backend chỉ hỗ trợ file PDF.';
  }
  final size = file.size;
  if (size > 0 && size > materialUploadMaxSizeBytes) {
    return 'File vượt quá 50 MB.';
  }
  return null;
}
