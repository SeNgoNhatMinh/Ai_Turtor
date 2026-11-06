import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../../courses/presentation/widgets/student_course_hub_section.dart';
import '../../notifications/application/notifications_controller.dart';
import '../application/home_controller.dart';
import 'widgets/plan_a_home_blocks.dart';

class StudentHomeScreen extends HookConsumerWidget {
  const StudentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final home = ref.watch(homeControllerProvider);
    final notificationCount = ref.watch(notificationCountProvider);

    final searchController = useTextEditingController();
    final searchQuery = useState('');
    final selectedServiceTab = useState(PlugProServiceTab.primary);
    final scrollController = useScrollController();
    final courseHubKey = useMemoized(GlobalKey.new);
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final motionDuration = reduceMotion ? Duration.zero : Motion.base;

    useListenable(searchController);
    useEffect(() {
      void listener() => searchQuery.value = searchController.text;
      searchController.addListener(listener);
      return () => searchController.removeListener(listener);
    }, [searchController]);

    void scrollToCourseHub() {
      final ctx = courseHubKey.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: Motion.base,
        curve: Curves.easeOutCubic,
        alignment: 0.05,
      );
    }

    List<Course> filterCourses(List<Course> courses) {
      final q = searchQuery.value.trim().toLowerCase();
      final enrolled = courses.where((c) => c.status != 'COMPLETED').toList();
      if (q.isEmpty) return enrolled;
      return enrolled
          .where(
            (c) =>
                c.code.toLowerCase().contains(q) ||
                c.name.toLowerCase().contains(q) ||
                (c.className?.toLowerCase().contains(q) ?? false),
          )
          .toList();
    }

    void onCourseCardTap(Course course) {
      ref.read(selectedCourseProvider.notifier).state = course;
      context.go(AppRoutes.studentTutor);
    }

    return home.when(
      loading: () => const LoadingSkeleton(itemCount: 4),
      error: (error, _) => ErrorState(
        message: describeError(error),
        onRetry: () => ref.invalidate(homeControllerProvider),
      ),
      data: (data) {
        final filteredCourses = filterCourses(data.courses);
        final enrolledCount = data.courses.isNotEmpty
            ? data.courses.length
            : data.dashboard.enrolledCourseCount;
        final session = ref.read(authControllerProvider).valueOrNull;
        final greetName = _studentGivenName(session?.fullName);
        final heroTitle = 'Chào $greetName,\nsẵn sàng học tiếp chưa?';

        return RefreshIndicator(
          color: AppColors.fptOrange,
          onRefresh: () => ref.refresh(homeControllerProvider.future),
          child: CustomScrollView(
            controller: scrollController,
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child:
                    Column(
                          children: [
                            PlanAHomeHero(
                              title: heroTitle,
                              subtitle: l10n.homeHeroSubtitle,
                              ctaLabel: 'Học với AI Tutor',
                              onCta: () => context.go(AppRoutes.studentTutor),
                              action: _HeroBell(
                                hasUnread: notificationCount > 0,
                                onTap: () =>
                                    context.push(AppRoutes.notifications),
                              ),
                            ),
                            Transform.translate(
                              offset: const Offset(0, -22),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: Insets.screenH,
                                ),
                                child: PlanASearchField(
                                  hint: 'Tìm môn học hoặc lớp',
                                  controller: searchController,
                                ),
                              ),
                            ),
                          ],
                        )
                        .animate()
                        .fadeIn(duration: motionDuration)
                        .slideY(
                          begin: 0.03,
                          end: 0,
                          curve: Curves.easeOutCubic,
                        ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.sm)),
              SliverToBoxAdapter(
                child:
                    PlanAIconStats(
                      questionsAsked: data.questionsAsked,
                      questionsLabel: 'Câu đã hỏi',
                      courseCount: enrolledCount,
                      coursesLabel: 'Môn đang học',
                    ).animate().fadeIn(
                      duration: motionDuration,
                      delay: reduceMotion ? Duration.zero : 40.ms,
                    ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.xl)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.screenH,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Môn đang học',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: scrollToCourseHub,
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.fptBlue,
                          minimumSize: const Size(48, 48),
                          padding: const EdgeInsets.symmetric(
                            horizontal: Insets.sm,
                          ),
                        ),
                        label: const Text('Xem tất cả'),
                        icon: const Icon(LucideIcons.arrowRight, size: 16),
                        iconAlignment: IconAlignment.end,
                      ),
                    ],
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.md)),
              if (filteredCourses.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Insets.screenH,
                    ),
                    child: EmptyState(
                      title: l10n.emptyCoursesTitle,
                      message: searchQuery.value.trim().isNotEmpty
                          ? 'Không tìm thấy môn phù hợp với từ khóa.'
                          : l10n.emptyCoursesMessage,
                      ctaLabel: l10n.refresh,
                      onCta: () => ref.invalidate(homeControllerProvider),
                    ),
                  ),
                )
              else
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 186,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: Insets.screenH,
                      ),
                      itemCount: filteredCourses.length,
                      separatorBuilder: (_, __) => const Gap(Insets.md),
                      itemBuilder: (context, index) {
                        final course = filteredCourses[index];
                        return PlanACourseCard(
                              course: course,
                              index: index,
                              onTap: () => onCourseCardTap(course),
                            )
                            .animate(
                              delay: reduceMotion
                                  ? Duration.zero
                                  : (40 * index).clamp(0, 200).ms,
                            )
                            .fadeIn(duration: motionDuration)
                            .slideX(
                              begin: 0.06,
                              end: 0,
                              curve: Curves.easeOutCubic,
                            );
                      },
                    ),
                  ),
                ),
              const SliverToBoxAdapter(child: Gap(Insets.xl)),
              SliverToBoxAdapter(
                child:
                    PlanAQuickActions(
                      actions: [
                        PlanAQuickAction(
                          title: 'AI Tutor',
                          subtitle: 'Học theo tài liệu môn học',
                          icon: LucideIcons.sparkles,
                          color: AppColors.peacockBlue,
                          onTap: () => context.go(AppRoutes.studentTutor),
                        ),
                        PlanAQuickAction(
                          title: 'Quiz',
                          subtitle: 'Luyện tập và kiểm tra nhanh',
                          icon: LucideIcons.clipboardList,
                          color: AppColors.fptOrange,
                          onTap: () {
                            final course =
                                ref.read(selectedCourseProvider) ??
                                (filteredCourses.isNotEmpty
                                    ? filteredCourses.first
                                    : null);
                            if (course != null) {
                              ref.read(selectedCourseProvider.notifier).state =
                                  course;
                            }
                            context.push(AppRoutes.studentQuiz);
                          },
                        ),
                        PlanAQuickAction(
                          title: 'Tài liệu',
                          subtitle: 'Xem học liệu và nộp bài',
                          icon: LucideIcons.bookOpen,
                          color: AppColors.leafGreen,
                          onTap: () => context.push(AppRoutes.studentMaterials),
                        ),
                        PlanAQuickAction(
                          title: 'Hỗ trợ',
                          subtitle: 'Theo dõi yêu cầu mentor',
                          icon: LucideIcons.lifeBuoy,
                          color: AppColors.primary,
                          onTap: () =>
                              context.push(AppRoutes.escalationHistory),
                        ),
                        PlanAQuickAction(
                          title: 'Tiến độ',
                          subtitle: 'Chủ đề yếu và gợi ý ôn tập',
                          icon: LucideIcons.trendingUp,
                          color: AppColors.accent,
                          onTap: () => context.push(AppRoutes.studentProgress),
                        ),
                      ],
                    ).animate().fadeIn(
                      duration: motionDuration,
                      delay: reduceMotion ? Duration.zero : 20.ms,
                    ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.xl)),
              SliverToBoxAdapter(
                child: const PlugProSectionHeader(title: 'Học theo môn'),
              ),
              SliverToBoxAdapter(
                child: KeyedSubtree(
                  key: courseHubKey,
                  child: StudentCourseHubSection(
                    courses: filteredCourses,
                    serviceTab: selectedServiceTab.value,
                    onServiceTabChanged: (PlugProServiceTab tab) =>
                        selectedServiceTab.value = tab,
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.xxxl)),
            ],
          ),
        );
      },
    );
  }
}

class _HeroBell extends StatelessWidget {
  const _HeroBell({required this.hasUnread, required this.onTap});

  final bool hasUnread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: hasUnread ? 'Thông báo chưa đọc' : 'Thông báo',
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        backgroundColor: Colors.transparent,
        highlightColor: Colors.black12,
        elevation: 0,
      ),
      icon: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          const Icon(LucideIcons.bell, size: 24, color: AppColors.primary),
          if (hasUnread)
            const Positioned(
              right: 1,
              top: 1,
              child: SizedBox(
                width: 8,
                height: 8,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.fptOrange,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String _studentGivenName(String? fullName) {
  final parts = (fullName ?? '').trim().split(RegExp(r'\s+'));
  parts.removeWhere((part) => part.isEmpty);
  if (parts.isEmpty) return 'bạn';
  return parts.last;
}
