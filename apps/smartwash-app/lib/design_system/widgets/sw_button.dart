import 'package:flutter/material.dart';
import '../sw_colors.dart';

enum SwButtonVariant { primary, outline, ghost, danger, success }

class SwButton extends StatelessWidget {
  const SwButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = SwButtonVariant.primary,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final SwButtonVariant variant;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;

  Color get _spinnerColor => switch (variant) {
        SwButtonVariant.primary => Colors.white,
        SwButtonVariant.danger => Colors.white,
        SwButtonVariant.success => Colors.white,
        SwButtonVariant.outline => SwColors.primary,
        SwButtonVariant.ghost => SwColors.textBody,
      };

  Widget _buildChild() => isLoading
      ? SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: _spinnerColor,
          ),
        )
      : Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
            Text(label),
          ],
        );

  @override
  Widget build(BuildContext context) {
    final width = isFullWidth ? double.infinity : null;
    final child = _buildChild();
    final enabled = isLoading ? null : onPressed;

    return switch (variant) {
      SwButtonVariant.primary => SizedBox(
          width: width,
          child: ElevatedButton(onPressed: enabled, child: child),
        ),
      SwButtonVariant.outline => SizedBox(
          width: width,
          child: OutlinedButton(onPressed: enabled, child: child),
        ),
      SwButtonVariant.ghost => SizedBox(
          width: width,
          child: TextButton(
            onPressed: enabled,
            style: TextButton.styleFrom(foregroundColor: SwColors.textBody),
            child: child,
          ),
        ),
      SwButtonVariant.danger => SizedBox(
          width: width,
          child: ElevatedButton(
            onPressed: enabled,
            style: ElevatedButton.styleFrom(backgroundColor: SwColors.danger),
            child: child,
          ),
        ),
      SwButtonVariant.success => SizedBox(
          width: width,
          child: ElevatedButton(
            onPressed: enabled,
            style: ElevatedButton.styleFrom(backgroundColor: SwColors.success),
            child: child,
          ),
        ),
    };
  }
}
