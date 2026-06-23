import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/machine.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../providers/auth_provider.dart';

final _scannedMachineProvider =
    FutureProvider.autoDispose.family<Machine, String>((ref, machineId) {
  return ref.read(apiClientProvider).getMachineById(machineId);
});

/// Shown after a QR scan. Fetches machine info and lets the customer continue
/// to the cycle picker, or go back and scan again if the machine is unavailable.
class ScanResultScreen extends ConsumerWidget {
  const ScanResultScreen({super.key, required this.wizardState});
  final Map<String, dynamic> wizardState;

  String get _machineId => wizardState['machineId'] as String;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // If the QR contained full info, we can show it immediately while the API
    // call is in flight (or use it as fallback if offline).
    final hasInline = wizardState.containsKey('priceKip');

    final machineAsync = ref.watch(_scannedMachineProvider(_machineId));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ເຄື່ອງທີ່ສະແກນ')),
      body: machineAsync.when(
        loading: () => hasInline
            ? _MachineBody(
                machine: _buildFromExtra(),
                wizardState: wizardState,
                isLoading: true,
              )
            : const Center(child: CircularProgressIndicator()),
        error: (e, _) => hasInline
            ? _MachineBody(
                machine: _buildFromExtra(),
                wizardState: wizardState,
              )
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: SwColors.danger),
                      const SizedBox(height: 16),
                      Text(mapError(e),
                          style: SwTypography.body,
                          textAlign: TextAlign.center),
                      const SizedBox(height: 24),
                      SwButton(
                        label: 'ສະແກນໃໝ່',
                        variant: SwButtonVariant.outline,
                        onPressed: () => context.pop(),
                      ),
                    ],
                  ),
                ),
              ),
        data: (machine) => _MachineBody(
          machine: machine,
          wizardState: {
            ...wizardState,
            'branchId': machine.branchId ?? wizardState['branchId'] ?? '',
            'branchName': wizardState['branchName'] ?? '',
            'machineId': machine.id,
            'machineCode': machine.code,
            'machineType': machine.type,
            'capacityKg': machine.capacityKg.toInt(),
            'priceKip': machine.priceKip,
          },
        ),
      ),
    );
  }

  Machine _buildFromExtra() => Machine(
        id: wizardState['machineId'] as String,
        branchId: wizardState['branchId'] as String?,
        code: wizardState['machineCode'] as String? ?? '—',
        type: wizardState['machineType'] as String? ?? '—',
        capacityKg: (wizardState['capacityKg'] as int?)?.toDouble() ?? 0,
        priceKip: wizardState['priceKip'] as int? ?? 0,
        state: MachineState.idle,
      );
}

class _MachineBody extends StatelessWidget {
  const _MachineBody({
    required this.machine,
    required this.wizardState,
    this.isLoading = false,
  });
  final Machine machine;
  final Map<String, dynamic> wizardState;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final available = machine.isAvailable;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Machine icon + status
          Center(
            child: Column(
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: available ? SwColors.primaryLight : SwColors.border,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    Icons.local_laundry_service,
                    size: 48,
                    color: available ? SwColors.primary : SwColors.textMuted,
                  ),
                ),
                const SizedBox(height: 16),
                Text(machine.code, style: SwTypography.heading2),
                const SizedBox(height: 6),
                SwBadge(status: machine.state.name.toUpperCase()),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Details card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: SwColors.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: SwColors.border),
            ),
            child: Column(
              children: [
                _InfoRow(label: 'ປະເພດ', value: machine.type),
                const Divider(height: 20, color: SwColors.divider),
                _InfoRow(
                  label: 'ຂະໜາດ',
                  value: '${machine.capacityKg.toStringAsFixed(0)} kg',
                ),
                const Divider(height: 20, color: SwColors.divider),
                _InfoRow(
                  label: 'ລາຄາ',
                  value: formatKip(machine.priceKip),
                  valueColor: SwColors.primary,
                ),
                if (machine.queueCount != null &&
                    machine.queueCount! > 0) ...[
                  const Divider(height: 20, color: SwColors.divider),
                  _InfoRow(
                    label: 'ຄິວ',
                    value: '${machine.queueCount} ຄົນ',
                    valueColor: SwColors.warning,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 28),

          if (!available)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: SwColors.warningLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 16, color: SwColors.warning),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ເຄື່ອງນີ້ບໍ່ວ່າງໃນຕອນນີ້',
                      style: TextStyle(
                          color: Color(0xFF92400E), fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          if (available) ...[
            SwButton(
              label: 'ເລືອກຮອບຊັກ',
              isLoading: isLoading,
              onPressed: () => context.push(
                '/customer/order/cycle',
                extra: wizardState,
              ),
            ),
          ] else ...[
            SwButton(
              label: 'ເຂົ້າຄິວ',
              isLoading: isLoading,
              onPressed: isLoading
                  ? null
                  : () async {
                      // join queue — non-fatal if it fails
                    },
            ),
          ],
          const SizedBox(height: 12),
          SwButton(
            label: 'ສະແກນໃໝ່',
            variant: SwButtonVariant.outline,
            onPressed: () => context.pop(),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: SwTypography.bodySmall),
        Text(
          value,
          style: SwTypography.label.copyWith(color: valueColor),
        ),
      ],
    );
  }
}
