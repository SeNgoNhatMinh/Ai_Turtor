import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/admin_models.dart';
import '../../../shared/models/class_section.dart';
import '../../../shared/models/course.dart';
import '../data/admin_repository.dart';

// ── Dashboard stats ───────────────────────────────────────────────

class AdminStatsController extends AutoDisposeAsyncNotifier<AdminStats> {
  @override
  Future<AdminStats> build() {
    return ref.read(adminRepositoryProvider).getDashboardStats();
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
  }
}

final adminStatsProvider =
    AutoDisposeAsyncNotifierProvider<AdminStatsController, AdminStats>(
        AdminStatsController.new);

// ── Users ─────────────────────────────────────────────────────────

class AdminUsersController
    extends AutoDisposeAsyncNotifier<List<AdminUser>> {
  String _query = '';
  String _roleFilter = '';

  @override
  Future<List<AdminUser>> build() {
    return ref.read(adminRepositoryProvider).listUsers();
  }

  Future<void> search(String query, {String role = ''}) async {
    _query = query;
    _roleFilter = role;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() =>
        ref.read(adminRepositoryProvider).listUsers(
              query: _query,
              role: _roleFilter.isEmpty ? null : _roleFilter,
            ));
  }

  Future<void> setActive(String userId, {required bool active}) async {
    await ref.read(adminRepositoryProvider).updateUser(userId, isActive: active);
    ref.invalidateSelf();
  }

  Future<void> changeRole(String userId, String newRole) async {
    await ref.read(adminRepositoryProvider).updateUser(userId, role: newRole);
    ref.invalidateSelf();
  }

  Future<void> delete(String userId) async {
    await ref.read(adminRepositoryProvider).deleteUser(userId);
    ref.invalidateSelf();
  }
}

final adminUsersProvider =
    AutoDisposeAsyncNotifierProvider<AdminUsersController, List<AdminUser>>(
        AdminUsersController.new);

// ── Semesters ─────────────────────────────────────────────────────

class AdminSemestersController
    extends AutoDisposeAsyncNotifier<List<Semester>> {
  @override
  Future<List<Semester>> build() {
    return ref.read(adminRepositoryProvider).listSemesters();
  }

  Future<void> save({
    required String semesterCode,
    String? name,
    String status = 'ACTIVE',
  }) async {
    await ref.read(adminRepositoryProvider).saveSemester(
          semesterCode: semesterCode,
          name: name,
          status: status,
        );
    ref.invalidateSelf();
  }

  Future<void> delete(String semesterCode) async {
    await ref.read(adminRepositoryProvider).deleteSemester(semesterCode);
    ref.invalidateSelf();
  }
}

final adminSemestersProvider =
    AutoDisposeAsyncNotifierProvider<AdminSemestersController, List<Semester>>(
        AdminSemestersController.new);

// ── All Courses (admin view) ──────────────────────────────────────

class AdminCoursesController extends AutoDisposeAsyncNotifier<List<Course>> {
  @override
  Future<List<Course>> build() {
    return ref.read(adminRepositoryProvider).listAllCourses();
  }

  Future<void> save({
    required String courseId,
    required String courseCode,
    required String name,
    String? semesterCode,
  }) async {
    await ref.read(adminRepositoryProvider).saveCourse(
          courseId: courseId,
          courseCode: courseCode,
          name: name,
          semesterCode: semesterCode,
        );
    ref.invalidateSelf();
  }

  Future<void> delete(String courseId) async {
    await ref.read(adminRepositoryProvider).deleteCourse(courseId);
    ref.invalidateSelf();
  }

  Future<void> markComplete(String courseId) async {
    await ref.read(adminRepositoryProvider).completeCourse(courseId);
    ref.invalidateSelf();
  }
}

final adminCoursesProvider =
    AutoDisposeAsyncNotifierProvider<AdminCoursesController, List<Course>>(
        AdminCoursesController.new);

// ── Classes for a given course (admin view) ───────────────────────

class AdminClassesController
    extends AutoDisposeFamilyAsyncNotifier<List<ClassSection>, String> {
  @override
  Future<List<ClassSection>> build(String courseId) {
    return ref.read(adminRepositoryProvider).listAllClasses(courseId);
  }

  Future<void> save({
    required String courseId,
    required String classId,
    required String className,
    String? teacherId,
  }) async {
    await ref.read(adminRepositoryProvider).saveClassSection(
          courseId: courseId,
          classId: classId,
          className: className,
          teacherId: teacherId,
        );
    ref.invalidateSelf();
  }

  Future<void> delete(String courseId, String classId) async {
    await ref.read(adminRepositoryProvider).deleteClassSection(courseId, classId);
    ref.invalidateSelf();
  }

  Future<void> markComplete(String courseId, String classId) async {
    await ref.read(adminRepositoryProvider).completeClassSection(courseId, classId);
    ref.invalidateSelf();
  }
}

final adminClassesProvider = AutoDisposeAsyncNotifierProviderFamily<
    AdminClassesController, List<ClassSection>, String>(
    AdminClassesController.new);

// ── Class roster (single-student enroll/remove) ───────────────────

