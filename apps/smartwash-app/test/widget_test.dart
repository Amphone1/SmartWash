import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smartwash_app/app.dart';

void main() {
  testWidgets('SmartWash app renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: SmartWashApp()));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
