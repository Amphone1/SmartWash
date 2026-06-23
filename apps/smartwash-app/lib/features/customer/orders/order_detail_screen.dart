import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/models/order.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../providers/auth_provider.dart';

final _orderDetailProvider =
    FutureProvider.autoDispose.family<Order, String>((ref, id) {
  return ref.read(apiClientProvider).getOrder(id);
});

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(_orderDetailProvider(orderId));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: Text('#${orderId.substring(0, 8).toUpperCase()}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_orderDetailProvider(orderId)),
          ),
        ],
      ),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: SwColors.danger),
                const SizedBox(height: 16),
                Text(mapError(e),
                    style: SwTypography.body, textAlign: TextAlign.center),
                const SizedBox(height: 20),
                SwButton(
                  label: 'ລອງໃໝ່',
                  onPressed: () =>
                      ref.invalidate(_orderDetailProvider(orderId)),
                ),
              ],
            ),
          ),
        ),
        data: (order) => _OrderBody(
          order: order,
          onRefresh: () async => ref.invalidate(_orderDetailProvider(orderId)),
        ),
      ),
    );
  }
}

class _OrderBody extends StatelessWidget {
  const _OrderBody({required this.order, required this.onRefresh});
  final Order order;
  final Future<void> Function() onRefresh;

  static final _dateFmt = DateFormat('dd/MM/yyyy HH:mm');

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ── Status hero ───────────────────────────────────────────────
          Center(
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: SwColors.primaryLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.local_laundry_service,
                      size: 40, color: SwColors.primary),
                ),
                const SizedBox(height: 12),
                SwBadge(status: order.status),
                if (order.progressPct != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: 220,
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('ຄວາມຄືບໜ້າ', style: SwTypography.caption),
                            Text('${order.progressPct}%',
                                style: SwTypography.caption),
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
                          Text('ອີກ ${order.estimatedMinutes} ນາທີ',
                              style: SwTypography.caption),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Order info ────────────────────────────────────────────────
          SwCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ລາຍລະອຽດ', style: SwTypography.heading3),
                const SizedBox(height: 14),
                _Row(label: 'ປະເພດ', value: _serviceLabel(order.serviceType)),
                if (order.branchName != null)
                  _Row(label: 'ສາຂາ', value: order.branchName!),
                if (order.machineCode != null)
                  _Row(
                    label: 'ເຄື່ອງ',
                    value: '${order.machineCode}'
                        '${order.machineType != null ? ' · ${order.machineType}' : ''}',
                  ),
                if (order.cycle != null)
                  _Row(label: 'ຮອບຊັກ', value: _cycleLabel(order.cycle!)),
                if (order.pricePaid != null)
                  _Row(
                    label: 'ລາຄາ',
                    value: formatKip(order.pricePaid),
                    valueColor: SwColors.primary,
                  ),
                _Row(
                  label: 'ວັນທີ',
                  value: _dateFmt.format(
                      DateTime.tryParse(order.createdAt) ?? DateTime.now()),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Driver info (if delivery) ─────────────────────────────────
          if (order.driverName != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SwCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('ຄົນຂັບ', style: SwTypography.heading3),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const CircleAvatar(
                          radius: 20,
                          backgroundColor: SwColors.primaryLight,
                          child: Icon(Icons.person,
                              color: SwColors.primary, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(order.driverName!,
                                  style: SwTypography.label),
                              if (order.driverRating != null)
                                Row(
                                  children: [
                                    const Icon(Icons.star,
                                        size: 14, color: SwColors.warning),
                                    const SizedBox(width: 3),
                                    Text(
                                        order.driverRating!
                                            .toStringAsFixed(1),
                                        style: SwTypography.bodySmall),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

          // ── Actions ───────────────────────────────────────────────────
          ..._buildActions(context, order),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  List<Widget> _buildActions(BuildContext context, Order order) {
    final actions = <Widget>[];

    if (order.status == 'PAYMENT_PENDING') {
      actions.add(SwButton(
        label: 'ໄປຊໍາລະ',
        icon: Icons.payment,
        onPressed: () => context.push('/customer/topup'),
      ));
      actions.add(const SizedBox(height: 10));
    }

    if (order.status == 'RUNNING' &&
        order.serviceType == 'pickup' &&
        order.deliveryId == null) {
      actions.add(SwButton(
        label: 'ຂໍຈັດສົ່ງ',
        icon: Icons.delivery_dining,
        onPressed: () =>
            context.push('/customer/delivery/request/${order.id}'),
      ));
      actions.add(const SizedBox(height: 10));
    }

    if (order.deliveryId != null) {
      actions.add(SwButton(
        label: 'ຕິດຕາມການຈັດສົ່ງ',
        icon: Icons.track_changes,
        variant: SwButtonVariant.outline,
        onPressed: () =>
            context.push('/customer/delivery/${order.deliveryId}/track'),
      ));
      actions.add(const SizedBox(height: 10));
    }

    if (order.canRate) {
      actions.add(SwButton(
        label: 'ໃຫ້ຄະແນນ',
        icon: Icons.star_outline,
        variant: SwButtonVariant.outline,
        onPressed: () =>
            context.push('/customer/order/${order.id}/rate'),
      ));
      actions.add(const SizedBox(height: 10));
    }

    return actions;
  }

  static String _serviceLabel(String raw) => switch (raw) {
        'self_service' => 'ບໍລິການດ້ວຍຕົນເອງ',
        'pickup' => 'ຮັບ-ສົ່ງ',
        'delivery' => 'ສົ່ງເຖິງບ້ານ',
        _ => raw,
      };

  static String _cycleLabel(String raw) => switch (raw) {
        'quick' => 'ໄວ (30 ນາທີ)',
        'normal' => 'ປົກກະຕິ (45 ນາທີ)',
        'heavy' => 'ໜັກ (60 ນາທີ)',
        _ => raw,
      };
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: SwTypography.bodySmall),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              style: SwTypography.label.copyWith(color: valueColor),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
