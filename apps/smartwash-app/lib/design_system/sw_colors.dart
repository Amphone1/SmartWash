import 'package:flutter/material.dart';

/// SmartWash brand color palette — ported from the React Native theme.ts files.
/// Naming follows the design system: semantic names are preferred over raw hex.
abstract final class SwColors {
  // ─── Brand ──────────────────────────────────────────────────────────────────
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFFEFF6FF);
  static const Color primaryLight2 = Color(0xFFDBEAFE);
  static const Color primaryDark = Color(0xFF1D4ED8);

  // ─── Text ───────────────────────────────────────────────────────────────────
  static const Color textHeading = Color(0xFF0F172A);
  static const Color textBody = Color(0xFF475569);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textHint = Color(0xFF94A3B8);
  static const Color textDisabled = Color(0xFFCBD5E1);

  // ─── Surface ────────────────────────────────────────────────────────────────
  static const Color pageBg = Color(0xFFF8FAFC);
  static const Color cardBg = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2E8F0);
  static const Color divider = Color(0xFFF1F5F9);

  // ─── Semantic ───────────────────────────────────────────────────────────────
  static const Color success = Color(0xFF16A34A);
  static const Color successLight = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF38BDF8);

  // ─── Status badge colors ─────────────────────────────────────────────────────
  static ({Color bg, Color text}) statusColors(String status) =>
      switch (status.toUpperCase()) {
        'IDLE' || 'AVAILABLE' => (bg: successLight, text: success),
        'RUNNING' || 'WASHING' || 'PAID' || 'STARTING' || 'FINISHING' =>
          (bg: primaryLight2, text: primaryDark),
        'RESERVED' || 'PAYMENT_PENDING' || 'AWAITING_APPROVAL' || 'PAUSED' =>
          (bg: warningLight, text: const Color(0xFF92400E)),
        'IN_TRANSIT' || 'EN_ROUTE_PICKUP' || 'EN_ROUTE_DELIVERY' =>
          (bg: const Color(0xFFF3E8FF), text: const Color(0xFF7E22CE)),
        'COMPLETED' || 'DELIVERED' || 'APPROVED' =>
          (bg: successLight, text: success),
        'CANCELLED' || 'REJECTED' || 'FAILED' || 'ERROR' =>
          (bg: dangerLight, text: danger),
        'OFFLINE' || 'MAINTENANCE' =>
          (bg: const Color(0xFFF1F5F9), text: textMuted),
        _ => (bg: divider, text: textMuted),
      };
}
