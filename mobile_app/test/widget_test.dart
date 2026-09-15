import 'package:flutter_test/flutter_test.dart';
import 'package:smart_attendance/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const AttendanceApp(isRegistered: false));
    expect(find.byType(AttendanceApp), findsOneWidget);
  });
}

