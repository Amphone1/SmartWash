class EarningsData {
  const EarningsData({
    required this.todayKip,
    required this.weekKip,
    required this.monthKip,
    required this.tripsToday,
  });

  final int todayKip;
  final int weekKip;
  final int monthKip;
  final int tripsToday;

  factory EarningsData.fromJson(Map<String, dynamic> j) => EarningsData(
        todayKip: (j['todayKip'] as num?)?.toInt() ?? 0,
        weekKip: (j['weekKip'] as num?)?.toInt() ?? 0,
        monthKip: (j['monthKip'] as num?)?.toInt() ?? 0,
        tripsToday: (j['tripsToday'] as num?)?.toInt() ?? 0,
      );
}
