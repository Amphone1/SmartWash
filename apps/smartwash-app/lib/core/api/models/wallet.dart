class WalletBalance {
  const WalletBalance({required this.balanceKip});
  final int balanceKip;

  factory WalletBalance.fromJson(Map<String, dynamic> j) => WalletBalance(
        balanceKip: ((j['balanceKip'] ?? j['balance']) as num?)?.toInt() ?? 0,
      );
}

class QrPayment {
  const QrPayment({
    required this.qrRef,
    required this.expiresAt,
    required this.qrImageUrl,
  });

  final String qrRef;
  final String expiresAt;
  final String qrImageUrl;

  factory QrPayment.fromJson(Map<String, dynamic> j) => QrPayment(
        qrRef: j['qrRef'] as String,
        expiresAt: j['expiresAt'] as String,
        qrImageUrl: j['qrImageUrl'] as String,
      );
}
