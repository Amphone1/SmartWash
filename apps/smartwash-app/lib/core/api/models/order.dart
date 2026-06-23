class Order {
  const Order({
    required this.id,
    required this.status,
    required this.serviceType,
    required this.createdAt,
    this.updatedAt,
    this.weightKg,
    this.branchId,
    this.branchName,
    this.machineId,
    this.machineCode,
    this.machineType,
    this.cycle,
    this.pricePaid,
    this.estimatedMinutes,
    this.progressPct,
    this.driverName,
    this.driverRating,
    this.deliveryId,
    this.rated = false,
  });

  final String id;
  final String status;
  final String serviceType;
  final String createdAt;
  final String? updatedAt;
  final double? weightKg;
  final String? branchId;
  final String? branchName;
  final String? machineId;
  final String? machineCode;
  final String? machineType;
  final String? cycle;
  final int? pricePaid;
  final int? estimatedMinutes;
  final int? progressPct;
  final String? driverName;
  final double? driverRating;
  final String? deliveryId;
  final bool rated;

  bool get isActive =>
      {'RESERVED', 'PAYMENT_PENDING', 'AWAITING_APPROVAL', 'PAID', 'RUNNING'}
          .contains(status);

  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => {'CANCELLED', 'EXPIRED', 'REJECTED'}.contains(status);
  bool get canRate => isCompleted && !rated;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as String,
        status: (j['status'] ?? j['state'] ?? 'PENDING') as String,
        serviceType: (j['serviceType'] ?? j['type'] ?? '') as String,
        createdAt: j['createdAt'] as String,
        updatedAt: j['updatedAt'] as String?,
        weightKg: (j['weightKg'] as num?)?.toDouble(),
        branchId: j['branchId'] as String?,
        branchName: (j['branchName'] ?? j['branchId']) as String?,
        machineId: j['machineId'] as String?,
        machineCode: j['machineCode'] as String?,
        machineType: j['machineType'] as String?,
        cycle: j['cycle'] as String?,
        pricePaid: ((j['pricePaid'] ?? j['total']) as num?)?.toInt(),
        estimatedMinutes: (j['estimatedMinutes'] as num?)?.toInt(),
        progressPct: (j['progressPct'] as num?)?.toInt(),
        driverName: j['driverName'] as String?,
        driverRating: (j['driverRating'] as num?)?.toDouble(),
        deliveryId: j['deliveryId'] as String?,
        rated: j['rated'] as bool? ?? false,
      );
}
