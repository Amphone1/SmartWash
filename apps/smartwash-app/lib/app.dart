import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'design_system/sw_theme.dart';
import 'providers/auth_provider.dart';
import 'router/app_router.dart';

class SmartWashApp extends ConsumerStatefulWidget {
  const SmartWashApp({super.key});

  @override
  ConsumerState<SmartWashApp> createState() => _SmartWashAppState();
}

class _SmartWashAppState extends ConsumerState<SmartWashApp> {
  @override
  void initState() {
    super.initState();
    // Restore persisted session on cold start.
    Future.microtask(() => ref.read(authProvider.notifier).restore());
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'SmartWash',
      theme: buildSwTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
