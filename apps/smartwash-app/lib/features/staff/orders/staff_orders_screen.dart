import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

enum _StatusFilter { all, active, done }

final _staffOrdersProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String?>(
        (ref, status) {
  return ref.read(apiClientProvider).listStaffOrders(status: status);
});

/// Staff view of all branch orders — lets staff monitor wash cycles and
/// spot issues (stalled machines, failed payments) without leaving the app.
class StaffOrdersScreen extends ConsumerStatefulWidget {
  const StaffOrdersScreen({super.key});

  @override
  ConsumerState<StaffOrdersScreen> createState() => _StaffOrdersScreenState();
}

class _StaffOrdersScreenState extends ConsumerState<StaffOrdersScreen> {
  _StatusFilter _filter = _StatusFilter.all;

  String? get _statusParam => switch (_filter) {
        _StatusFilter.all => null,
        _StatusFilter.active => 'RUNNING',
        _StatusFilter.done => 'COMPLETED',
      };

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(_staffOrdersProvider(_statusParam));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ຄໍາສັ່ງ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_staffOrdersProvider(_statusParam)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _StatusFilter.values
                    .map((f) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(_filterLabel(f)),
                            selected: _filter == f,
                            onSelected: (_) =>
                                setState(() => _filter = f),
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
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async =>
                  ref.invalidate(_staffOrdersProvider(_statusParam)),
              child: ordersAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(mapError(e), style: SwTypography.body),
                ),
                data: (orders) {
                  if (orders.isEmpty) {
                    return const SwEmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'ບໍ່ມີຄໍາສັ່ງ',
                      subtitle: 'ຄໍາສັ່ງຈະສະແດງທີ່ນີ້',
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    itemCount: orders.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 10),
                    itemBuilder: (_, i) =>
                        _StaffOrderCard(order: orders[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _filterLabel(_StatusFilter f) => switch (f) {
        _StatusFilter.all => 'ທັງໝົດ',
        _StatusFilter.active => 'ກຳລັງຊັກ',
        _StatusFilter.done => 'ສຳເລັດ',
      };
}

class _StaffOrderCard extends StatelessWidget {
  const _StaffOrderCard({required this.order});
  final Map<String, dynamic> order;

  static final _dateFmt = DateFormat('HH:mm dd/MM');

  @override
  Widget build(BuildContext context) {
    final id = order['id'] as String? ?? '';
    final status = order['status'] as String? ?? '';
    final machineCode = order['machineCode'] as String? ?? '—';
    final customerName = order['customerName'] as String? ?? '—';
    final pricePaid = (order['pricePaid'] ?? order['total'] as num?)?.toInt();
    final createdAt = order['createdAt'] as String?;
    final progressPct = (order['progressPct'] as num?)?.toInt();
    final minutesLeft = (order['minutesLeft'] as num?)?.toInt();

    return SwCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    '#${id.length >= 8 ? id.substring(0, 8).toUpperCase() : id}',
                    style: SwTypography.label,
                  ),
                  const SizedBox(width: 8),
                  Text(machineCode, style: SwTypography.bodySmall),
                ],
              ),
              SwBadge(status: status),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.person_outline,
                  size: 14, color: SwColors.textMuted),
              const SizedBox(width: 4),
              Text(customerName, style: SwTypography.bodySmall),
              if (pricePaid != null) ...[
                const Spacer(),
                Text(formatKip(pricePaid),
                    style:
                        SwTypography.label.copyWith(color: SwColors.primary)),
              ],
            ],
          ),
          if (progressPct != null) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('$progressPct%', style: SwTypography.caption),
                if (minutesLeft != null)
                  Text('ອີກ $minutesLeft ນາທີ', style: SwTypography.caption),
              ],
            ),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: progressPct / 100,
              backgroundColor: SwColors.border,
              color: SwColors.primary,
              minHeight: 5,
              borderRadius: BorderRadius.circular(3),
            ),
          ],
          if (createdAt != null) ...[
            const SizedBox(height: 6),
            Text(
              _dateFmt.format(
                  DateTime.tryParse(createdAt) ?? DateTime.now()),
              style: SwTypography.caption,
            ),
          ],
        ],
      ),
    );
  }
}
