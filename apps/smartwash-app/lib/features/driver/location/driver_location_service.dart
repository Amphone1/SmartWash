import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/error_mapper.dart';
import '../../../providers/auth_provider.dart';

/// Live status of foreground driver-location reporting.
enum DriverLocationStatus { idle, acquiring, active, denied, error }

class DriverLocationState {
  const DriverLocationState({
    this.status = DriverLocationStatus.idle,
    this.position,
    this.message,
  });

  final DriverLocationStatus status;
  final Position? position;
  final String? message;

  DriverLocationState copyWith({
    DriverLocationStatus? status,
    Position? position,
    String? message,
    bool clearMessage = false,
  }) =>
      DriverLocationState(
        status: status ?? this.status,
        position: position ?? this.position,
        message: clearMessage ? null : (message ?? this.message),
      );
}

/// Foreground GPS reporter shared across every driver tab.
///
/// Owned/driven by [DriverShell] (start on enter, stop on leave) so the
/// driver's real device location is posted to the BFF
/// (`POST /bff/driver/location`) on a fixed interval while *any* driver screen
/// is open — not only the map tab, matching the legacy RN driver app which
/// also tracked from the tasks screen.
///
/// Foreground-only: the timer is cancelled when the driver shell is disposed
/// (tab tree torn down on logout / role switch). No background-location
/// platform plumbing is added.
class DriverLocationService extends StateNotifier<DriverLocationState> {
  DriverLocationService(this._api) : super(const DriverLocationState());

  final ApiClient _api;
  Timer? _timer;

  /// Same cadence as the legacy app and the previous map-screen timer.
  static const _interval = Duration(seconds: 30);

  /// Idempotent: calling again while already running is a no-op, so it is safe
  /// to invoke from [DriverShell.initState] on every (re)mount.
  Future<void> start() async {
    if (_timer != null) return;

    state = state.copyWith(
      status: DriverLocationStatus.acquiring,
      clearMessage: true,
    );

    if (!await Geolocator.isLocationServiceEnabled()) {
      _set(DriverLocationStatus.error, 'ກະລຸນາເປີດໃຊ້ບໍລິການສະຖານທີ່ (GPS)');
      return;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      _set(DriverLocationStatus.denied, 'ການເຂົ້າໃຊ້ສະຖານທີ່ຖືກປະຕິເສດ');
      return;
    }

    await _report();
    _timer = Timer.periodic(_interval, (_) => _report());
  }

  /// Stops reporting; keeps the last known position for display.
  void stop() {
    _timer?.cancel();
    _timer = null;
    if (mounted) state = state.copyWith(status: DriverLocationStatus.idle);
  }

  Future<void> _report() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      state = state.copyWith(
        status: DriverLocationStatus.active,
        position: pos,
        clearMessage: true,
      );
      await _api.updateLocation(pos.latitude, pos.longitude);
    } catch (e) {
      // Transient failure (e.g. a single fix timeout): surface a soft error but
      // keep the timer and last position so the next tick can self-heal.
      if (mounted) _set(DriverLocationStatus.error, mapError(e));
    }
  }

  void _set(DriverLocationStatus status, String message) {
    if (mounted) state = state.copyWith(status: status, message: message);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final driverLocationProvider =
    StateNotifierProvider<DriverLocationService, DriverLocationState>((ref) {
  return DriverLocationService(ref.read(apiClientProvider));
});
