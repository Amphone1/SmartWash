import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/models/app_notification.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.read(apiClientProvider).listNotifications();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(_notificationsProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ການແຈ້ງເຕືອນ'),
        actions: [
          notifAsync.maybeWhen(
            data: (notifs) {
              final hasUnread = notifs.any((n) => !n.isRead);
              if (!hasUnread) return const SizedBox.shrink();
              return TextButton(
                onPressed: () async {
                  await ref
                      .read(apiClientProvider)
                      .markAllNotificationsRead();
                  ref.invalidate(_notificationsProvider);
                },
                child: const Text(
                  'ອ່ານທັງໝົດ',
                  style: TextStyle(color: SwColors.primary, fontSize: 13),
                ),
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_notificationsProvider),
        child: notifAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.notifications_off_outlined,
                      size: 48, color: SwColors.textMuted),
                  const SizedBox(height: 16),
                  Text(mapError(e),
                      style: SwTypography.body,
                      textAlign: TextAlign.center),
                  const SizedBox(height: 20),
                  SwButton(
                    label: 'ລອງໃໝ່',
                    onPressed: () =>
                        ref.invalidate(_notificationsProvider),
                  ),
                ],
              ),
            ),
          ),
          data: (notifs) {
            if (notifs.isEmpty) {
              return const SwEmptyState(
                icon: Icons.notifications_outlined,
                title: 'ບໍ່ມີການແຈ້ງເຕືອນ',
                subtitle: 'ການແຈ້ງເຕືອນໃໝ່ຈະສະແດງທີ່ນີ້',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notifs.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: SwColors.divider),
              itemBuilder: (_, i) =>
                  _NotificationTile(notification: notifs[i]),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification});
  final AppNotification notification;

  static final _dateFmt = DateFormat('dd/MM HH:mm');

  static const _typeIcons = {
    'topup': Icons.account_balance_wallet_outlined,
    'order': Icons.local_laundry_service_outlined,
    'delivery': Icons.delivery_dining_outlined,
    'system': Icons.info_outline,
  };

  @override
  Widget build(BuildContext context) {
    final isRead = notification.isRead;
    final icon = _typeIcons[notification.type] ?? Icons.notifications_outlined;

    return Container(
      color: isRead ? Colors.transparent : SwColors.primaryLight.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isRead ? SwColors.border : SwColors.primaryLight2,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isRead ? SwColors.textMuted : SwColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: SwTypography.label.copyWith(
                            fontWeight: isRead
                                ? FontWeight.w500
                                : FontWeight.w700,
                          ),
                        ),
                      ),
                      if (!isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: SwColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: SwTypography.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _dateFmt.format(
                      DateTime.tryParse(notification.createdAt) ??
                          DateTime.now(),
                    ),
                    style: SwTypography.caption,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
