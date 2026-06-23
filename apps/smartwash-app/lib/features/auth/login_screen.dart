import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../design_system/sw_colors.dart';
import '../../design_system/sw_typography.dart';
import '../../design_system/widgets/sw_button.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });
    try {
      await ref.read(authProvider.notifier).login(
            _usernameCtrl.text.trim(),
            _passwordCtrl.text,
          );
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SwColors.pageBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),

              // ── Logo ──────────────────────────────────────────────────────
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: SwColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.local_laundry_service,
                      color: Colors.white, size: 44),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'SmartWash',
                style: SwTypography.heading1,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              const Text(
                'ເຂົ້າສູ່ລະບົບ',
                style: SwTypography.body,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),

              // ── Error banner ─────────────────────────────────────────────
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: SwColors.dangerLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: SwColors.danger.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: SwColors.danger, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: SwColors.danger,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // ── Form ─────────────────────────────────────────────────────
              Text('ຊື່ຜູ້ໃຊ້ / ເບີໂທ',
                  style: SwTypography.label.copyWith(fontSize: 13)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _usernameCtrl,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  hintText: 'ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 16),
              Text('ລະຫັດຜ່ານ',
                  style: SwTypography.label.copyWith(fontSize: 13)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _passwordCtrl,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _login(),
                decoration: InputDecoration(
                  hintText: 'ກະລຸນາໃສ່ລະຫັດຜ່ານ',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 28),

              SwButton(
                label: 'ເຂົ້າສູ່ລະບົບ',
                onPressed: _isLoading ? null : _login,
                isLoading: _isLoading,
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}
