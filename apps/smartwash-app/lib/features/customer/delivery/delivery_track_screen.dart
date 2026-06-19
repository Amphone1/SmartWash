import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/delivery.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../providers/auth_provider.dart';

final _deliveryProvider =
    FutureProvider.autoDispose.family<Delivery, String>((ref, id) {
  return ref.read(apiClientProvider).getDeliveryTracking(id);
});

/// Live delivery tracking screen — polls the BFF every 15 seconds.
/// Ported from apps/customer-app/app/delivery/track.tsx.
class DeliveryTrackScreen extends ConsumerStatefulWidget {
  const DeliveryTrackScreen({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  ConsumerState<DeliveryTrackScreen> createState() =>
      _DeliveryTrackScreenState();
}

class _DeliveryTrackScreenState extends ConsumerState<DeliveryTrackScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      ref.invalidate(_deliveryProvider(widget.deliveryId));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deliveryAsync = ref.watch(_deliveryProvider(widget.deliveryId));

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ຕິດຕາມການຈັດສົ່ງ')),
      body: deliveryAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(mapError(e), style: SwTypography.body),
        ),
        data: (d) => _TrackBody(delivery: d),
      ),
    );
  }
}

class _TrackBody extends StatelessWidget {
  const _TrackBody({required this.delivery});
  final Delivery delivery;

  static const _steps = [
    'EN_ROUTE_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
  ];

  static const _stepLabels = {
    'EN_ROUTE_PICKUP': 'ຄົນຂັບກຳລັງໄປຮັບ',
    'PICKED_UP': 'ຮັບຜ້າແລ້ວ',
    'IN_TRANSIT': 'ກໍາລັງສົ່ງ',
    'DELIVERED': 'ສົ່ງສຳເລັດ',
  };

  @override
  Widget build(BuildContext context) {
    final currentStep = _steps.indexOf(delivery.status);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Status badge ─────────────────────────────────────────────
          Center(child: SwBadge(status: delivery.status)),
          const SizedBox(height: 20),

          // ── Progress steps ────────────────────────────────────────────
          SwCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _steps.asMap().entries.map((e) {
                final step = e.value;
                final isDone = e.key <= currentStep;
                final isCurrent = e.key == currentStep;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isDone ? SwColors.success : SwColors.border,
                        ),
                        child: Icon(
                          isDone ? Icons.check : Icons.circle_outlined,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        _stepLabels[step] ?? step,
                        style: isCurrent
                            ? SwTypography.label
                                .copyWith(color: SwColors.primary)
                            : SwTypography.body,
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),

          // ── Driver info ───────────────────────────────────────────────
          SwCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ຂໍ້ມູນຄົນຂັບ', style: SwTypography.heading3),
                const SizedBox(height: 12),
                _Row(icon: Icons.person, text: delivery.driverName),
                _Row(icon: Icons.directions_car, text: delivery.driverVehicle),
                _Row(icon: Icons.pin, text: delivery.driverPlate),
                _Row(
                  icon: Icons.star,
                  text: delivery.driverRating.toStringAsFixed(1),
                ),
                if (delivery.estimatedArrival.isNotEmpty)
                  _Row(
                    icon: Icons.access_time,
                    text: 'ຄາດໂຕ: ${delivery.estimatedArrival}',
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: SwColors.textMuted),
          const SizedBox(width: 8),
          Text(text, style: SwTypography.body),
        ],
      ),
    );
  }
}
