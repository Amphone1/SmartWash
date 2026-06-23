import 'dart:async';
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
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _tasksProvider = FutureProvider.autoDispose<List<DriverTask>>((ref) {
  return ref.read(apiClientProvider).listDriverTasks();
});

/// Driver task list — ported from apps/driver-app/app/(tabs)/tasks.tsx.
/// Auto-refreshes every 30 seconds (same as the RN implementation).
class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      ref.invalidate(_tasksProvider);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(_tasksProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ງານຂອງຂ້ອຍ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_tasksProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_tasksProvider),
        child: tasksAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) =>
              Center(child: Text(mapError(e), style: SwTypography.body)),
          data: (tasks) {
            if (tasks.isEmpty) {
              return const SwEmptyState(
                icon: Icons.assignment_outlined,
                title: 'ບໍ່ມີງານ',
                subtitle: 'ງານໃໝ່ຈະສະແດງທີ່ນີ້',
              );
            }

            final newTasks = tasks.where((t) => t.isNew).toList();
            final inProgress = tasks.where((t) => !t.isNew).toList();

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (newTasks.isNotEmpty) ...[
                  const Text('ງານໃໝ່', style: SwTypography.heading3),
                  const SizedBox(height: 10),
                  ...newTasks.map((t) => _NewTaskCard(task: t)),
                  const SizedBox(height: 20),
                ],
                if (inProgress.isNotEmpty) ...[
                  const Text('ກຳລັງດໍາເນີນ', style: SwTypography.heading3),
                  const SizedBox(height: 10),
                  ...inProgress.map((t) => _InProgressCard(task: t)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _NewTaskCard extends ConsumerWidget {
  const _NewTaskCard({required this.task});
  final DriverTask task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SwCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('#${task.id.substring(0, 8)}', style: SwTypography.label),
                SwBadge(status: task.type),
              ],
            ),
            const SizedBox(height: 10),
            _AddressRow(
              icon: Icons.location_on,
              color: SwColors.primary,
              label: task.pickupAddress,
            ),
            _AddressRow(
              icon: Icons.flag,
              color: SwColors.success,
              label: task.dropoffAddress,
            ),
            const Divider(height: 16, color: SwColors.divider),
            Row(
              children: [
                Text(
                  formatKip(task.feeKip),
                  style: SwTypography.label.copyWith(color: SwColors.primary),
                ),
                const SizedBox(width: 12),
                const Icon(Icons.straighten, size: 14, color: SwColors.textMuted),
                const SizedBox(width: 4),
                Text('${task.distanceKm.toStringAsFixed(1)} km',
                    style: SwTypography.bodySmall),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SwButton(
                    label: 'ຮັບ',
                    variant: SwButtonVariant.success,
                    isFullWidth: false,
                    onPressed: () async {
                      await ref.read(apiClientProvider).acceptTask(task.id);
                      ref.invalidate(_tasksProvider);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SwButton(
                    label: 'ປະຕິເສດ',
                    variant: SwButtonVariant.outline,
                    isFullWidth: false,
                    onPressed: () async {
                      await ref.read(apiClientProvider).rejectTask(task.id);
                      ref.invalidate(_tasksProvider);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InProgressCard extends StatelessWidget {
  const _InProgressCard({required this.task});
  final DriverTask task;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SwCard(
        onTap: () => context.push('/driver/task/${task.id}'),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.customerName, style: SwTypography.label),
                  const SizedBox(height: 4),
                  Text(task.dropoffAddress, style: SwTypography.bodySmall),
                ],
              ),
            ),
            SwBadge(status: task.status),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: SwColors.textHint),
          ],
        ),
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  const _AddressRow({
    required this.icon,
    required this.color,
    required this.label,
  });
  final IconData icon;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: SwTypography.body)),
        ],
      ),
    );
  }
}
