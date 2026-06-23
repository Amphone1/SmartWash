import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../design_system/sw_colors.dart';
import '../../../design_system/sw_typography.dart';

/// QR scanner — accepts either a plain UUID machine ID or a JSON payload
/// `{"machineId":"...","branchId":"..."}`. On successful scan, navigates to
/// the scan-result screen which fetches machine info and continues the wizard.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _hasScanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasScanned) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null || raw.isEmpty) return;

    setState(() => _hasScanned = true);

    // Support two QR formats:
    //   1. Plain UUID  →  machineId
    //   2. JSON        →  {"machineId":"…","branchId":"…","code":"…","type":"…","capacityKg":8,"priceKip":15000}
    String? machineId;
    String? branchId;
    String? code;
    String? type;
    int? capacityKg;
    int? priceKip;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      machineId = json['machineId'] as String?;
      branchId = json['branchId'] as String?;
      code = json['code'] as String?;
      type = json['type'] as String?;
      capacityKg = (json['capacityKg'] as num?)?.toInt();
      priceKip = (json['priceKip'] as num?)?.toInt();
    } catch (_) {
      // Plain UUID string
      machineId = raw;
    }

    if (machineId == null) {
      // Unrecognised QR — let the user retry
      setState(() => _hasScanned = false);
      return;
    }

    context.push(
      '/customer/order/scan-result',
      extra: {
        'machineId': machineId,
        if (branchId != null) 'branchId': branchId,
        if (code != null) 'machineCode': code,
        if (type != null) 'machineType': type,
        if (capacityKg != null) 'capacityKg': capacityKg,
        if (priceKip != null) 'priceKip': priceKip,
      },
    );

    // Reset after navigation so camera is ready if user comes back
    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) setState(() => _hasScanned = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('ສະແກນ QR', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on, color: Colors.white),
            onPressed: _controller.toggleTorch,
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Corner-bracket scanning frame
          const Center(
            child: _ScanFrame(size: 260),
          ),

          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(
                  'ວາງ QR code ຂອງເຄື່ອງໄວ້ໃນກອບ',
                  style: SwTypography.body.copyWith(color: Colors.white),
                  textAlign: TextAlign.center,
                ),
                if (_hasScanned) ...[
                  const SizedBox(height: 12),
                  const CircularProgressIndicator(color: Colors.white),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScanFrame extends StatelessWidget {
  const _ScanFrame({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    const cornerLen = 28.0;
    const cornerWidth = 3.5;
    const color = SwColors.primary;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          // Dimmed overlay around the scan area is handled by MobileScanner overlay.
          // Draw four corner brackets only.
          for (final (top, left) in [
            (true, true),
            (true, false),
            (false, true),
            (false, false),
          ])
            Positioned(
              top: top ? 0 : null,
              bottom: top ? null : 0,
              left: left ? 0 : null,
              right: left ? null : 0,
              child: _Corner(
                top: top,
                left: left,
                len: cornerLen,
                width: cornerWidth,
                color: color,
              ),
            ),
        ],
      ),
    );
  }
}

class _Corner extends StatelessWidget {
  const _Corner({
    required this.top,
    required this.left,
    required this.len,
    required this.width,
    required this.color,
  });
  final bool top;
  final bool left;
  final double len;
  final double width;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: len,
      height: len,
      child: CustomPaint(
        painter: _CornerPainter(top: top, left: left, width: width, color: color),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  const _CornerPainter({
    required this.top,
    required this.left,
    required this.width,
    required this.color,
  });
  final bool top;
  final bool left;
  final double width;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final l = size.width;
    final corner = Offset(left ? 0 : l, top ? 0 : l);
    final hEnd = Offset(left ? l : 0, top ? 0 : l);
    final vEnd = Offset(left ? 0 : l, top ? l : 0);

    canvas.drawLine(corner, hEnd, paint);
    canvas.drawLine(corner, vEnd, paint);
  }

  @override
  bool shouldRepaint(_CornerPainter old) => false;
}
