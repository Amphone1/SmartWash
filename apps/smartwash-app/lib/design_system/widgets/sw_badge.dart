import 'package:flutter/material.dart';
import '../sw_colors.dart';

/// Status badge pill — maps a status string to a colored label.
/// Works for Order, Machine, Delivery, and Driver task statuses.
class SwBadge extends StatelessWidget {
  const SwBadge({super.key, required this.status, this.label});

  final String status;

  /// Optional override; defaults to Title Case of the status string.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final colors = SwColors.statusColors(status);
    final displayLabel = label ?? _format(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        displayLabel,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colors.text,
        ),
      ),
    );
  }

  static String _format(String raw) {
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty
            ? w
            : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}
