import 'package:intl/intl.dart';

final _fmt = NumberFormat('#,###', 'en');

/// Formats an integer kip amount to the display string used across all screens.
/// Example: 12000 → '₭12,000'
String formatKip(int? kip) {
  if (kip == null) return '₭0';
  return '₭${_fmt.format(kip)}';
}
