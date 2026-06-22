import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/address.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../design_system/widgets/sw_button.dart';
import '../../../design_system/widgets/sw_empty_state.dart';
import '../../../providers/auth_provider.dart';
import '../profile/addresses_screen.dart';

class DeliveryRequestScreen extends ConsumerStatefulWidget {
  const DeliveryRequestScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<DeliveryRequestScreen> createState() =>
      _DeliveryRequestScreenState();
}

class _DeliveryRequestScreenState
    extends ConsumerState<DeliveryRequestScreen> {
  Address? _pickup;
  Address? _dropoff;
  bool _isLoading = false;
  String? _error;

  /// First-available default: prefer the user's default address, else the
  /// first saved one. Returns the user's explicit choice once made.
  Address? _resolve(Address? chosen, List<Address> addresses) {
    if (chosen != null) return chosen;
    if (addresses.isEmpty) return null;
    return addresses.firstWhere(
      (a) => a.isDefault,
      orElse: () => addresses.first,
    );
  }

  Future<void> _pick({required bool isPickup}) async {
    final selected = await showAddressPickerSheet(
      context,
      ref,
      title: isPickup ? 'ເລືອກທີ່ຢູ່ຮັບ' : 'ເລືອກທີ່ຢູ່ສົ່ງ',
    );
    if (selected == null) return;
    setState(() {
      if (isPickup) {
        _pickup = selected;
      } else {
        _dropoff = selected;
      }
    });
  }

  Future<void> _submit(List<Address> addresses) async {
    final pickup = _resolve(_pickup, addresses);
    final dropoff = _resolve(_dropoff, addresses);
    if (pickup == null || dropoff == null) {
      setState(() => _error = 'ກະລຸນາເລືອກທີ່ຢູ່ຮັບ ແລະ ສົ່ງ');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final delivery = await ref.read(apiClientProvider).requestDelivery(
        widget.orderId,
        pickup: {'addr': pickup.address, 'lat': pickup.lat, 'lng': pickup.lng},
        dropoff: {
          'addr': dropoff.address,
          'lat': dropoff.lat,
          'lng': dropoff.lng,
        },
      );
      if (mounted) {
        context.go('/customer/delivery/${delivery.id}/track');
      }
    } catch (e) {
      setState(() => _error = mapError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final addressesAsync = ref.watch(addressesProvider);

    return Scaffold(
      backgroundColor: SwColors.pageBg,
      appBar: AppBar(title: const Text('ສ້າງຄໍາສັ່ງຈັດສົ່ງ')),
      body: addressesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(mapError(e), style: SwTypography.body)),
        data: (addresses) {
          if (addresses.isEmpty) {
            return SwEmptyState(
              icon: Icons.location_off_outlined,
              title: 'ຍັງບໍ່ມີທີ່ຢູ່ບັນທຶກ',
              subtitle: 'ເພີ່ມທີ່ຢູ່ກ່ອນເພື່ອສ້າງຄໍາສັ່ງຈັດສົ່ງ',
              action: SwButton(
                label: 'ເພີ່ມທີ່ຢູ່',
                icon: Icons.add,
                isFullWidth: false,
                onPressed: () => showAddAddressSheet(context, ref),
              ),
            );
          }

          final pickup = _resolve(_pickup, addresses);
          final dropoff = _resolve(_dropoff, addresses);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: SwColors.dangerLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(_error!,
                        style: const TextStyle(color: SwColors.danger)),
                  ),
                const Text('ທີ່ຢູ່ຮັບ', style: SwTypography.label),
                const SizedBox(height: 8),
                _AddressSelector(
                  icon: Icons.location_on_outlined,
                  address: pickup,
                  placeholder: 'ເລືອກທີ່ຢູ່ທີ່ຕ້ອງໄປຮັບ',
                  onTap: () => _pick(isPickup: true),
                ),
                const SizedBox(height: 16),
                const Text('ທີ່ຢູ່ສົ່ງ', style: SwTypography.label),
                const SizedBox(height: 8),
                _AddressSelector(
                  icon: Icons.home_outlined,
                  address: dropoff,
                  placeholder: 'ເລືອກທີ່ຢູ່ທີ່ຕ້ອງໄປສົ່ງ',
                  onTap: () => _pick(isPickup: false),
                ),
                const SizedBox(height: 28),
                SwButton(
                  label: 'ສ້າງຄໍາສັ່ງ',
                  onPressed: () => _submit(addresses),
                  isLoading: _isLoading,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// A tappable field that shows the currently selected address (or a
/// placeholder) and opens the saved-address picker on tap.
class _AddressSelector extends StatelessWidget {
  const _AddressSelector({
    required this.icon,
    required this.address,
    required this.placeholder,
    required this.onTap,
  });

  final IconData icon;
  final Address? address;
  final String placeholder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final selected = address;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: SwColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: SwColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, color: SwColors.textMuted),
            const SizedBox(width: 12),
            Expanded(
              child: selected == null
                  ? Text(placeholder,
                      style: SwTypography.body
                          .copyWith(color: SwColors.textHint))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(selected.label, style: SwTypography.label),
                        const SizedBox(height: 2),
                        Text(
                          selected.address,
                          style: SwTypography.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
            ),
            const Icon(Icons.expand_more, color: SwColors.textHint),
          ],
        ),
      ),
    );
  }
}
