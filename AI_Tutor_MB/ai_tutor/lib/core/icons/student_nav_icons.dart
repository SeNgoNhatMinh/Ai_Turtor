import 'package:font_awesome_flutter/font_awesome_flutter.dart';

/// Icon bottom nav sinh viên — tương đương fa-light (free: Regular/Solid).
abstract final class StudentNavIcons {
  /// fa-light fa-house
  static const home = FontAwesomeIcons.house;

  /// fa-light fa-book (free chỉ có solid)
  static const courses = FontAwesomeIcons.book;

  /// fa-light fa-comment-dots — tab trung tâm "Ask Cóc" (AI Tutor chat)
  static const tutor = FontAwesomeIcons.commentDots;

  /// fa-light fa-ballot (free: clipboard-list)
  static const assignments = FontAwesomeIcons.clipboardList;

  /// fa-light fa-user
  static const profile = FontAwesomeIcons.user;
}
