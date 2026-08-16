import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/env.dart';

/// Timeout nhận dữ liệu cho API thường (CRUD).
const defaultReceiveTimeout = Duration(seconds: 30);

/// RAG / LLM (review, quiz, …) — chờ lâu hơn CRUD.
const aiReceiveTimeout = Duration(seconds: 120);

/// Student chat qua n8n — khớp BE `spring.mvc.async.request-timeout` (300s).
const aiChatReceiveTimeout = Duration(seconds: 300);

/// Đăng nhập / đăng ký — backend cold start có thể chậm.
const authReceiveTimeout = Duration(seconds: 180);

typedef UnauthorizedHandler = Future<void> Function();

String normalizeN8nWebhookBase(String value) {
  return '${value.trim().replaceAll(RegExp(r'/+$'), '')}/';
}

String normalizeN8nWorkflowPath(String value) {
  return value.trim().replaceFirst(RegExp(r'^/+'), '');
}

Dio buildDio(
  String baseUrl,
  FlutterSecureStorage storage, {
  Duration receiveTimeout = defaultReceiveTimeout,
  UnauthorizedHandler? onUnauthorized,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: receiveTimeout,
      headers: {'Content-Type': 'application/json; charset=utf-8'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = (await storage.read(key: 'auth_token'))?.trim();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;
        final isAuthRoute =
            path.contains('/api/users/login') ||
            path.contains('/api/users/register');
        if (status == 401 && !isAuthRoute && onUnauthorized != null) {
          await onUnauthorized();
        }
        handler.next(error);
      },
    ),
  );

  return dio;
}

/// CRUD thường → Spring Boot REST (:8085)
Dio buildSpringDio(
  FlutterSecureStorage storage, {
  UnauthorizedHandler? onUnauthorized,
}) => buildDio(Env.apiBaseUrl, storage, onUnauthorized: onUnauthorized);

/// AI flows → n8n webhook (:5678/webhook) including V2 expert-training
Dio buildN8nDio(
  FlutterSecureStorage storage, {
  UnauthorizedHandler? onUnauthorized,
}) {
  final webhookBase = normalizeN8nWebhookBase(Env.n8nWebhook);
  final dio = buildDio(
    webhookBase,
    storage,
    receiveTimeout: aiReceiveTimeout,
    onUnauthorized: onUnauthorized,
  );

  // A leading slash makes Dio discard the `/webhook` path from baseUrl.
  // Normalize all n8n feature paths here so every workflow uses one contract.
  dio.interceptors.insert(
    0,
    InterceptorsWrapper(
      onRequest: (options, handler) {
        options.path = normalizeN8nWorkflowPath(options.path);
        handler.next(options);
      },
    ),
  );
  return dio;
}
