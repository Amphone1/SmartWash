import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/branch.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

final _branchesProvider = FutureProvider.autoDispose<List<Branch>>((ref) {
  return ref.read(apiClientProvider).listBranches();
});

/// Step 1 of the order creation wizard — the customer picks a laundry branch.
class BranchPickerScreen extends ConsumerWidget {
  const BranchPickerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchesAsync = ref.watch(_branchesProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ເລືອກສາຂາ')),
      body: branchesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(mapError(e), style: SwTypography.body)),
        data: (branches) {
          if (branches.isEmpty) {
            return const SwEmptyState(
              icon: Icons.store_outlined,
              title: 'ບໍ່ມີສາຂາ',
              subtitle: 'ຍັງບໍ່ມີສາຂາເປີດໃຫ້ບໍລິການ',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: branches.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _BranchCard(
              branch: branches[i],
              onTap: () => context.push(
                '/customer/order/machine',
                extra: {
                  'branchId': branches[i].id,
                  'branchName': branches[i].nameLao ?? branches[i].name,
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({required this.branch, required this.onTap});
  final Branch branch;
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
            child: const Icon(Icons.local_laundry_service, color: SwColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  branch.nameLao ?? branch.name,
                  style: SwTypography.label,
                ),
                if (branch.address != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(branch.address!, style: SwTypography.caption),
                  ),
                if (branch.hours.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(branch.hours, style: SwTypography.caption),
                  ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: SwColors.textMuted),
        ],
      ),
    );
  }
}
