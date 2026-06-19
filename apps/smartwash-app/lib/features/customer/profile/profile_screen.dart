import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../providers/auth_provider.dart';

class CustomerProfileScreen extends ConsumerWidget {
  const CustomerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ໂປຣໄຟລ໌')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ── Avatar ────────────────────────────────────────────────────
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: SwColors.primaryLight,
                  child: Text(
                    (user?.name.isNotEmpty == true
                            ? user!.name[0].toUpperCase()
                            : '?'),
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: SwColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(user?.name ?? '', style: SwTypography.heading3),
                Text(user?.username ?? '', style: SwTypography.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // ── Role switch (if user has multiple roles) ──────────────────
          if ((user?.roles.length ?? 0) > 1)
            _Tile(
              icon: Icons.swap_horiz,
              title: 'ສ່ຽງໂໝດ',
              subtitle: 'ສ່ຽງລະຫວ່າງ Customer / Driver / Staff',
              onTap: () => context.push('/select-role'),
            ),

          _Tile(
            icon: Icons.notifications_outlined,
            title: 'ການແຈ້ງເຕືອນ',
            onTap: () {},
          ),
          _Tile(
            icon: Icons.home_outlined,
            title: 'ທີ່ຢູ່ທີ່ບັນທຶກ',
            onTap: () {},
          ),
          _Tile(
            icon: Icons.help_outline,
            title: 'ຊ່ວຍເຫຼືອ',
            onTap: () {},
          ),
          const Divider(height: 32),
          _Tile(
            icon: Icons.logout,
            title: 'ອອກຈາກລະບົບ',
            iconColor: SwColors.danger,
            textColor: SwColors.danger,
            onTap: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.iconColor,
    this.textColor,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? SwColors.textMuted),
      title: Text(
        title,
        style: SwTypography.body.copyWith(color: textColor),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!, style: SwTypography.bodySmall)
          : null,
      trailing: const Icon(Icons.chevron_right, color: SwColors.textHint),
      onTap: onTap,
      contentPadding: EdgeInsets.zero,
    );
  }
}
