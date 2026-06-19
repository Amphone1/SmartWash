import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import 'dart:io';
import '../config/app_config.dart';
import '../auth/auth_service.dart';
import '../auth/token_store.dart';
import 'models/branch.dart';
import 'models/delivery.dart';
import 'models/driver_task.dart';
import 'models/earnings.dart';
import 'models/machine.dart';
import 'models/app_notification.dart';
import 'models/order.dart';
import 'models/wallet.dart';

const _uuid = Uuid();

/// Central HTTP client for all BFF calls.
///
/// Token is injected via [setToken] when auth state changes (login / restore).
/// An interceptor automatically adds `Authorization: Bearer <token>` and
/// `Idempotency-Key` (on POST/PUT/PATCH) to every request.
/// A second interceptor automatically retries once on 401 after a token refresh.
class ApiClient {
  ApiClient(AppConfig config) {
    _dio = Dio(BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        final method = options.method.toUpperCase();
        if (method == 'POST' || method == 'PUT' || method == 'PATCH') {
          options.headers['Idempotency-Key'] = _uuid.v4();
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401 &&
            _authService != null &&
            error.requestOptions.extra['_retried'] != true) {
          final newToken = await _authService!.refresh();
          if (newToken != null) {
            setToken(newToken);
            final opts = error.requestOptions
              ..headers['Authorization'] = 'Bearer $newToken'
              ..extra['_retried'] = true;
            try {
              final response = await _dio.fetch(opts);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
            }
          }
          // Refresh failed — signal logout by clearing stored tokens.
          await _authService!.logout();
        }
        return handler.next(error);
      },
    ));
  }

  late final Dio _dio;
  String? _token;

  /// Lazily injected after construction to avoid circular dependency.
  AuthService? _authService;

  void setToken(String? token) => _token = token;

  void setAuthService(AuthService authService) => _authService = authService;

  // ─── Branches ───────────────────────────────────────────────────────────────

  Future<List<Branch>> listBranches() async {
    final res = await _dio.get<List>('/bff/branches');
    return res.data!
        .cast<Map<String, dynamic>>()
        .map(Branch.fromJson)
        .toList();
  }

  Future<List<Machine>> listMachines(String branchId) async {
    final res = await _dio.get<List>('/bff/branches/$branchId/machines');
    return res.data!
        .cast<Map<String, dynamic>>()
        .map(Machine.fromJson)
        .toList();
  }

  Future<Machine> getMachineById(String machineId) async {
    final res =
        await _dio.get<Map<String, dynamic>>('/bff/machines/$machineId');
    return Machine.fromJson(res.data!);
  }

  // ─── Orders ─────────────────────────────────────────────────────────────────

  Future<List<Order>> listOrders() async {
    final res = await _dio.get<List>('/bff/orders');
    return res.data!
        .cast<Map<String, dynamic>>()
        .map(Order.fromJson)
        .toList();
  }

  Future<Order> getOrder(String orderId) async {
    final res = await _dio.get<Map<String, dynamic>>('/bff/orders/$orderId');
    return Order.fromJson(res.data!);
  }

  Future<Order> createOrder({
    required String branchId,
    required String machineId,
    required String type,
    String? cycle,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/bff/orders',
      data: {
        'branchId': branchId,
        'machineId': machineId,
        'type': type,
        if (cycle != null) 'cycle': cycle,
      },
    );
    return Order.fromJson(res.data!);
  }

  Future<Map<String, dynamic>> joinQueue(String machineId) async {
    final res = await _dio
        .post<Map<String, dynamic>>('/bff/queues/$machineId/join');
    return res.data!;
  }

  // ─── Wallet & Payments ───────────────────────────────────────────────────────

  Future<WalletBalance> getWallet() async {
    final res = await _dio.get<Map<String, dynamic>>('/bff/wallet');
    return WalletBalance.fromJson(res.data!);
  }

  Future<QrPayment> createTopupQr(int amountKip) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/bff/payments',
      data: {'type': 'topup', 'amount': amountKip},
    );
    return QrPayment.fromJson(res.data!);
  }

  Future<String> getPaymentStatus(String qrRef) async {
    final res =
        await _dio.get<Map<String, dynamic>>('/bff/payments/$qrRef');
    return res.data!['status'] as String? ?? '';
  }

  // ─── Notifications ──────────────────────────────────────────────────────────

  Future<List<AppNotification>> listNotifications() async {
    final res = await _dio.get<List>('/bff/notifications');
    return res.data!
        .cast<Map<String, dynamic>>()
        .map(AppNotification.fromJson)
        .toList();
  }

  Future<void> markAllNotificationsRead() =>
      _dio.post<void>('/bff/notifications/read-all');

  // ─── Delivery ───────────────────────────────────────────────────────────────

  Future<Delivery> requestDelivery(
    String orderId, {
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> dropoff,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/bff/orders/$orderId/request-delivery',
      data: {'pickup': pickup, 'dropoff': dropoff},
    );
    return Delivery.fromJson(res.data!);
  }

  Future<Delivery> getDeliveryTracking(String deliveryId) async {
    final res = await _dio
        .get<Map<String, dynamic>>('/bff/deliveries/$deliveryId/track');
    return Delivery.fromJson(res.data!);
  }

  Future<void> submitRating({
    required String orderId,
    required int rating,
    required List<String> tags,
    String? comment,
  }) =>
      _dio.post<void>('/bff/ratings', data: {
        'orderId': orderId,
        'rating': rating,
        'tags': tags,
        if (comment != null) 'comment': comment,
      });

  // ─── Driver ─────────────────────────────────────────────────────────────────

  Future<List<DriverTask>> listDriverTasks() async {
    final res = await _dio.get<List>('/bff/driver/deliveries');
    return res.data!
        .cast<Map<String, dynamic>>()
        .map(DriverTask.fromJson)
        .toList();
  }

  Future<DriverTask> getDriverTask(String id) async {
    final res =
        await _dio.get<Map<String, dynamic>>('/bff/driver/deliveries/$id');
    return DriverTask.fromJson(res.data!);
  }

  Future<void> acceptTask(String id) =>
      _dio.post<void>('/bff/driver/deliveries/$id/accept');

  Future<void> rejectTask(String id) =>
      _dio.post<void>('/bff/driver/deliveries/$id/reject');

  Future<void> advanceTask(String id, String state) =>
      _dio.post<void>('/bff/driver/deliveries/$id/state', data: {'state': state});

  Future<void> updateLocation(double lat, double lon) =>
      _dio.post<void>('/bff/driver/location', data: {'lat': lat, 'lon': lon});

  Future<EarningsData> getEarnings() async {
    final res = await _dio.get<Map<String, dynamic>>('/bff/driver/earnings');
    return EarningsData.fromJson(res.data!);
  }

  // ─── Staff ──────────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listMachinesForStaff() async {
    final res = await _dio.get<List>('/bff/staff/machines');
    return res.data!.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> listStaffOrders({String? status}) async {
    final qs = status != null ? '?status=$status' : '';
    final res = await _dio.get<List>('/bff/staff/orders$qs');
    return res.data!.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> listPendingSlips() async {
    final res = await _dio.get<List>('/bff/staff/slips?status=PENDING');
    return res.data!.cast<Map<String, dynamic>>();
  }

  Future<void> approveSlip(String slipId) =>
      _dio.post<void>('/bff/staff/slips/$slipId/approve');

  Future<void> rejectSlip(String slipId, {String? reason}) =>
      _dio.post<void>('/bff/staff/slips/$slipId/reject',
          data: reason != null ? {'reason': reason} : <String, dynamic>{});

  // ─── Slip image upload ───────────────────────────────────────────────────────

  /// Uploads a payment slip image to the BFF (multipart). The BFF computes the
  /// SHA-256 and forwards to the payment service. Returns the payment status.
  Future<Map<String, dynamic>> uploadSlipImage({
    required String qrRef,
    required String filePath,
  }) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(
        filePath,
        filename: File(filePath).uri.pathSegments.last,
      ),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      '/bff/payments/$qrRef/slip-image',
      data: formData,
    );
    return res.data!;
  }
}
