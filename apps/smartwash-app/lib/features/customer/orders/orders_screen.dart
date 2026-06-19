import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/models/order.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

enum _Filter { all, active, done, cancelled }

final _ordersProvider = FutureProvider.autoDispose<List<Order>>((ref) {
  return ref.read(apiClientProvider).listOrders();
});

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  _Filter _filter = _Filter.all;

  List<Order> _applyFilter(List<Order> orders) => switch (_filter) {
        _Filter.all => orders,
        _Filter.active => orders.where((o) => o.isActive).toList(),
        _Filter.done => orders.where((o) => o.isCompleted).toList(),
        _Filter.cancelled => orders.where((o) => o.isCancelled).toList(),
      };

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(_ordersProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ຄໍາສັ່ງ')),
      body: Column(
        children: [
          // ── Filter chips ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _Filter.values
                    .map((f) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(_filterLabel(f)),
                            selected: _filter == f,
                            onSelected: (_) => setState(() => _filter = f),
                            selectedColor: SwColors.primaryLight2,
                            checkmarkColor: SwColors.primary,
                            labelStyle: TextStyle(
                              color: _filter == f
                                  ? SwColors.primaryDark
                                  : SwColors.textBody,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),
          ),

          // ── List ──────────────────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_ordersProvider),
              child: ordersAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(mapError(e), style: SwTypography.body),
                ),
                data: (all) {
                  final orders = _applyFilter(all);
                  if (orders.isEmpty) {
                    return const SwEmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'ບໍ່ມີຄໍາສັ່ງ',
                      subtitle: 'ຄໍາສັ່ງຈະສະແດງຢູ່ທີ່ນີ້',
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    itemCount: orders.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _OrderCard(
                    order: orders[i],
                    onTap: () =>
                        context.push('/customer/order/${orders[i].id}'),
                  ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _filterLabel(_Filter f) => switch (f) {
        _Filter.all => 'ທັງໝົດ',
        _Filter.active => 'ກຳລັງດໍາເນີນ',
        _Filter.done => 'ສຳເລັດ',
        _Filter.cancelled => 'ຍົກເລີກ',
      };
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  static final _dateFmt = DateFormat('dd/MM/yyyy HH:mm');

  @override
  Widget build(BuildContext context) {
    return SwCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('#${order.id.substring(0, 8).toUpperCase()}',
                  style: SwTypography.label),
              SwBadge(status: order.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _serviceTypeLabel(order.serviceType),
            style: SwTypography.body,
          ),
          Text(
            order.branchName ?? '',
            style: SwTypography.bodySmall,
          ),
          const Divider(height: 16, color: SwColors.divider),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _dateFmt.format(DateTime.tryParse(order.createdAt) ?? DateTime.now()),
                style: SwTypography.caption,
              ),
              if (order.pricePaid != null)
                Text(
                  formatKip(order.pricePaid),
                  style: SwTypography.label.copyWith(color: SwColors.primary),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static String _serviceTypeLabel(String raw) => switch (raw) {
        'self_service' => 'ບໍລິການດ້ວຍຕົນເອງ',
        'pickup' => 'ຮັບ-ສົ່ງ',
        'delivery' => 'ສົ່ງເຖິງບ້ານ',
        _ => raw,
      };
}
