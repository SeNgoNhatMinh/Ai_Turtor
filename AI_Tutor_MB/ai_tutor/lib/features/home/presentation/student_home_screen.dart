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
import '../../courses/application/courses_controller.dart';
import '../../courses/presentation/widgets/student_course_hub_section.dart';
import '../../notifications/application/notifications_controller.dart';
import '../../auth/application/auth_controller.dart';
import '../application/home_controller.dart';

class StudentHomeScreen extends HookConsumerWidget {
  const StudentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final home = ref.watch(homeControllerProvider);
    final notificationCount = ref.watch(notificationCountProvider);

    final session = ref.watch(authControllerProvider).valueOrNull;
    final displayName = (session?.fullName ?? '').trim().isNotEmpty
        ? session!.fullName.trim()
        : 'bạn';
    final searchController = useTextEditingController();
    final searchQuery = useState('');
    final selectedCategory = useState('all');
    final selectedServiceTab = useState(PlugProServiceTab.primary);
    final scrollController = useScrollController();
    final courseHubKey = useMemoized(GlobalKey.new);

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

    final categoryPills = [
      PlugProPill(id: 'all', label: 'Tất cả', icon: LucideIcons.layoutGrid),
      PlugProPill(
        id: 'tutor',
        label: 'Hỏi AI',
        icon: LucideIcons.sparkles,
      ),
      PlugProPill(id: 'quiz', label: 'Quiz', icon: LucideIcons.clipboardList),
      PlugProPill(
        id: 'improve',
        label: 'Ôn tập',
        icon: LucideIcons.trendingUp,
      ),
    ];

    void onCategorySelected(String id) {
      selectedCategory.value = id;
      switch (id) {
        case 'tutor':
          context.go(AppRoutes.studentTutor);
        case 'quiz':
          selectedServiceTab.value = PlugProServiceTab.secondary;
          scrollToCourseHub();
        case 'improve':
          final course = ref.read(selectedCourseProvider);
          if (course != null) {
            context.go(AppRoutes.studentImprovePlan(course.id));
          } else {
            selectedServiceTab.value = PlugProServiceTab.tertiary;
            scrollToCourseHub();
          }
        case 'all':
          break;
      }
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

    String coursePrefix(String code) {
      final cleaned = code.trim();
      if (cleaned.isEmpty) return '—';
      final match = RegExp(r'^[A-Za-z]+').firstMatch(cleaned);
      if (match != null) return match.group(0)!.toUpperCase();
      return cleaned.length >= 3
          ? cleaned.substring(0, 3).toUpperCase()
          : cleaned.toUpperCase();
    }

    void onCourseCardTap(Course course) {
      ref.read(selectedCourseProvider.notifier).state = course;
      scrollToCourseHub();
    }

    return home.when(
      loading: () => const LoadingSkeleton(itemCount: 4),
      error: (error, _) => ErrorState(
        message: describeError(error),
        onRetry: () => ref.invalidate(homeControllerProvider),
      ),
      data: (data) {
        final filteredCourses = filterCourses(data.courses);

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => ref.refresh(homeControllerProvider.future),
          child: CustomScrollView(
            controller: scrollController,
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: PortalCompactHeader.greeting(
                  eyebrow: 'Xin chào,',
                  title: '$displayName!',
                  actions: [
                    PlugProIconButton(
                      icon: LucideIcons.bell,
                      badge: notificationCount > 0,
                      onTap: () => context.push(AppRoutes.notifications),
                    ),
                  ],
                ),
              ),
              SliverToBoxAdapter(
                child: PlugProSearchBar(
                  hint: 'Tìm khóa học, bài học...',
                  controller: searchController,
                  onFilterTap: scrollToCourseHub,
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.md)),
              SliverToBoxAdapter(
                child: PlugProPills(
                  pills: categoryPills,
                  selectedId: selectedCategory.value,
                  onSelected: onCategorySelected,
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.lg)),
              SliverToBoxAdapter(
                child: PlugProHeroCard(
                  tag: 'Phổ biến',
                  title: l10n.homeHeroTitle,
                  subtitle: l10n.homeHeroSubtitle,
                  ctaLabel: 'Hỏi ngay',
                  onCta: () => context.go(AppRoutes.studentTutor),
                ).animate().fadeIn(duration: Motion.base).slideY(
                  begin: 0.05,
                  end: 0,
                  curve: Curves.easeOutCubic,
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.lg)),
              SliverToBoxAdapter(
                child: PlugProStatsRow(
                  leftValue: data.questionsAsked,
                  leftLabel: l10n.questionsAskedStat,
                  rightValue: data.courses.isNotEmpty
                      ? data.courses.length
                      : data.dashboard.enrolledCourseCount,
                  rightLabel: l10n.enrolledCoursesStat,
                ).animate().fadeIn(duration: Motion.base, delay: 40.ms),
              ),
              SliverToBoxAdapter(
                child: PlugProSectionHeader(
                  title: 'Khóa học nổi bật',
                  trailing: filteredCourses.isNotEmpty
                      ? Text(
                          '${filteredCourses.length} môn',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                            color: AppColors.textTertiary,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : null,
                ),
              ),
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
                    height: 230,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: Insets.screenH,
                      ),
                      itemCount: filteredCourses.length,
                      separatorBuilder: (_, __) => const Gap(Insets.md),
                      itemBuilder: (context, index) {
                        final course = filteredCourses[index];
                        return PlugProProviderCard(
                          title: course.name.isNotEmpty
                              ? course.name
                              : course.code,
                          badge: coursePrefix(course.code),
                          colorKey: course.id,
                          index: index,
                          subtitle: course.className ?? course.semester,
                          onTap: () => onCourseCardTap(course),
                        )
                            .animate(delay: (40 * index).clamp(0, 200).ms)
                            .fadeIn(duration: Motion.base)
                            .slideX(
                              begin: 0.06,
                              end: 0,
                              curve: Curves.easeOutCubic,
                            );
                      },
                    ),
                  ),
                ),
              const SliverToBoxAdapter(child: Gap(Insets.lg)),
              SliverToBoxAdapter(
                child: PlugProSectionHeader(
                  title: l10n.tabClasses,
                ),
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
