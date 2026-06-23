import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_badge.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _slipsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(apiClientProvider).listPendingSlips();
});

/// Staff slip review screen — lets field staff approve or reject payment slips
/// that are pending OCR/manual review. Equivalent to the web owner portal SlipReview page.
class SlipsScreen extends ConsumerWidget {
  const SlipsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slipsAsync = ref.watch(_slipsProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ກວດສອບສະລິ໋ປ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_slipsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_slipsProvider),
        child: slipsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) =>
              Center(child: Text(mapError(e), style: SwTypography.body)),
          data: (slips) {
            if (slips.isEmpty) {
              return const SwEmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'ບໍ່ມີສະລິ໋ປ',
                subtitle: 'ສະລິ໋ປທີ່ຕ້ອງກວດສອບຈະສະແດງທີ່ນີ້',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: slips.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _SlipCard(
                slip: slips[i],
                onApprove: () async {
                  await ref
                      .read(apiClientProvider)
                      .approveSlip(slips[i]['id'] as String);
                  ref.invalidate(_slipsProvider);
                },
                onReject: () async {
                  await ref
                      .read(apiClientProvider)
                      .rejectSlip(slips[i]['id'] as String);
                  ref.invalidate(_slipsProvider);
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _SlipCard extends StatefulWidget {
  const _SlipCard({
    required this.slip,
    required this.onApprove,
    required this.onReject,
  });

  final Map<String, dynamic> slip;
  final Future<void> Function() onApprove;
  final Future<void> Function() onReject;

  @override
  State<_SlipCard> createState() => _SlipCardState();
}

class _SlipCardState extends State<_SlipCard> {
  bool _isApproving = false;
  bool _isRejecting = false;

  Future<void> _approve() async {
    setState(() => _isApproving = true);
    try {
      await widget.onApprove();
    } finally {
      if (mounted) setState(() => _isApproving = false);
    }
  }

  Future<void> _reject() async {
    setState(() => _isRejecting = true);
    try {
      await widget.onReject();
    } finally {
      if (mounted) setState(() => _isRejecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBusy = _isApproving || _isRejecting;
    final status = widget.slip['status'] as String? ?? '';
    final amountKip =
        (widget.slip['amountKip'] ?? widget.slip['amount'] as num?)?.toInt() ??
            0;
    final customerName = widget.slip['customerName'] as String? ?? '';

    return SwCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(customerName, style: SwTypography.label),
              SwBadge(status: status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            formatKip(amountKip),
            style: SwTypography.heading3.copyWith(color: SwColors.primary),
          ),
          if (widget.slip['imageUrl'] != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: widget.slip['imageUrl'] as String,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  height: 80,
                  color: SwColors.border,
                  child: const Center(
                    child: Icon(Icons.broken_image, color: SwColors.textHint),
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SwButton(
                  label: 'ອະນຸມັດ',
                  variant: SwButtonVariant.success,
                  isFullWidth: false,
                  isLoading: _isApproving,
                  onPressed: isBusy ? null : _approve,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SwButton(
                  label: 'ປະຕິເສດ',
                  variant: SwButtonVariant.danger,
                  isFullWidth: false,
                  isLoading: _isRejecting,
                  onPressed: isBusy ? null : _reject,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
