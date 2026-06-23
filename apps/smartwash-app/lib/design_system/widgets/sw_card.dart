import 'package:flutter/material.dart';
import '../sw_colors.dart';

/// Reusable white card with rounded corners, border, and subtle shadow.
/// Tappable cards use [InkWell] for Material ripple feedback.
class SwCard extends StatelessWidget {
  const SwCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final decoration = BoxDecoration(
      color: SwColors.cardBg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: SwColors.border),
      boxShadow: const [
        BoxShadow(
          color: Color(0x08000000),
          blurRadius: 4,
          offset: Offset(0, 2),
        ),
      ],
    );

    if (onTap == null) {
      return Container(
        decoration: decoration,
        child: Padding(padding: padding, child: child),
      );
    }

    return Material(
      color: SwColors.cardBg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: decoration,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}
