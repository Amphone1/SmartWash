import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/earnings.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../providers/auth_provider.dart';

final _earningsProvider = FutureProvider.autoDispose<EarningsData>((ref) {
  return ref.read(apiClientProvider).getEarnings();
});

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earningsAsync = ref.watch(_earningsProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ລາຍຮັບ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_earningsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_earningsProvider),
        child: earningsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) =>
              Center(child: Text(mapError(e), style: SwTypography.body)),
          data: (e) => ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // ── Hero today ────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [SwColors.success, Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ລາຍຮັບມື້ນີ້',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      formatKip(e.todayKip),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${e.tripsToday} ການເດີນທາງ',
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Period breakdown ──────────────────────────────────────
              SwCard(
                child: Column(
                  children: [
                    _PeriodRow(
                      label: 'ອາທິດນີ້',
                      amountKip: e.weekKip,
                    ),
                    const Divider(height: 20, color: SwColors.divider),
                    _PeriodRow(
                      label: 'ເດືອນນີ້',
                      amountKip: e.monthKip,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodRow extends StatelessWidget {
  const _PeriodRow({required this.label, required this.amountKip});
  final String label;
  final int amountKip;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: SwTypography.body),
        Text(
          formatKip(amountKip),
          style: SwTypography.label.copyWith(color: SwColors.primary),
        ),
      ],
    );
  }
}
