import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/wallet.dart';
import '../../../core/utils/kip_formatter.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../providers/auth_provider.dart';

const _presets = [20000, 50000, 100000, 200000, 500000];

class TopupScreen extends ConsumerStatefulWidget {
  const TopupScreen({super.key});

  @override
  ConsumerState<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends ConsumerState<TopupScreen> {
  final _amountCtrl = TextEditingController();
  QrPayment? _qr;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _generateQr() async {
    final amount = int.tryParse(_amountCtrl.text.replaceAll(',', ''));
    if (amount == null || amount < 5000) {
      setState(() => _error = 'ຈໍານວນຕ່ຳສຸດ ₭5,000');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
      _qr = null;
    });

    try {
      final qr = await ref.read(apiClientProvider).createTopupQr(amount);
      setState(() => _qr = qr);
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
      appBar: AppBar(title: const Text('ຕື່ມເງິນ')),
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
                child: Text(_error!,
                    style: const TextStyle(color: SwColors.danger)),
              ),

            // ── Amount input ─────────────────────────────────────────
            const Text('ຈໍານວນ (ກີບ)', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              style: SwTypography.heading2,
              decoration: const InputDecoration(
                prefixText: '₭ ',
                hintText: '0',
              ),
            ),
            const SizedBox(height: 12),

            // ── Preset amounts ────────────────────────────────────────
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _presets
                  .map((p) => ActionChip(
                        label: Text(formatKip(p)),
                        onPressed: () =>
                            _amountCtrl.text = p.toString(),
                        backgroundColor: SwColors.primaryLight,
                        labelStyle: const TextStyle(
                            color: SwColors.primaryDark,
                            fontWeight: FontWeight.w600),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 24),

            SwButton(
              label: 'ສ້າງ QR ຊໍາລະ',
              onPressed: _generateQr,
              isLoading: _isLoading,
            ),

            // ── QR display ────────────────────────────────────────────
            if (_qr != null) ...[
              const SizedBox(height: 28),
              Center(
                child: Column(
                  children: [
                    const Text('ສະແກນ QR ຊໍາລະ', style: SwTypography.heading3),
                    const SizedBox(height: 4),
                    Text(
                      'ໂອນໃຫ້ຖືກຕ້ອງ: ${formatKip(int.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0)}',
                      style: SwTypography.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: _qr!.qrImageUrl,
                        width: 240,
                        height: 240,
                        placeholder: (_, __) => Container(
                          width: 240,
                          height: 240,
                          color: SwColors.border,
                          child: const Center(child: CircularProgressIndicator()),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'ໝົດອາຍຸ: ${_qr!.expiresAt}',
                      style: SwTypography.caption,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
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
                        'ຫຼັງຈາກໂອນເງິນແລ້ວ ກະລຸນາອັບໂຫລດສະລິ໋ປ',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SwButton(
                label: 'ອັບໂຫລດສະລິ໋ປ',
                icon: Icons.upload_file_outlined,
                onPressed: () => context.push(
                  '/customer/topup/slip/${_qr!.qrRef}',
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
