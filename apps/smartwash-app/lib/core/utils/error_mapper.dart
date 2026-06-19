import 'package:dio/dio.dart';

/// Maps a [DioException] or generic [Exception] to a user-readable message.
String mapError(Object? e) {
  if (e is DioException) {
    final code = e.response?.statusCode;
    if (code == null) return 'Request failed. Check your connection.';
    return switch (code) {
      401 => 'Session expired. Please log in again.',
      403 => 'You do not have permission for this action.',
      404 => 'The requested item was not found.',
      409 => 'Action already in progress.',
      429 => 'Too many requests. Please wait a moment.',
      >= 500 => 'Server error. Please try again.',
      _ => 'Request failed. Check your connection.',
    };
  }
  if (e is Exception) {
    final msg = e.toString().replaceFirst('Exception: ', '');
    return msg.isNotEmpty ? msg : 'Something went wrong.';
  }
  return 'Something went wrong.';
}