typedef RosterScope = ({String courseId, String classId});

class AdminClassRosterController
    extends AutoDisposeFamilyAsyncNotifier<List<Map<String, dynamic>>, RosterScope> {
  @override
  Future<List<Map<String, dynamic>>> build(RosterScope scope) {
    return ref.read(adminRepositoryProvider).listClassStudents(scope.courseId, scope.classId);
  }

  Future<void> enroll({
    required String studentId,
    String? studentName,
    String? studentEmail,
  }) async {
    await ref.read(adminRepositoryProvider).enrollStudent(
          courseId: arg.courseId,
          classId: arg.classId,
          studentId: studentId,
          studentName: studentName,
          studentEmail: studentEmail,
        );
    ref.invalidateSelf();
  }

  Future<void> remove(String studentId) async {
    await ref.read(adminRepositoryProvider).removeStudentFromClass(
          courseId: arg.courseId,
          classId: arg.classId,
          studentId: studentId,
        );
    ref.invalidateSelf();
  }
}

final adminClassRosterProvider = AutoDisposeAsyncNotifierProviderFamily<
    AdminClassRosterController, List<Map<String, dynamic>>, RosterScope>(
    AdminClassRosterController.new);

// ── Subscription plans ────────────────────────────────────────────

class AdminPlansController
    extends AutoDisposeAsyncNotifier<List<SubscriptionPlan>> {
  @override
  Future<List<SubscriptionPlan>> build() {
    return ref.read(adminRepositoryProvider).listPlans();
  }

  Future<void> updatePlan(
    String planId, {
    String? name,
    String? description,
    double? price,
    int? durationDays,
    bool? isActive,
  }) async {
    await ref.read(adminRepositoryProvider).updatePlan(
          planId,
          name: name,
          description: description,
          price: price,
          durationDays: durationDays,
          isActive: isActive,
        );
    ref.invalidateSelf();
  }
}

final adminPlansProvider =
    AutoDisposeAsyncNotifierProvider<AdminPlansController, List<SubscriptionPlan>>(
        AdminPlansController.new);

// ── User subscriptions ────────────────────────────────────────────

class AdminSubscriptionsController
    extends AutoDisposeAsyncNotifier<List<UserSubscription>> {
  @override
  Future<List<UserSubscription>> build() {
    return ref.read(adminRepositoryProvider).listSubscriptions();
  }

  Future<void> assign({required String userId, required String planCode}) async {
    await ref.read(adminRepositoryProvider).assignPlan(
          userId: userId,
          planCode: planCode,
        );
    ref.invalidateSelf();
  }

  Future<void> delete(String subscriptionId) async {
    await ref.read(adminRepositoryProvider).deleteSubscription(subscriptionId);
    ref.invalidateSelf();
  }

  Future<void> updateStatus(String subscriptionId, String status) async {
    await ref.read(adminRepositoryProvider).updateSubscriptionStatus(subscriptionId, status);
    ref.invalidateSelf();
  }
}

final adminSubscriptionsProvider =
    AutoDisposeAsyncNotifierProvider<AdminSubscriptionsController, List<UserSubscription>>(
        AdminSubscriptionsController.new);

// ── Mentors (admin management) ────────────────────────────────────

class AdminMentorsController extends AutoDisposeAsyncNotifier<List<AdminMentor>> {
  String _query = '';
  bool? _activeFilter;

  @override
  Future<List<AdminMentor>> build() {
    return ref.read(adminRepositoryProvider).listMentors();
  }

  Future<void> search(String query, {bool? active}) async {
    _query = query;
    _activeFilter = active;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(adminRepositoryProvider).listMentors(
          query: _query,
          active: _activeFilter,
        ));
  }

  Future<void> setActive(String mentorId, {required bool active}) async {
    await ref.read(adminRepositoryProvider).updateMentor(mentorId, isActive: active);
    ref.invalidateSelf();
  }

  Future<void> setVerified(String mentorId, {required bool verified}) async {
    await ref.read(adminRepositoryProvider).updateMentor(mentorId, verified: verified);
    ref.invalidateSelf();
  }

  Future<void> delete(String mentorId) async {
    await ref.read(adminRepositoryProvider).deleteMentor(mentorId);
    ref.invalidateSelf();
  }
}

final adminMentorsProvider =
    AutoDisposeAsyncNotifierProvider<AdminMentorsController, List<AdminMentor>>(
        AdminMentorsController.new);

// ── Mentor escalations (admin oversight) ──────────────────────────

class AdminMentorEscalationsController
    extends AutoDisposeAsyncNotifier<List<AdminMentorEscalation>> {
  @override
  Future<List<AdminMentorEscalation>> build() {
    return ref.read(adminRepositoryProvider).listMentorEscalations();
  }

  Future<void> delete(String escalationId) async {
    await ref.read(adminRepositoryProvider).deleteMentorEscalation(escalationId);
    ref.invalidateSelf();
  }
}

final adminMentorEscalationsProvider = AutoDisposeAsyncNotifierProvider<
    AdminMentorEscalationsController, List<AdminMentorEscalation>>(
    AdminMentorEscalationsController.new);
