import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/config/app_config.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';
import '../../../providers/auth_provider.dart';

/// Driver live map — posts location updates every 30s, same as the RN driver-app.
/// Shows a placeholder until google_maps_flutter is fully configured with an API key.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  Position? _currentPosition;
  Timer? _locationTimer;
  String? _locationError;
  GoogleMapController? _mapController;

  @override
  void initState() {
    super.initState();
    _startLocationUpdates();
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _startLocationUpdates() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      final granted = await Geolocator.requestPermission();
      if (granted == LocationPermission.denied ||
          granted == LocationPermission.deniedForever) {
        setState(() => _locationError = 'ການເຂົ້າໃຊ້ສະຖານທີ່ຖືກປະຕິເສດ');
        return;
      }
    }

    await _updateLocation();
    _locationTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _updateLocation(),
    );
  }

  Future<void> _updateLocation() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      setState(() => _currentPosition = pos);
      _mapController?.animateCamera(
        CameraUpdate.newLatLng(LatLng(pos.latitude, pos.longitude)),
      );
      await ref
          .read(apiClientProvider)
          .updateLocation(pos.latitude, pos.longitude);
    } catch (e) {
      setState(() => _locationError = mapError(e));
    }
  }

  Widget _buildMap() {
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

    final initialPos = _currentPosition != null
        ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
        : const LatLng(17.9757, 102.6331); // Vientiane default

    return GoogleMap(
      initialCameraPosition: CameraPosition(target: initialPos, zoom: 15),
      myLocationEnabled: true,
      myLocationButtonEnabled: true,
      onMapCreated: (ctrl) => _mapController = ctrl,
      markers: _currentPosition != null
          ? {
              Marker(
                markerId: const MarkerId('driver'),
                position: LatLng(
                  _currentPosition!.latitude,
                  _currentPosition!.longitude,
                ),
                icon: BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueBlue,
                ),
              ),
            }
          : const {},
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ແຜນທີ່')),
      body: _locationError != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.location_off, size: 48, color: SwColors.textMuted),
                    const SizedBox(height: 16),
                    Text(_locationError!, style: SwTypography.body, textAlign: TextAlign.center),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                _buildMap(),

                // Location coordinate overlay
                if (_currentPosition != null)
                  Positioned(
                    top: 16,
                    left: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: SwColors.cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: SwColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.my_location,
                              color: SwColors.primary, size: 16),
                          const SizedBox(width: 8),
                          Text(
                            '${_currentPosition!.latitude.toStringAsFixed(5)}, '
                            '${_currentPosition!.longitude.toStringAsFixed(5)}',
                            style: SwTypography.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
