class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    this.route,
    this.createdAt,
  });

  final String id;
  final String title;
  final String message;
  final String type;
  final String? route;
  final DateTime? createdAt;
}
