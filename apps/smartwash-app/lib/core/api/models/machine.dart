enum MachineState { idle, running, reserved, offline, starting, finishing, paused, error, maintenance }

class Machine {
  const Machine({
    required this.id,
    this.branchId,
    required this.code,
    required this.type,
    required this.capacityKg,
    required this.priceKip,
    required this.state,
    this.progressPct,
    this.minutesLeft,
    this.queueCount,
    this.errorCode,
  });

  final String id;
  final String? branchId;
  final String code;
  final String type;
  final double capacityKg;
  final int priceKip;
  final MachineState state;
  final int? progressPct;
  final int? minutesLeft;
  final int? queueCount;
  final String? errorCode;

  bool get isAvailable => state == MachineState.idle;

  factory Machine.fromJson(Map<String, dynamic> j) {
    final rawState = (j['state'] as String?)?.toLowerCase() ?? 'offline';
    final state = MachineState.values.firstWhere(
      (s) => s.name == rawState,
      orElse: () => MachineState.offline,
    );
    return Machine(
      id: j['id'] as String,
      branchId: j['branchId'] as String?,
      code: j['code'] as String,
      type: j['type'] as String,
      capacityKg: (j['capacityKg'] as num?)?.toDouble() ?? 0,
      priceKip: (j['price'] as num?)?.toInt() ?? 0,
      state: state,
      progressPct: (j['progressPct'] as num?)?.toInt(),
      minutesLeft: (j['minutesLeft'] as num?)?.toInt(),
      queueCount: (j['queueCount'] as num?)?.toInt(),
      errorCode: j['errorCode'] as String?,
    );
  }
}
