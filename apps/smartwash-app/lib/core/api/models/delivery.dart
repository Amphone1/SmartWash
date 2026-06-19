class Delivery {
  const Delivery({
    required this.id,
    required this.status,
    required this.estimatedArrival,
    required this.driverName,
    required this.driverVehicle,
    required this.driverPlate,
    required this.driverRating,
    required this.distanceKm,
    this.driverLat,
    this.driverLng,
  });

  final String id;
  final String status;
  final String estimatedArrival;
  final String driverName;
  final String driverVehicle;
  final String driverPlate;
  final double driverRating;
  final double distanceKm;
  final double? driverLat;
  final double? driverLng;

  factory Delivery.fromJson(Map<String, dynamic> j) => Delivery(
        id: j['id'] as String,
        status: j['status'] as String? ?? '',
        estimatedArrival: j['estimatedArrival'] as String? ?? '',
        driverName: j['driverName'] as String? ?? '',
        driverVehicle: j['driverVehicle'] as String? ?? '',
        driverPlate: j['driverPlate'] as String? ?? '',
        driverRating: (j['driverRating'] as num?)?.toDouble() ?? 0,
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        driverLat: (j['driverLat'] as num?)?.toDouble(),
        driverLng: (j['driverLng'] as num?)?.toDouble(),
      );
}
