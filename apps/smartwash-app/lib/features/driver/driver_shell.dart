import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../design_system/sw_colors.dart';

class DriverShell extends StatelessWidget {
  const DriverShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    (path: '/driver/tasks', icon: Icons.assignment_outlined, activeIcon: Icons.assignment, label: 'ງານ'),
    (path: '/driver/map', icon: Icons.map_outlined, activeIcon: Icons.map, label: 'ແຜນທີ່'),
    (path: '/driver/earnings', icon: Icons.payments_outlined, activeIcon: Icons.payments, label: 'ລາຍຮັບ'),
    (path: '/driver/profile', icon: Icons.person_outline, activeIcon: Icons.person, label: 'ໂປຣໄຟລ໌'),
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
