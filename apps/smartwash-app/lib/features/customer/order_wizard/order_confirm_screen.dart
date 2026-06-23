import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../providers/auth_provider.dart';

/// Step 4 (final) of the order wizard — review summary and confirm order creation.
class OrderConfirmScreen extends ConsumerStatefulWidget {
  const OrderConfirmScreen({super.key, required this.wizardState});
  final Map<String, dynamic> wizardState;

  @override
  ConsumerState<OrderConfirmScreen> createState() => _OrderConfirmScreenState();
}

class _OrderConfirmScreenState extends ConsumerState<OrderConfirmScreen> {
  bool _isLoading = false;
  String? _error;

  String get _branchId => widget.wizardState['branchId'] as String;
  String get _branchName => widget.wizardState['branchName'] as String? ?? '';
  String get _machineId => widget.wizardState['machineId'] as String;
  String get _machineCode => widget.wizardState['machineCode'] as String? ?? '';
  String get _machineType => widget.wizardState['machineType'] as String? ?? '';
  String get _cycle => widget.wizardState['cycle'] as String? ?? 'normal';
  String get _cycleLabel => widget.wizardState['cycleLabel'] as String? ?? '';
  int get _durationMin => (widget.wizardState['durationMin'] as int?) ?? 45;
  int get _priceKip => (widget.wizardState['priceKip'] as int?) ?? 0;

  Future<void> _placeOrder() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final order = await ref.read(apiClientProvider).createOrder(
            branchId: _branchId,
            machineId: _machineId,
            type: 'self_service',
            cycle: _cycle,
          );
      if (!mounted) return;
      // Pop the entire wizard stack and land on orders list
      context.go('/customer/orders', extra: {'newOrderId': order.id});
    } catch (e) {
      setState(() => _error = mapError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ຢືນຢັນຄໍາສັ່ງ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwCard(
              child: Column(
                children: [
                  _Row(label: 'ສາຂາ', value: _branchName),
                  const Divider(height: 20, color: SwColors.divider),
                  _Row(label: 'ເຄື່ອງ', value: '$_machineCode · $_machineType'),
                  const Divider(height: 20, color: SwColors.divider),
                  _Row(label: 'ຮອບຊັກ', value: '$_cycleLabel  ($_durationMin ນາທີ)'),
                  const Divider(height: 20, color: SwColors.divider),
                  _Row(
                    label: 'ລາຄາ',
                    value: formatKip(_priceKip),
                    valueStyle: SwTypography.heading3.copyWith(color: SwColors.primary),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: SwColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: SwColors.primary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ເງິນຈະຖືກຫັກຈາກກະເປົ໋າເງິນຂອງທ່ານໂດຍອັດຕະໂນມັດ',
                      style: SwTypography.caption,
                    ),
                  ),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: SwColors.dangerLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!, style: const TextStyle(color: SwColors.danger)),
              ),
            ],

            const SizedBox(height: 28),
            SwButton(
              label: 'ຢືນຢັນ & ສ້າງຄໍາສັ່ງ',
              onPressed: _placeOrder,
              isLoading: _isLoading,
            ),
            const SizedBox(height: 12),
            SwButton(
              label: 'ກັບຄືນ',
              variant: SwButtonVariant.outline,
              onPressed: () => context.pop(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueStyle});
  final String label;
  final String value;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: SwTypography.bodySmall),
        Text(value, style: valueStyle ?? SwTypography.label),
      ],
    );
  }
}
