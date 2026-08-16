class RealtimeEvent {
  const RealtimeEvent({
    required this.type,
    this.entityType,
    this.entityId,
    this.status,
    this.timestamp,
    this.data = const {},
  });

  final String type;
  final String? entityType;
  final String? entityId;
  final String? status;
  final String? timestamp;
  final Map<String, dynamic> data;

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    final rawData = json['data'];
    return RealtimeEvent(
      type: json['type']?.toString() ?? '',
      entityType: json['entityType']?.toString(),
      entityId: json['entityId']?.toString(),
      status: json['status']?.toString(),
      timestamp: json['timestamp']?.toString(),
      data: rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : const {},
    );
  }
}
