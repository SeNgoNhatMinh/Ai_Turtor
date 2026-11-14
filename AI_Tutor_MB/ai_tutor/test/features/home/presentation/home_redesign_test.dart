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

  testWidgets('plan A hero and four tools fit a narrow phone', (tester) async {
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
                  title: 'Tiếp tục học với AI Tutor',
                  subtitle: 'Phát triển ứng dụng di động đa nền tảng',
                  ctaLabel: 'Tiếp tục hỏi AI',
                  onCta: () => heroTaps++,
                  action: const SizedBox(width: 48, height: 48),
                ),
                PlanAQuickActions(
                  actions: [
                    action('Quiz', LucideIcons.clipboardList, Colors.orange),
                    action('Tài liệu', LucideIcons.bookOpen, Colors.green),
                    action('Hỗ trợ', LucideIcons.lifeBuoy, Colors.blue),
                    action('Tiến độ', LucideIcons.trendingUp, Colors.purple),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Tiếp tục hỏi AI'));
    expect(heroTaps, 1);
  });
}
