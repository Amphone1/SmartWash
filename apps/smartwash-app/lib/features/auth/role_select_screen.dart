import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_role.dart';
import '../../design_system/sw_colors.dart';
import '../../design_system/sw_typography.dart';
import '../../providers/auth_provider.dart';
import '../../providers/role_provider.dart';

/// Shown when a user has more than one mobile role and must choose which mode
/// to enter. Also reachable from any profile screen to switch roles.
class RoleSelectScreen extends ConsumerWidget {
  const RoleSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final roles = user?.roles.toList() ?? [];

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(
        title: const Text('ເລືອກໂໝດການໃຊ້ງານ'),
        automaticallyImplyLeading:
            ref.read(activeRoleProvider) != null, // allow back if already in a mode
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ສະບາຍດີ, ${user?.name ?? ''}',
                style: SwTypography.heading2,
              ),
              const SizedBox(height: 8),
              Text(
                'ບັນຊີຂອງທ່ານມີຫຼາຍໂໝດ. ເລືອກໂໝດທີ່ຕ້ອງການ:',
                style: SwTypography.body,
              ),
              const SizedBox(height: 32),
              ...roles.map((role) => _RoleTile(role: role)),
              const Spacer(),
              TextButton.icon(
                onPressed: () => ref.read(authProvider.notifier).logout(),
                icon: const Icon(Icons.logout, color: SwColors.textMuted),
                label: Text(
                  'ອອກຈາກລະບົບ',
                  style: SwTypography.body.copyWith(color: SwColors.textMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleTile extends ConsumerWidget {
  const _RoleTile({required this.role});
  final AppRole role;

  static const _roleIcons = {
    AppRole.customer: Icons.local_laundry_service,
    AppRole.driver: Icons.delivery_dining,
    AppRole.staff: Icons.manage_accounts,
  };

  static const _roleDescriptions = {
    AppRole.customer: 'ສັ່ງຊັກ, ຕິດຕາມ ແລະ ຈ່າຍເງິນ',
    AppRole.driver: 'ຮັບງານ ແລະ ສົ່ງຜ້າ',
    AppRole.staff: 'ຈັດການເຄື່ອງ ແລະ ກວດສອບການຊໍາລະ',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => ref.read(activeRoleProvider.notifier).select(role),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: SwColors.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: SwColors.border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: SwColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _roleIcons[role] ?? Icons.person,
                    color: SwColors.primary,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(role.displayName, style: SwTypography.heading3),
                      const SizedBox(height: 4),
                      Text(
                        _roleDescriptions[role] ?? '',
                        style: SwTypography.bodySmall,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: SwColors.textHint),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
