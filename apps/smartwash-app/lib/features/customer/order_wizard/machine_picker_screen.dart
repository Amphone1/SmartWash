import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/machine.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _machinesWizardProvider =
    FutureProvider.autoDispose.family<List<Machine>, String>((ref, branchId) {
  return ref.read(apiClientProvider).listMachines(branchId);
});

/// Step 2 of the order wizard — pick an available washing machine in the branch.
class MachinePickerScreen extends ConsumerWidget {
  const MachinePickerScreen({
    super.key,
    required this.branchId,
    required this.branchName,
  });

  final String branchId;
  final String branchName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final machinesAsync = ref.watch(_machinesWizardProvider(branchId));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('ເລືອກເຄື່ອງ'),
            Text(branchName, style: SwTypography.caption),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_machinesWizardProvider(branchId)),
        child: machinesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(mapError(e), style: SwTypography.body)),
          data: (machines) {
            if (machines.isEmpty) {
              return const SwEmptyState(
                icon: Icons.local_laundry_service_outlined,
                title: 'ບໍ່ມີເຄື່ອງ',
                subtitle: 'ສາຂານີ້ຍັງບໍ່ມີເຄື່ອງ',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: machines.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final m = machines[i];
                return _MachineCard(
                  machine: m,
                  onTap: m.isAvailable
                      ? () => context.push(
                            '/customer/order/cycle',
                            extra: {
                              'branchId': branchId,
                              'branchName': branchName,
                              'machineId': m.id,
                              'machineCode': m.code,
                              'machineType': m.type,
                              'capacityKg': m.capacityKg,
                              'priceKip': m.priceKip,
                            },
                          )
                      : null,
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _MachineCard extends StatelessWidget {
  const _MachineCard({required this.machine, required this.onTap});
  final Machine machine;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final available = machine.isAvailable;

    return Opacity(
      opacity: available ? 1.0 : 0.55,
      child: SwCard(
        onTap: onTap,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: available ? SwColors.primaryLight : SwColors.border,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.local_laundry_service,
                color: available ? SwColors.primary : SwColors.textMuted,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(machine.code, style: SwTypography.label),
                      const SizedBox(width: 8),
                      Text(machine.type, style: SwTypography.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${machine.capacityKg.toStringAsFixed(0)} kg · ${formatKip(machine.priceKip)}',
                    style: SwTypography.caption,
                  ),
                ],
              ),
            ),
            SwBadge(status: machine.state.name.toUpperCase()),
          ],
        ),
      ),
    );
  }
}
