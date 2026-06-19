import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/kip_formatter.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_card.dart';

const _cycles = [
  _CycleDef(key: 'quick',  labelLao: 'ໄວ',      minutes: 30, multiplier: 1.0),
  _CycleDef(key: 'normal', labelLao: 'ປົກກະຕິ', minutes: 45, multiplier: 1.25),
  _CycleDef(key: 'heavy',  labelLao: 'ໜັກ',      minutes: 60, multiplier: 1.5),
];

class _CycleDef {
  const _CycleDef({
    required this.key,
    required this.labelLao,
    required this.minutes,
    required this.multiplier,
  });
  final String key;
  final String labelLao;
  final int minutes;
  final double multiplier;
}

/// Step 3 of the order wizard — choose wash cycle intensity.
class CyclePickerScreen extends StatelessWidget {
  const CyclePickerScreen({super.key, required this.wizardState});
  final Map<String, dynamic> wizardState;

  @override
  Widget build(BuildContext context) {
    final basePrice = (wizardState['priceKip'] as int?) ?? 0;

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ເລືອກຮອບຊັກ')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _cycles.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final c = _cycles[i];
          final price = (basePrice * c.multiplier).round();
          return _CycleCard(
            cycle: c,
            priceKip: price,
            onTap: () => context.push(
              '/customer/order/confirm',
              extra: {
                ...wizardState,
                'cycle': c.key,
                'cycleLabel': c.labelLao,
                'durationMin': c.minutes,
                'priceKip': price,
              },
            ),
          );
        },
      ),
    );
  }
}

class _CycleCard extends StatelessWidget {
  const _CycleCard({
    required this.cycle,
    required this.priceKip,
    required this.onTap,
  });
  final _CycleDef cycle;
  final int priceKip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SwCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: SwColors.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.timer_outlined, color: SwColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(cycle.labelLao, style: SwTypography.label),
                const SizedBox(height: 3),
                Text('${cycle.minutes} ນາທີ', style: SwTypography.caption),
              ],
            ),
          ),
          Text(
            formatKip(priceKip),
            style: SwTypography.heading3.copyWith(color: SwColors.primary),
          ),
          const SizedBox(width: 6),
          const Icon(Icons.chevron_right, color: SwColors.textMuted),
        ],
      ),
    );
  }
}
