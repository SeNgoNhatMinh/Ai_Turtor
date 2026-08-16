import 'package:dio/dio.dart';

import '../utils/json_helpers.dart';

/// Business error from Spring (`code` + `error`) or n8n (`code` + `message`).
class ApiBusinessException implements Exception {
  ApiBusinessException({
    required this.message,
    this.code,
    this.dailyLimit,
    this.resetAt,
  });

  final String message;
  final String? code;
  final int? dailyLimit;
  final DateTime? resetAt;

  bool get isDailyQuestionLimitReached =>
      code == 'DAILY_QUESTION_LIMIT_REACHED';

  @override
  String toString() => message;
}

ApiBusinessException? parseApiBusinessError(dynamic data) {
  if (data is! Map) return null;
  final map = Map<String, dynamic>.from(data);
  final code = map['code']?.toString();
  final message = map['message']?.toString() ?? map['error']?.toString();
  if (message == null || message.isEmpty) return null;
  if (code == null && map['success'] != false && map['ok'] != false) {
    return null;
  }
  return ApiBusinessException(
    message: message,
    code: code,
    dailyLimit: (map['dailyLimit'] as num?)?.toInt(),
    resetAt: parseDateTime(map['resetAt']),
  );
}

ApiBusinessException? apiBusinessExceptionFromDio(DioException error) {
  final parsed = parseApiBusinessError(error.response?.data);
  if (parsed != null) return parsed;
  if (error.response?.statusCode == 429) {
    return ApiBusinessException(
      message: mapDioMessage(error) ??
          'Bạn đã hết lượt hỏi AI hôm nay. Vui lòng thử lại vào ngày mai.',
      code: 'DAILY_QUESTION_LIMIT_REACHED',
    );
  }
  return null;
}

String describeError(Object error) {
  if (error is ApiBusinessException) {
    return error.message;
  }
  if (error is DioException) {
    final business = apiBusinessExceptionFromDio(error);
    if (business != null) return business.message;
    final serverMessage = mapDioMessage(error);
    if (serverMessage != null) return serverMessage;
    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.connectionError =>
        'Mất kết nối tới máy chủ. Kiểm tra mạng và thử lại.',
      DioExceptionType.badResponse => switch (error.response?.statusCode) {
        401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.',
        403 => 'Không có quyền hoặc token không hợp lệ. Hãy đăng xuất và đăng nhập lại.',
        429 =>
          'Bạn đã hết lượt hỏi AI hôm nay. Vui lòng thử lại vào ngày mai.',
        _ => 'Máy chủ phản hồi lỗi (${error.response?.statusCode}). Thử lại sau.',
      },
      _ => 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    };
  }
  if (error is FormatException) {
    return error.message;
  }
  if (error is StateError) {
    return error.message;
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/// Thông báo lỗi riêng cho đăng nhập / đăng ký.
String describeAuthError(Object error) {
  if (error is DioException) {
    final serverMessage = mapDioMessage(error);
    if (serverMessage != null) return serverMessage;

    final status = error.response?.statusCode;
    if (status == 401 || status == 403) {
      return 'Email hoặc mật khẩu không đúng.';
    }
    if (status == 404) {
      return 'Tài khoản không tồn tại.';
    }

    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout =>
        'Máy chủ phản hồi quá chậm. Kiểm tra backend đang chạy và thử lại.',
      DioExceptionType.connectionError =>
        'Không kết nối được máy chủ. Kiểm tra mạng hoặc địa chỉ API.',
      DioExceptionType.badResponse =>
        'Đăng nhập thất bại (${error.response?.statusCode}). Thử lại sau.',
      _ => 'Đăng nhập thất bại. Vui lòng thử lại.',
    };
  }
  if (error is StateError) {
    return error.message;
  }
  return 'Đăng nhập thất bại. Vui lòng thử lại.';
}
