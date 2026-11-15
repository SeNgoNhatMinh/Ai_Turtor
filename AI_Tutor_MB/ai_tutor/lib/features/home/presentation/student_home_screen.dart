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
    final searchFocusNode = useFocusNode();
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
        final enrolledCourses = data.courses
            .where((course) => course.status != 'COMPLETED')
            .toList();
        final selectedCourse = ref.watch(selectedCourseProvider);
        final activeCourse =
            selectedCourse != null && enrolledCourses.contains(selectedCourse)
            ? selectedCourse
            : (enrolledCourses.isEmpty ? null : enrolledCourses.first);
        final session = ref.read(authControllerProvider).valueOrNull;
        final greetName = _studentGivenName(session?.fullName);
        final heroTitle = activeCourse == null
            ? l10n.homeHeroSubtitle
            : (activeCourse.name.isNotEmpty
                  ? activeCourse.name
                  : activeCourse.code);
        final activeClassName = activeCourse?.className?.trim();
        final heroSubtitle = activeCourse == null
            ? 'Chọn một môn học để bắt đầu'
            : [
                activeCourse.code,
                if (activeClassName != null && activeClassName.isNotEmpty)
                  activeClassName,
              ].join(' · ');

        void continueWithTutor() {
          if (activeCourse != null) {
            ref.read(selectedCourseProvider.notifier).state = activeCourse;
          }
          context.go(AppRoutes.studentTutor);
        }

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
                              studentName: greetName,
                              title: heroTitle,
                              subtitle: heroSubtitle,
                              ctaLabel: 'Tiếp tục với AI Tutor',
                              onCta: continueWithTutor,
                              action: _HeroBell(
                                count: notificationCount,
                                onTap: () =>
                                    context.push(AppRoutes.notifications),
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
                          'Môn học của bạn',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: searchFocusNode.requestFocus,
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.fptBlue,
                          minimumSize: const Size(48, 48),
                          padding: const EdgeInsets.symmetric(
                            horizontal: Insets.sm,
                          ),
                        ),
                        label: const Text('Tìm môn'),
                        icon: const Icon(LucideIcons.search, size: 16),
                      ),
                    ],
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.sm)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.screenH,
                  ),
                  child: PlanASearchField(
                    hint: 'Tìm theo tên môn, mã môn hoặc lớp',
                    controller: searchController,
                    focusNode: searchFocusNode,
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
                    height: 98,
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
                              selected: course == activeCourse,
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
                          title: 'Tiến độ học tập',
                          subtitle: 'Xem quá trình và chủ đề cần cải thiện',
                          icon: LucideIcons.trendingUp,
                          color: AppColors.leafGreen,
                          onTap: () => context.push(AppRoutes.studentProgress),
                        ),
                        PlanAQuickAction(
                          title: 'Không gian môn học',
                          subtitle: 'Mở công cụ học tập theo từng môn',
                          icon: LucideIcons.layoutGrid,
                          color: AppColors.info,
                          onTap: scrollToCourseHub,
                        ),
                      ],
                    ).animate().fadeIn(
                      duration: motionDuration,
                      delay: reduceMotion ? Duration.zero : 20.ms,
                    ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.xl)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.screenH,
                  ),
                  child: Text(
                    'Không gian môn học',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.md)),
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
  const _HeroBell({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: count > 0 ? '$count thông báo chưa đọc' : 'Thông báo',
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        backgroundColor: AppColors.card,
        highlightColor: Colors.black12,
        elevation: 0,
        side: const BorderSide(color: AppColors.borderHairline),
      ),
      icon: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          const Icon(LucideIcons.bell, size: 24, color: AppColors.primary),
          if (count > 0)
            Positioned(
              right: -7,
              top: -7,
              child: Container(
                constraints: const BoxConstraints(minWidth: 19, minHeight: 19),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  border: Border.all(color: AppColors.accentDark),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count > 99 ? '99+' : '$count',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 10,
                    height: 1,
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
