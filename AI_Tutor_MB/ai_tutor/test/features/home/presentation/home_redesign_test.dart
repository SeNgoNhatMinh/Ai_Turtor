import 'package:ai_tutor/features/home/presentation/widgets/plan_a_home_blocks.dart';
import 'package:ai_tutor/shared/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

void main() {
  const prj = Course(
    id: 'prj301',
    code: 'PRJ301',
    name: 'Dự án học phần 1',
    className: 'SE1801',
  );
  testWidgets('search clear, course card and quick action keep callbacks', (
    tester,
  ) async {
    final searchController = TextEditingController(text: 'PRJ');
    addTearDown(searchController.dispose);
    var courseTaps = 0;
    var actionTaps = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                PlanASearchField(
                  hint: 'Tìm môn học hoặc lớp',
                  controller: searchController,
                ),
                SizedBox(
                  height: 186,
                  child: PlanACourseCard(
                    course: prj,
                    index: 0,
                    onTap: () => courseTaps++,
                  ),
                ),
                PlanAQuickActions(
                  actions: [
                    PlanAQuickAction(
                      title: 'AI Tutor',
                      subtitle: 'Học theo tài liệu môn học',
                      icon: LucideIcons.sparkles,
                      color: const Color(0xFF0A56A0),
                      onTap: () => actionTaps++,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('Xóa tìm kiếm'));
    expect(searchController.text, isEmpty);

    await tester.tap(find.text('Dự án học phần 1'));
    await tester.tap(find.text('AI Tutor'));
    expect(courseTaps, 1);
    expect(actionTaps, 1);
  });

  testWidgets('plan A hero and two utilities fit a narrow phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var heroTaps = 0;

    PlanAQuickAction action(String title, IconData icon, Color color) {
      return PlanAQuickAction(
        title: title,
        subtitle: title,
        icon: icon,
        color: color,
        onTap: () {},
      );
    }

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                PlanAHomeHero(
                  studentName: 'Nguyễn Minh Anh',
                  title: 'Phát triển ứng dụng di động đa nền tảng',
                  subtitle: 'MOB104 · SE1843',
                  ctaLabel: 'Tiếp tục với AI Tutor',
                  onCta: () => heroTaps++,
                  action: const SizedBox(width: 48, height: 48),
                ),
                PlanAQuickActions(
                  actions: [
                    action(
                      'Tiến độ học tập',
                      LucideIcons.trendingUp,
                      Colors.green,
                    ),
                    action(
                      'Không gian môn học',
                      LucideIcons.layoutGrid,
                      Colors.blue,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('AI Tutor'), findsOneWidget);
    expect(find.text('Môn đang học'), findsOneWidget);
    expect(find.text('Quiz'), findsNothing);
    expect(find.text('Tài liệu'), findsNothing);
    expect(find.text('Hỗ trợ'), findsNothing);
    await tester.tap(find.text('Tiếp tục với AI Tutor'));
    expect(heroTaps, 1);
  });

  testWidgets('plan A remains usable at 200 percent text scaling', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                PlanAHomeHero(
                  studentName: 'Nguyễn Minh Anh',
                  title: 'Phát triển ứng dụng di động đa nền tảng',
                  subtitle: 'MOB104 · SE1843',
                  ctaLabel: 'Tiếp tục với AI Tutor',
                  onCta: () {},
                  action: const SizedBox(width: 48, height: 48),
                ),
                PlanAQuickActions(
                  actions: [
                    PlanAQuickAction(
                      title: 'Tiến độ học tập',
                      subtitle: 'Xem quá trình và chủ đề cần cải thiện',
                      icon: LucideIcons.trendingUp,
                      color: Colors.green,
                      onTap: () {},
                    ),
                    PlanAQuickAction(
                      title: 'Không gian môn học',
                      subtitle: 'Mở công cụ học tập theo từng môn',
                      icon: LucideIcons.layoutGrid,
                      color: Colors.blue,
                      onTap: () {},
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Tiếp tục với AI Tutor'), findsOneWidget);
    expect(find.text('Không gian môn học'), findsOneWidget);
  });
}
