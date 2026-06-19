class DriverTask {
  const DriverTask({
    required this.id,
    required this.type,
    required this.status,
    required this.customerName,
    required this.customerPhone,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.feeKip,
    required this.distanceKm,
    required this.orderId,
    this.notes,
    this.items = const [],
  });

  final String id;
  final String type; // PICKUP | DELIVERY
  final String status;
  final String customerName;
  final String customerPhone;
  final String pickupAddress;
  final String dropoffAddress;
  final int feeKip;
  final double distanceKm;
  final String orderId;
  final String? notes;
  final List<TaskItem> items;

  bool get isNew =>
      {'CREATED', 'ASSIGNED'}.contains(status);

  factory DriverTask.fromJson(Map<String, dynamic> j) => DriverTask(
        id: j['id'] as String,
        type: j['type'] as String? ?? 'DELIVERY',
        status: j['status'] as String? ?? '',
        customerName: j['customerName'] as String? ?? '',
        customerPhone: j['customerPhone'] as String? ?? '',
        pickupAddress: j['pickupAddress'] as String? ?? '',
        dropoffAddress: j['dropoffAddress'] as String? ?? '',
        feeKip: (j['feeKip'] as num?)?.toInt() ?? 0,
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        orderId: j['orderId'] as String? ?? '',
        notes: j['notes'] as String?,
        items: ((j['items'] as List?)?.cast<Map<String, dynamic>>())
                ?.map(TaskItem.fromJson)
                .toList() ??
            [],
      );
}

class TaskItem {
  const TaskItem({required this.name, required this.qty});
  final String name;
  final int qty;

  factory TaskItem.fromJson(Map<String, dynamic> j) =>
      TaskItem(name: j['name'] as String, qty: (j['qty'] as num).toInt());
}
