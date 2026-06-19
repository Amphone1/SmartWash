import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../providers/auth_provider.dart';

class DeliveryRequestScreen extends ConsumerStatefulWidget {
  const DeliveryRequestScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<DeliveryRequestScreen> createState() =>
      _DeliveryRequestScreenState();
}

class _DeliveryRequestScreenState
    extends ConsumerState<DeliveryRequestScreen> {
  final _pickupCtrl = TextEditingController();
  final _dropoffCtrl = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_pickupCtrl.text.trim().isEmpty || _dropoffCtrl.text.trim().isEmpty) {
      setState(() => _error = 'ກະລຸນາໃສ່ທີ່ຢູ່ຮັບ ແລະ ສົ່ງ');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final delivery = await ref.read(apiClientProvider).requestDelivery(
        widget.orderId,
        pickup: {'addr': _pickupCtrl.text.trim(), 'lat': 0, 'lng': 0},
        dropoff: {'addr': _dropoffCtrl.text.trim(), 'lat': 0, 'lng': 0},
      );
      if (mounted) {
        context.go('/customer/delivery/${delivery.id}/track');
      }
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
      appBar: AppBar(title: const Text('ສ້າງຄໍາສັ່ງຈັດສົ່ງ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: SwColors.dangerLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!, style: const TextStyle(color: SwColors.danger)),
              ),
            const Text('ທີ່ຢູ່ຮັບ', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _pickupCtrl,
              decoration: const InputDecoration(
                hintText: 'ທີ່ຢູ່ທີ່ຕ້ອງໄປຮັບ',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
            ),
            const SizedBox(height: 16),
            const Text('ທີ່ຢູ່ສົ່ງ', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _dropoffCtrl,
              decoration: const InputDecoration(
                hintText: 'ທີ່ຢູ່ທີ່ຕ້ອງໄປສົ່ງ',
                prefixIcon: Icon(Icons.home_outlined),
              ),
            ),
            const SizedBox(height: 28),
            SwButton(label: 'ສ້າງຄໍາສັ່ງ', onPressed: _submit, isLoading: _isLoading),
          ],
        ),
      ),
    );
  }
}
