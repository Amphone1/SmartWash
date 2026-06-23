import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _machinesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(apiClientProvider).listMachinesForStaff();
});

/// Staff machine management screen — shows all machines in the staff's branch
/// with their real-time state (IDLE, RUNNING, ERROR, MAINTENANCE, etc.).
/// This is new functionality — equivalent exists only on the web owner portal.
class MachinesScreen extends ConsumerWidget {
  const MachinesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final machinesAsync = ref.watch(_machinesProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ເຄື່ອງ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_machinesProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_machinesProvider),
        child: machinesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) =>
              Center(child: Text(mapError(e), style: SwTypography.body)),
          data: (machines) {
            if (machines.isEmpty) {
              return const SwEmptyState(
                icon: Icons.local_laundry_service_outlined,
                title: 'ບໍ່ມີເຄື່ອງ',
                subtitle: 'ເຄື່ອງຈະສະແດງທີ່ນີ້',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: machines.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _MachineCard(machine: machines[i]),
            );
          },
        ),
      ),
    );
  }
}

class _MachineCard extends StatelessWidget {
  const _MachineCard({required this.machine});
  final Map<String, dynamic> machine;

  @override
  Widget build(BuildContext context) {
    final state = machine['state'] as String? ?? 'OFFLINE';
    final code = machine['code'] as String? ?? '';
    final type = machine['type'] as String? ?? '';
    final progressPct = (machine['progressPct'] as num?)?.toInt();
    final minutesLeft = (machine['minutesLeft'] as num?)?.toInt();
    final errorCode = machine['errorCode'] as String?;

    return SwCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.local_laundry_service,
                      size: 18, color: SwColors.primary),
                  const SizedBox(width: 8),
                  Text(code, style: SwTypography.heading3),
                  const SizedBox(width: 6),
                  Text(type, style: SwTypography.bodySmall),
                ],
              ),
              SwBadge(status: state),
            ],
          ),

          if (progressPct != null) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('ຄວາມຄືບໜ້າ', style: SwTypography.caption),
                Text('$progressPct%', style: SwTypography.caption),
              ],
            ),
            const SizedBox(height: 6),
            LinearProgressIndicator(
              value: progressPct / 100,
              backgroundColor: SwColors.border,
              color: SwColors.primary,
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
            if (minutesLeft != null) ...[
              const SizedBox(height: 4),
              Text('ອີກ $minutesLeft ນາທີ', style: SwTypography.caption),
            ],
          ],

          if (errorCode != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.error_outline, size: 14, color: SwColors.danger),
                const SizedBox(width: 6),
                Text('Error: $errorCode',
                    style: SwTypography.bodySmall.copyWith(color: SwColors.danger)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
