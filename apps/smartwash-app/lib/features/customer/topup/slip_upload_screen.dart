import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../providers/auth_provider.dart';

/// Customer slip upload screen — pick or capture a payment slip image and
/// submit it to the BFF, which computes the SHA-256 and forwards to the
/// payment service. Called after the customer transfers money via the QR code.
class SlipUploadScreen extends ConsumerStatefulWidget {
  const SlipUploadScreen({super.key, required this.qrRef});
  final String qrRef;

  @override
  ConsumerState<SlipUploadScreen> createState() => _SlipUploadScreenState();
}

class _SlipUploadScreenState extends ConsumerState<SlipUploadScreen> {
  final _picker = ImagePicker();
  XFile? _image;
  bool _isUploading = false;
  String? _error;
  bool _success = false;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 1600,
      );
      if (picked != null) {
        setState(() {
          _image = picked;
          _error = null;
          _success = false;
        });
      }
    } catch (e) {
      setState(() => _error = mapError(e));
    }
  }

  Future<void> _submit() async {
    if (_image == null) {
      setState(() => _error = 'ກະລຸນາເລືອກຮູບສະລິ໋ປ');
      return;
    }
    setState(() {
      _isUploading = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).uploadSlipImage(
            qrRef: widget.qrRef,
            filePath: _image!.path,
          );
      setState(() => _success = true);
    } catch (e) {
      setState(() => _error = mapError(e));
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ອັບໂຫລດສະລິ໋ປ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_success) ...[
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: SwColors.successLight,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.check_circle, color: SwColors.success, size: 48),
                    const SizedBox(height: 12),
                    const Text(
                      'ສ່ງສະລິ໋ປສໍາເລັດ',
                      style: SwTypography.heading3,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'ທີມງານຈະກວດສອບ ແລະ ເຕີມຍອດໃຫ້ທ່ານໃນໄວໆນີ້',
                      style: SwTypography.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    SwButton(
                      label: 'ກັບໄປໜ້າຫຼັກ',
                      onPressed: () => context.go('/customer/home'),
                    ),
                  ],
                ),
              ),
            ] else ...[
              const Text('ຮູບສະລິ໋ປໂອນເງິນ', style: SwTypography.heading3),
              const SizedBox(height: 6),
              const Text(
                'ຖ່າຍ ຫຼື ເລືອກຮູບໜ້າຈໍ / ສະລິ໋ປໂອນເງິນ',
                style: SwTypography.bodySmall,
              ),
              const SizedBox(height: 20),

              // ── Image preview ─────────────────────────────────────────
              if (_image != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(
                    File(_image!.path),
                    height: 280,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: 16),
              ] else
                Container(
                  height: 180,
                  decoration: BoxDecoration(
                    color: SwColors.border,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: SwColors.divider,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.image_outlined, size: 42, color: SwColors.textMuted),
                        SizedBox(height: 8),
                        Text(
                          'ຍັງບໍ່ໄດ້ເລືອກຮູບ',
                          style: TextStyle(color: SwColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 16),

              // ── Pick buttons ──────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: SwButton(
                      label: 'ຖ່າຍຮູບ',
                      variant: SwButtonVariant.outline,
                      isFullWidth: false,
                      onPressed: () => _pickImage(ImageSource.camera),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SwButton(
                      label: 'ອາລະບໍ້າ',
                      variant: SwButtonVariant.outline,
                      isFullWidth: false,
                      onPressed: () => _pickImage(ImageSource.gallery),
                    ),
                  ),
                ],
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

              const SizedBox(height: 24),
              SwButton(
                label: 'ສ່ງສະລິ໋ປ',
                onPressed: _image != null ? _submit : null,
                isLoading: _isUploading,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
