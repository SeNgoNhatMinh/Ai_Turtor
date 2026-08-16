import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

typedef PillStyle = (Color fg, Color bg, String label);

PillStyle statusStyleFor(String domain, String value) => switch ((
  domain,
  value,
)) {
  ('escalation', 'PENDING_OFFER') => (
    AppColors.warning,
    AppColors.warningBg,
    'Đang tìm người hỗ trợ',
  ),
  ('escalation', 'OFFERED') => (
    AppColors.info,
    AppColors.infoBg,
    'Đã đề xuất mentor',
  ),
  ('escalation', 'IN_CHAT') => (
    AppColors.primary,
    AppColors.primaryWash,
    'Đang trò chuyện',
  ),
  ('escalation', 'COMPLETED') => (
    AppColors.success,
    AppColors.successBg,
    'Đã hoàn tất',
  ),
  ('escalation', 'CANCELLED') => (
    AppColors.warm500,
    AppColors.warm100,
    'Đã huỷ',
  ),
  ('submission', 'SUBMITTED') => (AppColors.info, AppColors.infoBg, 'Đã nộp'),
  ('submission', 'PENDING') => (
    AppColors.warm500,
    AppColors.warm100,
    'Chưa nộp',
  ),
  ('submission', 'REVIEWED') => (
    AppColors.success,
    AppColors.successBg,
    'Đã chấm',
  ),
  ('submission', 'LATE') => (AppColors.error, AppColors.errorBg, 'Trễ hạn'),
  ('candidate', 'PENDING_SENIOR_REVIEW') => (
    AppColors.warning,
    AppColors.warningBg,
    'Chờ Senior duyệt',
  ),
  ('candidate', 'INDEXED') => (
    AppColors.success,
    AppColors.successBg,
    'Đã vào AI',
  ),
  ('candidate', 'REJECTED') => (
    AppColors.error,
    AppColors.errorBg,
    'Bị từ chối',
  ),
  ('chatroom', 'ACTIVE') => (AppColors.success, AppColors.successBg, 'Đang mở'),
  ('chatroom', 'CLOSED') => (AppColors.warm500, AppColors.warm100, 'Đã đóng'),
  ('chatroom', 'ENDED') => (AppColors.warm700, AppColors.warm100, 'Kết thúc'),
  ('risk', 'HIGH') => (AppColors.error, AppColors.errorBg, 'Rủi ro cao'),
  ('risk', 'MEDIUM') => (AppColors.warning, AppColors.warningBg, 'Trung bình'),
  ('risk', 'LOW') => (AppColors.success, AppColors.successBg, 'Ổn định'),
  ('enrollment', 'ACTIVE') => (
    AppColors.primary,
    AppColors.primaryWash,
    'Đang học',
  ),
  ('enrollment', 'COMPLETED') => (
    AppColors.warm500,
    AppColors.warm100,
    'Đã hoàn thành',
  ),
  ('review', 'NEEDS_MENTOR_REVIEW') => (
    AppColors.warning,
    AppColors.warningBg,
    'Chờ mentor xem',
  ),
  ('review', 'NEEDS_SENIOR_REVIEW') => (
    AppColors.info,
    AppColors.infoBg,
    'Chờ Senior duyệt',
  ),
  ('review', 'RESOLVED') => (
    AppColors.success,
    AppColors.successBg,
    'Đã xử lý',
  ),
  ('review', 'REJECTED') => (AppColors.error, AppColors.errorBg, 'Đã từ chối'),
  ('task', 'OPEN') => (AppColors.info, AppColors.infoBg, 'Chưa nhận'),
  ('task', 'ASSIGNED') => (
    AppColors.primary,
    AppColors.primaryWash,
    'Đã nhận',
  ),
  ('task', 'IN_PROGRESS') => (
    AppColors.warning,
    AppColors.warningBg,
    'Đang làm',
  ),
  ('task', 'SUBMITTED') => (
    AppColors.info,
    AppColors.infoBg,
    'Chờ duyệt',
  ),
  ('task', 'COMPLETED') => (
    AppColors.success,
    AppColors.successBg,
    'Hoàn thành',
  ),
  ('task', 'CANCELLED') => (
    AppColors.warm500,
    AppColors.warm100,
    'Đã huỷ',
  ),
  ('gap', 'OPEN') => (AppColors.warning, AppColors.warningBg, 'Thiếu dữ liệu'),
  ('gap', 'TASK_CREATED') => (
    AppColors.info,
    AppColors.infoBg,
    'Đã tạo task',
  ),
  ('gap', 'RESOLVED') => (
    AppColors.success,
    AppColors.successBg,
    'Đã đủ coverage',
  ),
  ('gap', 'CRITICAL') => (AppColors.error, AppColors.errorBg, 'Nghiêm trọng'),
  ('gap', 'HIGH') => (AppColors.warning, AppColors.warningBg, 'Cao'),
  ('gap', 'MEDIUM') => (AppColors.info, AppColors.infoBg, 'Trung bình'),
  _ => (AppColors.warm700, AppColors.warm100, value),
};

bool isTeacherRole(String role) =>
    {'TEACHER', 'MENTOR', 'SENIOR_MENTOR', 'ADMIN'}.contains(role);

bool isSeniorRole(String role) => {'SENIOR_MENTOR', 'ADMIN'}.contains(role);

bool isAdminRole(String role) => role == 'ADMIN';
