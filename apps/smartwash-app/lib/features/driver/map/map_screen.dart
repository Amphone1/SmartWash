import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/config/app_config.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../location/driver_location_service.dart';

/// Driver live map. GPS reporting itself is owned by [DriverShell] via
/// [driverLocationProvider] (runs across all driver tabs); this screen only
/// *displays* the shared live position and a clear GPS status indicator.
///
/// The map tile needs a Google Maps API key; without one it shows a
/// placeholder, but the GPS status chip still confirms real reporting is live.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  GoogleMapController? _mapController;

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }

  void _follow(Position pos) {
    _mapController?.animateCamera(
      CameraUpdate.newLatLng(LatLng(pos.latitude, pos.longitude)),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Keep the camera on the latest real fix as it streams in.
    ref.listen<DriverLocationState>(driverLocationProvider, (prev, next) {
      final pos = next.position;
      if (pos != null && pos != prev?.position) _follow(pos);
    });

    final state = ref.watch(driverLocationProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('ແຜນທີ່')),
      body: Stack(
        children: [
          _buildMap(state.position),
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: _GpsStatusChip(
              state: state,
              onRetry: () =>
                  ref.read(driverLocationProvider.notifier).start(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMap(Position? position) {
    final hasKey = AppConfig.instance.googleMapsApiKey.isNotEmpty;
    if (!hasKey) {
      return Container(
        color: SwColors.border,
        child: const Center(
          child: Text(
            'Google Maps\n(Configure GOOGLE_MAPS_KEY)',
            textAlign: TextAlign.center,
            style: TextStyle(color: SwColors.textMuted),
          ),
        ),
      );
    }

    final initialPos = position != null
        ? LatLng(position.latitude, position.longitude)
        : const LatLng(17.9757, 102.6331); // Vientiane: map default only

    return GoogleMap(
      initialCameraPosition: CameraPosition(target: initialPos, zoom: 15),
      myLocationEnabled: true,
      myLocationButtonEnabled: true,
      onMapCreated: (ctrl) {
        _mapController = ctrl;
        if (position != null) _follow(position);
      },
      markers: position != null
          ? {
              Marker(
                markerId: const MarkerId('driver'),
                position: LatLng(position.latitude, position.longitude),
                icon: BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueBlue,
                ),
              ),
            }
          : const {},
    );
  }
}

/// Compact, always-visible indicator so the driver knows GPS is genuinely live
/// (or why it isn't) — works with or without a configured map tile.
class _GpsStatusChip extends StatelessWidget {
  const _GpsStatusChip({required this.state, required this.onRetry});

  final DriverLocationState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = switch (state.status) {
      DriverLocationStatus.active => (
          Icons.gps_fixed,
          SwColors.success,
          'GPS ເປີດໃຊ້ງານ',
        ),
      DriverLocationStatus.acquiring => (
          Icons.gps_not_fixed,
          SwColors.textMuted,
          'ກຳລັງຫາສັນຍານ GPS...',
        ),
      DriverLocationStatus.denied => (
          Icons.location_off,
          SwColors.danger,
          state.message ?? 'ການເຂົ້າໃຊ້ສະຖານທີ່ຖືກປະຕິເສດ',
        ),
      DriverLocationStatus.error => (
          Icons.gps_off,
          SwColors.warning,
          state.message ?? 'GPS ມີບັນຫາ',
        ),
      DriverLocationStatus.idle => (
          Icons.gps_off,
          SwColors.textMuted,
          'GPS ປິດຢູ່',
        ),
    };

    final pos = state.position;
    final retriable = state.status == DriverLocationStatus.denied ||
        state.status == DriverLocationStatus.error;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: SwColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SwColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: SwTypography.bodySmall.copyWith(color: color)),
                if (pos != null &&
                    state.status == DriverLocationStatus.active)
                  Text(
                    '${pos.latitude.toStringAsFixed(5)}, '
                    '${pos.longitude.toStringAsFixed(5)}',
                    style: SwTypography.caption,
                  ),
              ],
            ),
          ),
          if (retriable)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('ລອງໃໝ່'),
            ),
        ],
      ),
    );
  }
}
