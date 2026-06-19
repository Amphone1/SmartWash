import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../design_system/sw_colors.dart';

class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    (path: '/customer/home', icon: Icons.home_outlined, activeIcon: Icons.home, label: 'ໜ້າຫຼັກ'),
    (path: '/customer/orders', icon: Icons.receipt_long_outlined, activeIcon: Icons.receipt_long, label: 'ຄໍາສັ່ງ'),
    (path: '/customer/scan', icon: Icons.qr_code_scanner, activeIcon: Icons.qr_code_scanner, label: 'ສະແກນ'),
    (path: '/customer/profile', icon: Icons.person_outline, activeIcon: Icons.person, label: 'ໂປຣໄຟລ໌'),
  ];

  int _currentIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final idx = _tabs.indexWhere((t) => loc.startsWith(t.path));
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: SwColors.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: idx,
          onTap: (i) => context.go(_tabs[i].path),
          items: _tabs
              .map((t) => BottomNavigationBarItem(
                    icon: Icon(t.icon),
                    activeIcon: Icon(t.activeIcon),
                    label: t.label,
                  ))
              .toList(),
        ),
      ),
    );
  }
}
