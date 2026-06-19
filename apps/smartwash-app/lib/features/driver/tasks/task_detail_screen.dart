import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/driver_task.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../providers/auth_provider.dart';

final _taskDetailProvider =
    FutureProvider.autoDispose.family<DriverTask, String>((ref, id) {
  return ref.read(apiClientProvider).getDriverTask(id);
});

class TaskDetailScreen extends ConsumerWidget {
  const TaskDetailScreen({super.key, required this.taskId});
  final String taskId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final taskAsync = ref.watch(_taskDetailProvider(taskId));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ລາຍລະອຽດງານ')),
      body: taskAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) =>
            Center(child: Text(mapError(e), style: SwTypography.body)),
        data: (task) => _TaskDetailBody(task: task, ref: ref),
      ),
    );
  }
}

class _TaskDetailBody extends StatelessWidget {
  const _TaskDetailBody({required this.task, required this.ref});
  final DriverTask task;
  final WidgetRef ref;

  static const _nextStates = {
    'ASSIGNED': ('ອອກເດີນທາງ', 'EN_ROUTE_PICKUP'),
    'EN_ROUTE_PICKUP': ('ຮັບຜ້າແລ້ວ', 'PICKED_UP'),
    'PICKED_UP': ('ກໍາລັງສົ່ງ', 'IN_TRANSIT'),
    'IN_TRANSIT': ('ສົ່ງສຳເລັດ', 'DELIVERED'),
  };

  @override
  Widget build(BuildContext context) {
    final next = _nextStates[task.status];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Status
          Center(child: SwBadge(status: task.status)),
          const SizedBox(height: 20),

          // Customer
          SwCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ຂໍ້ມູນລູກຄ້າ', style: SwTypography.heading3),
                const SizedBox(height: 10),
                Text(task.customerName, style: SwTypography.body),
                Text(task.customerPhone, style: SwTypography.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Route
          SwCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ເສັ້ນທາງ', style: SwTypography.heading3),
                const SizedBox(height: 10),
                _Row(
                    icon: Icons.location_on,
                    color: SwColors.primary,
                    text: task.pickupAddress),
                _Row(
                    icon: Icons.flag,
                    color: SwColors.success,
                    text: task.dropoffAddress),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(formatKip(task.feeKip),
                        style:
                            SwTypography.label.copyWith(color: SwColors.primary)),
                    const Spacer(),
                    Text('${task.distanceKm.toStringAsFixed(1)} km',
                        style: SwTypography.bodySmall),
                  ],
                ),
              ],
            ),
          ),

          if (task.items.isNotEmpty) ...[
            const SizedBox(height: 12),
            SwCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('ສິ່ງຂອງ', style: SwTypography.heading3),
                  const SizedBox(height: 10),
                  ...task.items.map((i) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(i.name, style: SwTypography.body),
                            Text('x${i.qty}', style: SwTypography.bodySmall),
                          ],
                        ),
                      )),
                ],
              ),
            ),
          ],

          if (next != null) ...[
            const SizedBox(height: 24),
            SwButton(
              label: next.$1,
              variant: SwButtonVariant.primary,
              onPressed: () async {
                await ref.read(apiClientProvider).advanceTask(task.id, next.$2);
                if (context.mounted) context.pop();
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.color, required this.text});
  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: SwTypography.body)),
        ],
      ),
    );
  }
}
