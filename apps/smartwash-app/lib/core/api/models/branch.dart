class Branch {
  const Branch({
    required this.id,
    required this.name,
    this.nameLao,
    this.address,
    this.hours = '',
    this.distanceKm,
  });

  final String id;
  final String name;
  final String? nameLao;
  final String? address;
  final String hours;
  final double? distanceKm;

  factory Branch.fromJson(Map<String, dynamic> j) => Branch(
        id: j['id'] as String,
        name: j['name'] as String,
        nameLao: j['nameLao'] as String?,
        address: j['address'] as String?,
        distanceKm: (j['distanceKm'] as num?)?.toDouble(),
        hours: j['hours'] as String? ?? '',
      );
}
