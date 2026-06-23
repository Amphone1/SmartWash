import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/order.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

// TODO(perf): BFF GET /bff/orders and the downstream order service GET /orders
// do not yet support a `?status=active` query param — all orders are returned
// and filtered client-side. To fix: add `@Query('status') status?: string` to
// OrdersController.list(), propagate via BFF OrdersController → OrderClient →
// ApiClient.listOrders({status}), then pass `status: 'active'` here so the DB
// does the filtering instead of transferring the full order history on every
// home-screen load.
final _activeOrderProvider = FutureProvider.autoDispose<Order?>((ref) async {
  final api = ref.read(apiClientProvider);
  final orders = await api.listOrders(); // client-side filter — see TODO above
  try {
    return orders.firstWhere((o) => o.isActive);
  } catch (_) {
    return null;
  }
});

final _walletProvider = FutureProvider.autoDispose((ref) async {
  return ref.read(apiClientProvider).getWallet();
});

final _unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final notifs = await ref.read(apiClientProvider).listNotifications();
  return notifs.where((n) => !n.isRead).length;
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final activeOrder = ref.watch(_activeOrderProvider);
    final wallet = ref.watch(_walletProvider);
    final unreadCount = ref.watch(_unreadCountProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_activeOrderProvider);
          ref.invalidate(_walletProvider);
          ref.invalidate(_unreadCountProvider);
        },
        child: CustomScrollView(
          slivers: [
            // ── App Bar ──────────────────────────────────────────────────
            SliverAppBar(
              floating: true,
              backgroundColor: SwColors.cardBg,
              surfaceTintColor: Colors.transparent,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ສະບາຍດີ 👋',
                    style: SwTypography.bodySmall,
                  ),
                  Text(
                    user?.name ?? '',
                    style: SwTypography.heading3,
                  ),
                ],
              ),
              actions: [
                IconButton(
                  icon: Badge(
                    isLabelVisible: (unreadCount.valueOrNull ?? 0) > 0,
                    label: Text('${unreadCount.valueOrNull ?? 0}'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                  onPressed: () => context.push('/customer/notifications'),
                ),
                const SizedBox(width: 4),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.all(20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Wallet card ──────────────────────────────────────
                  _WalletCard(wallet: wallet),
                  const SizedBox(height: 20),

                  // ── Quick actions ────────────────────────────────────
                  Row(
                    children: [
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.local_laundry_service,
                          label: 'ສັ່ງຊັກ',
                          color: SwColors.primary,
                          onTap: () => context.push('/customer/order/branch'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.add_card,
                          label: 'ຕື່ມເງິນ',
                          color: SwColors.success,
                          onTap: () => context.push('/customer/topup'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.history,
                          label: 'ປະຫວັດ',
                          color: const Color(0xFF7C3AED),
                          onTap: () => context.go('/customer/orders'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // ── Active order ─────────────────────────────────────
                  const Text('ຄໍາສັ່ງປັດຈຸບັນ', style: SwTypography.heading3),
                  const SizedBox(height: 12),
                  activeOrder.when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (e, _) => Text(mapError(e), style: SwTypography.body),
                    data: (order) => order == null
                        ? SwEmptyState(
                            icon: Icons.local_laundry_service_outlined,
                            title: 'ບໍ່ມີຄໍາສັ່ງ',
                            subtitle: 'ສະແກນ QR ເພື່ອເລີ່ມຊັກ',
                            action: SwButton(
                              label: 'ເລີ່ມຊັກ',
                              onPressed: () => context.go('/customer/scan'),
                              isFullWidth: false,
                            ),
                          )
                        : _ActiveOrderCard(order: order),
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WalletCard extends StatelessWidget {
  const _WalletCard({required this.wallet});
  final AsyncValue wallet;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [SwColors.primary, SwColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ກະເປົ໋າເງິນ',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
              GestureDetector(
                onTap: () => GoRouter.of(context).push('/customer/topup'),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    '+ ຕື່ມເງິນ',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          wallet.when(
            loading: () => const CircularProgressIndicator(color: Colors.white),
            error: (_, __) =>
                const Text('—', style: TextStyle(color: Colors.white, fontSize: 28)),
            data: (w) => Text(
              formatKip(w.balanceKip),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Ink(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              Icon(icon, color: color, size: 26),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    return SwCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('#${order.id.substring(0, 8)}', style: SwTypography.label),
              SwBadge(status: order.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            order.branchName ?? '',
            style: SwTypography.bodySmall,
          ),
          if (order.progressPct != null) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('ຄວາມຄືບໜ້າ', style: SwTypography.caption),
                Text('${order.progressPct}%', style: SwTypography.caption),
              ],
            ),
            const SizedBox(height: 6),
            LinearProgressIndicator(
              value: (order.progressPct ?? 0) / 100,
              backgroundColor: SwColors.border,
              color: SwColors.primary,
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
            if (order.estimatedMinutes != null) ...[
              const SizedBox(height: 6),
              Text(
                'ອີກ ${order.estimatedMinutes} ນາທີ',
                style: SwTypography.caption,
              ),
            ],
          ],
          if (order.driverName != null) ...[
            const Divider(height: 20, color: SwColors.divider),
            Row(
              children: [
                const Icon(Icons.delivery_dining,
                    size: 16, color: SwColors.textMuted),
                const SizedBox(width: 6),
                Text(order.driverName!, style: SwTypography.bodySmall),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
