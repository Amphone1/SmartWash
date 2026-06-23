import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/address.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_card.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';

/// Saved delivery addresses for the current customer. Shared by the address
/// management screen and the delivery-request picker so both stay in sync.
final addressesProvider =
    FutureProvider.autoDispose<List<Address>>((ref) {
  return ref.read(apiClientProvider).listAddresses();
});

/// Manage saved pickup/dropoff addresses (list · add · delete).
/// The backend has no update endpoint, so editing is delete + re-create.
class CustomerAddressesScreen extends ConsumerWidget {
  const CustomerAddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressesAsync = ref.watch(addressesProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ທີ່ຢູ່ທີ່ບັນທຶກ')),
      floatingActionButton: addressesAsync.maybeWhen(
        data: (list) => list.isEmpty
            ? null
            : FloatingActionButton.extended(
                onPressed: () => showAddAddressSheet(context, ref),
                icon: const Icon(Icons.add),
                label: const Text('ເພີ່ມທີ່ຢູ່'),
              ),
        orElse: () => null,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(addressesProvider),
        child: addressesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 120),
              Center(child: Text(mapError(e), style: SwTypography.body)),
            ],
          ),
          data: (addresses) {
            if (addresses.isEmpty) {
              return SwEmptyState(
                icon: Icons.location_off_outlined,
                title: 'ຍັງບໍ່ມີທີ່ຢູ່',
                subtitle: 'ເພີ່ມທີ່ຢູ່ເພື່ອໃຊ້ກັບການຮັບ-ສົ່ງ',
                action: SwButton(
                  label: 'ເພີ່ມທີ່ຢູ່',
                  icon: Icons.add,
                  isFullWidth: false,
                  onPressed: () => showAddAddressSheet(context, ref),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: addresses.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _AddressCard(
                address: addresses[i],
                onDelete: () => _confirmDelete(context, ref, addresses[i]),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Address address,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ລຶບທີ່ຢູ່'),
        content: Text('ລຶບ "${address.label}" ບໍ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('ຍົກເລີກ'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: SwColors.danger),
            child: const Text('ລຶບ'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiClientProvider).deleteAddress(address.id);
      ref.invalidate(addressesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(mapError(e))));
      }
    }
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.address, required this.onDelete});

  final Address address;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return SwCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: SwColors.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.location_on_outlined,
                color: SwColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(address.label, style: SwTypography.label)),
                    if (address.isDefault) ...[
                      const SizedBox(width: 8),
                      const _DefaultChip(),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  address.address,
                  style: SwTypography.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: SwColors.textHint),
            onPressed: onDelete,
            tooltip: 'ລຶບ',
          ),
        ],
      ),
    );
  }
}

class _DefaultChip extends StatelessWidget {
  const _DefaultChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: SwColors.primaryLight,
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'ຄ່າເລີ່ມຕົ້ນ',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: SwColors.primary,
        ),
      ),
    );
  }
}

/// Opens the add-address form. Returns the created [Address] on success,
/// or null if the user cancelled. Invalidates [addressesProvider] so any
/// open list refreshes.
Future<Address?> showAddAddressSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<Address>(
    context: context,
    isScrollControlled: true,
    backgroundColor: SwColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _AddAddressSheet(),
  );
}

class _AddAddressSheet extends ConsumerStatefulWidget {
  const _AddAddressSheet();

