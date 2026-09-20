import 'package:ai_tutor/shared/models/improve_plan.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('reviewSuggestions keep improvePlanId and planItemId from details', () {
    final plan = ImprovePlan.fromJson({
      'id': 'plan-1',
      'planItemDetails': [
        {
          'id': 'item-1',
          'title': 'IoC',
          'instruction': 'Nắm vững các khái niệm IoC và DI',
          'groundingStatus': 'GROUNDED',
        },
      ],
    });

    expect(plan.reviewSuggestions, hasLength(1));
    final item = plan.reviewSuggestions.first;
    expect(item.improvePlanId, 'plan-1');
    expect(item.planItemId, 'item-1');
    expect(item.suggestionText, 'Nắm vững các khái niệm IoC và DI');
    expect(item.hasImprovePlanGrounding, isTrue);
  });

  test('legacy planItems still produce review ids', () {
    final plan = ImprovePlan.fromJson({
      'id': 'plan-2',
      'planItems': ['Ôn Servlet lifecycle'],
    });

    expect(plan.reviewSuggestions.single.planItemId, 'legacy-0');
    expect(plan.reviewSuggestions.single.improvePlanId, 'plan-2');
  });
}
