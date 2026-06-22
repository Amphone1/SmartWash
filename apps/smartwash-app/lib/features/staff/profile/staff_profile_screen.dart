import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/role_provider.dart';

class StaffProfileScreen extends ConsumerWidget {
  const StaffProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ໂປຣໄຟລ໌')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: const Color(0xFFFEF3C7),
                  child: Text(
                    user?.name.isNotEmpty == true
                        ? user!.name[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(user?.name ?? '', style: SwTypography.heading3),
                const Text('Staff', style: TextStyle(color: Color(0xFF92400E))),
                if (user?.branchId != null)
                  Text('Branch: ${user!.branchId}',
                      style: SwTypography.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: 28),

          if ((user?.roles.length ?? 0) > 1)
            ListTile(
              leading: const Icon(Icons.swap_horiz, color: SwColors.textMuted),
              title: Text('ສ່ຽງໂໝດ', style: SwTypography.body),
              trailing: const Icon(Icons.chevron_right, color: SwColors.textHint),
              onTap: () {
                ref.read(activeRoleProvider.notifier).deselect();
                context.push('/select-role');
              },
              contentPadding: EdgeInsets.zero,
            ),

          ListTile(
            leading: const Icon(Icons.logout, color: SwColors.danger),
            title: Text(
              'ອອກຈາກລະບົບ',
              style: SwTypography.body.copyWith(color: SwColors.danger),
            ),
            onTap: () => ref.read(authProvider.notifier).logout(),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }
}