  @override
  ConsumerState<_AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends ConsumerState<_AddAddressSheet> {
  final _labelCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  bool _isDefault = false;
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _labelCtrl.dispose();
    _addressCtrl.dispose();
    _latCtrl.dispose();
    _lngCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final label = _labelCtrl.text.trim();
    final address = _addressCtrl.text.trim();
    final lat = double.tryParse(_latCtrl.text.trim());
    final lng = double.tryParse(_lngCtrl.text.trim());

    if (label.isEmpty || address.isEmpty) {
      setState(() => _error = 'ກະລຸນາໃສ່ຊື່ ແລະ ທີ່ຢູ່');
      return;
    }
    if (lat == null || lat < -90 || lat > 90) {
      setState(() => _error = 'ເສັ້ນຂະໜານ (lat) ບໍ່ຖືກຕ້ອງ (-90 ຫາ 90)');
      return;
    }
    if (lng == null || lng < -180 || lng > 180) {
      setState(() => _error = 'ເສັ້ນແວງ (lng) ບໍ່ຖືກຕ້ອງ (-180 ຫາ 180)');
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final created = await ref.read(apiClientProvider).createAddress(
            label: label,
            address: address,
            lat: lat,
            lng: lng,
            isDefault: _isDefault,
          );
      ref.invalidate(addressesProvider);
      if (mounted) Navigator.pop(context, created);
    } catch (e) {
      setState(() => _error = mapError(e));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: SwColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('ເພີ່ມທີ່ຢູ່ໃໝ່', style: SwTypography.heading3),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: SwColors.dangerLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!,
                    style: const TextStyle(color: SwColors.danger)),
              ),
            const Text('ຊື່ທີ່ຢູ່', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _labelCtrl,
              maxLength: 40,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                hintText: 'ເຊັ່ນ: ບ້ານ, ຫ້ອງການ',
                prefixIcon: Icon(Icons.bookmark_outline),
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            const Text('ທີ່ຢູ່', style: SwTypography.label),
            const SizedBox(height: 8),
            TextField(
              controller: _addressCtrl,
              maxLength: 200,
              minLines: 1,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'ບ້ານເລກທີ, ຖະໜົນ, ເມືອງ',
                prefixIcon: Icon(Icons.location_on_outlined),
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ເສັ້ນຂະໜານ (lat)', style: SwTypography.label),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _latCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true, signed: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.\-]')),
                        ],
                        decoration: const InputDecoration(hintText: '17.9757'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ເສັ້ນແວງ (lng)', style: SwTypography.label),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _lngCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true, signed: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.\-]')),
                        ],
                        decoration: const InputDecoration(hintText: '102.6331'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('ຕັ້ງເປັນຄ່າເລີ່ມຕົ້ນ', style: SwTypography.body),
              value: _isDefault,
              onChanged: (v) => setState(() => _isDefault = v),
            ),
            const SizedBox(height: 12),
            SwButton(
              label: 'ບັນທຶກທີ່ຢູ່',
              onPressed: _save,
              isLoading: _isSaving,
            ),
          ],
        ),
      ),
    );
  }
}

/// Opens a picker listing the customer's saved addresses. Returns the chosen
/// [Address], or null if cancelled. Offers an inline "add new" path that
/// returns the freshly created address.
Future<Address?> showAddressPickerSheet(
  BuildContext context,
  WidgetRef ref, {
  required String title,
}) {
  return showModalBottomSheet<Address>(
    context: context,
    isScrollControlled: true,
    backgroundColor: SwColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      return Consumer(
        builder: (ctx, sheetRef, __) {
          final addressesAsync = sheetRef.watch(addressesProvider);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: SwColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(title, style: SwTypography.heading3),
                  const SizedBox(height: 12),
                  Flexible(
                    child: addressesAsync.when(
                      loading: () => const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: CircularProgressIndicator()),
                      ),
                      error: (e, _) => Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(mapError(e), style: SwTypography.body),
                      ),
                      data: (addresses) => ListView(
                        shrinkWrap: true,
                        children: [
                          for (final a in addresses)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.location_on_outlined,
                                  color: SwColors.primary),
                              title: Text(a.label, style: SwTypography.label),
                              subtitle: Text(
                                a.address,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SwTypography.bodySmall,
                              ),
                              onTap: () => Navigator.pop(sheetContext, a),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const Divider(height: 24),
                  SwButton(
                    label: 'ເພີ່ມທີ່ຢູ່ໃໝ່',
                    icon: Icons.add,
                    variant: SwButtonVariant.outline,
                    onPressed: () async {
                      final created =
                          await showAddAddressSheet(sheetContext, sheetRef);
                      if (created != null && sheetContext.mounted) {
                        Navigator.pop(sheetContext, created);
                      }
                    },
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}
