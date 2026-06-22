/// A customer's saved delivery address (pickup/dropoff).
///
/// Mirrors the BFF `/bff/addresses` payload, which proxies the delivery
/// service. The backend supports list/create/delete only — there is no
/// update endpoint, so this model is treated as immutable.
class Address {
  const Address({
    required this.id,
    required this.label,
    required this.address,
    required this.lat,
    required this.lng,
    required this.isDefault,
  });

  final String id;
  final String label;
  final String address;
  final double lat;
  final double lng;
  final bool isDefault;

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'] as String,
        label: j['label'] as String? ?? '',
        address: j['address'] as String? ?? '',
        lat: (j['lat'] as num?)?.toDouble() ?? 0,
        lng: (j['lng'] as num?)?.toDouble() ?? 0,
        isDefault: j['isDefault'] as bool? ?? false,
      );
}
