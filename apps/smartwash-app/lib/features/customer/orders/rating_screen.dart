import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../providers/auth_provider.dart';

const _tags = [
  ('ສະອາດ', '✨'),
  ('ໄວ', '⚡'),
  ('ຄົນຂັບດີ', '👍'),
  ('ລາຄາດີ', '💰'),
  ('ສາຂາສະດວກ', '📍'),
  ('ເຄື່ອງໃໝ່', '🔧'),
];

class RatingScreen extends ConsumerStatefulWidget {
  const RatingScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends ConsumerState<RatingScreen> {
  int _stars = 0;
  final Set<String> _selectedTags = {};
  final _commentCtrl = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars == 0) {
      setState(() => _error = 'ກະລຸນາເລືອກຄະແນນ');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).submitRating(
            orderId: widget.orderId,
            rating: _stars,
            tags: _selectedTags.toList(),
            comment: _commentCtrl.text.trim().isEmpty
                ? null
                : _commentCtrl.text.trim(),
          );
      if (!mounted) return;
      context.pop();
    } catch (e) {
      setState(() => _error = mapError(e));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ໃຫ້ຄະແນນ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'ທ່ານພໍໃຈຫຼາຍປານໃດ?',
              style: SwTypography.heading2,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),

            // ── Star selector ─────────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final filled = i < _stars;
                return GestureDetector(
                  onTap: () => setState(() => _stars = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Icon(
                      filled ? Icons.star_rounded : Icons.star_outline_rounded,
                      size: 44,
                      color: filled ? SwColors.warning : SwColors.border,
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),
            Text(
              _stars == 0
                  ? ''
                  : ['ຮ້າຍ', 'ພໍໃຊ້', 'ດີ', 'ດີຫຼາຍ', 'ດີເລີດ'][_stars - 1],
              style: SwTypography.body
                  .copyWith(color: SwColors.primary, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),

            // ── Tags ──────────────────────────────────────────────────────
            const Text('ສິ່ງທີ່ດີ (ເລືອກໄດ້ຫຼາຍ)', style: SwTypography.label),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _tags.map((tag) {
                final selected = _selectedTags.contains(tag.$1);
                return FilterChip(
                  label: Text('${tag.$2} ${tag.$1}'),
                  selected: selected,
                  onSelected: (_) => setState(() {
                    if (selected) {
                      _selectedTags.remove(tag.$1);
                    } else {
                      _selectedTags.add(tag.$1);
                    }
                  }),
                  selectedColor: SwColors.primaryLight2,
                  checkmarkColor: SwColors.primary,
                  labelStyle: TextStyle(
                    color:
                        selected ? SwColors.primaryDark : SwColors.textBody,
                    fontWeight: FontWeight.w500,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // ── Comment ───────────────────────────────────────────────────
            const Text('ຄຳເຫັນ (ທາງເລືອກ)', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'ບອກເຮົາເພີ່ມເຕີມ...',
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: SwColors.dangerLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child:
                    Text(_error!, style: const TextStyle(color: SwColors.danger)),
              ),
            ],

            const SizedBox(height: 28),
            SwButton(
              label: 'ສົ່ງຄະແນນ',
              onPressed: _stars == 0 ? null : _submit,
              isLoading: _isSubmitting,
            ),
            const SizedBox(height: 12),
            SwButton(
              label: 'ຂ້າມ',
              variant: SwButtonVariant.ghost,
              onPressed: () => context.pop(),
            ),
          ],
        ),
      ),
    );
  }
}
