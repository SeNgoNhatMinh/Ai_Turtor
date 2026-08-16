class CoverageGap {
  const CoverageGap({
    required this.id,
    required this.courseId,
    required this.chapter,
    this.trainingGoldCount = 0,
    this.evaluationGoldCount = 0,
    this.severity = '',
    this.status = '',
    this.reasons = const [],
    this.materialHealth = '',
    this.chunkCount = 0,
    this.approxChars = 0,
  });

  final String id;
  final String courseId;
  final String chapter;
  final int trainingGoldCount;
  final int evaluationGoldCount;
  final String severity;
  final String status;
  final List<String> reasons;
  final String materialHealth;
  final int chunkCount;
  final int approxChars;

  factory CoverageGap.fromJson(Map<String, dynamic> json) {
    return CoverageGap(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapter: json['chapter']?.toString() ?? '',
      trainingGoldCount: (json['trainingGoldCount'] as num?)?.toInt() ?? 0,
      evaluationGoldCount: (json['evaluationGoldCount'] as num?)?.toInt() ?? 0,
      severity: json['severity']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      reasons: (json['reasons'] as List?)?.map((e) => e.toString()).toList() ?? [],
      materialHealth: json['materialHealth']?.toString() ?? '',
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      approxChars: (json['approxChars'] as num?)?.toInt() ?? 0,
    );
  }
}

class ChapterOutlineView {
  const ChapterOutlineView({
    required this.id,
    required this.courseId,
    required this.chapterKey,
    required this.title,
    this.status = '',
    this.detectedFrom = '',
    this.sourceMaterialIds = const [],
    this.chunkCount = 0,
    this.approxChars = 0,
    this.materialHealth = '',
    this.trainingGoldCount = 0,
    this.evaluationGoldCount = 0,
    this.tocLevel = 0,
    this.pageStart = 0,
    this.pageEnd = 0,
  });

  final String id;
  final String courseId;
  final String chapterKey;
  final String title;
  final String status;
  final String detectedFrom;
  final List<String> sourceMaterialIds;
  final int chunkCount;
  final int approxChars;
  final String materialHealth;
  final int trainingGoldCount;
  final int evaluationGoldCount;
  final int tocLevel;
  final int pageStart;
  final int pageEnd;

  bool get isConfirmed => status.toUpperCase() == 'CONFIRMED';

  factory ChapterOutlineView.fromJson(Map<String, dynamic> json) {
    return ChapterOutlineView(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapterKey: json['chapterKey']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      detectedFrom: json['detectedFrom']?.toString() ?? '',
      sourceMaterialIds: (json['sourceMaterialIds'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      approxChars: (json['approxChars'] as num?)?.toInt() ?? 0,
      materialHealth: json['materialHealth']?.toString() ?? '',
      trainingGoldCount: (json['trainingGoldCount'] as num?)?.toInt() ?? 0,
      evaluationGoldCount: (json['evaluationGoldCount'] as num?)?.toInt() ?? 0,
      tocLevel: (json['tocLevel'] as num?)?.toInt() ?? 0,
      pageStart: (json['pageStart'] as num?)?.toInt() ?? 0,
      pageEnd: (json['pageEnd'] as num?)?.toInt() ?? 0,
    );
  }
}

class ChapterPreviewView {
  const ChapterPreviewView({
    required this.courseId,
    required this.chapterKey,
    required this.title,
    this.status = '',
    this.detectedFrom = '',
    this.materialHealth = '',
    this.chunkCount = 0,
    this.approxChars = 0,
    this.excerpt = '',
    this.excerptTruncated = false,
    this.excerptTotalChars = 0,
    this.sourceMaterials = const [],
    this.hasMaterialContent = false,
  });

  final String courseId;
  final String chapterKey;
  final String title;
  final String status;
  final String detectedFrom;
  final String materialHealth;
  final int chunkCount;
  final int approxChars;
  final String excerpt;
  final bool excerptTruncated;
  final int excerptTotalChars;
  final List<ChapterSourceMaterialView> sourceMaterials;
  final bool hasMaterialContent;

  bool get fromIndexedMaterial {
    final source = detectedFrom.toUpperCase();
    return source == 'MATERIAL_TITLE' || source == 'PDF_BOOKMARK';
  }

  factory ChapterPreviewView.fromJson(Map<String, dynamic> json) {
    return ChapterPreviewView(
      courseId: json['courseId']?.toString() ?? '',
      chapterKey: json['chapterKey']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      detectedFrom: json['detectedFrom']?.toString() ?? '',
      materialHealth: json['materialHealth']?.toString() ?? '',
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      approxChars: (json['approxChars'] as num?)?.toInt() ?? 0,
      excerpt: json['excerpt']?.toString() ?? '',
      excerptTruncated: json['excerptTruncated'] == true,
      excerptTotalChars: (json['excerptTotalChars'] as num?)?.toInt() ?? 0,
      sourceMaterials: (json['sourceMaterials'] as List?)
              ?.map((e) => ChapterSourceMaterialView.fromJson(
                    Map<String, dynamic>.from(e as Map),
                  ))
              .toList() ??
          const [],
      hasMaterialContent: json['hasMaterialContent'] == true,
    );
  }
}

class ChapterSourceMaterialView {
  const ChapterSourceMaterialView({
    required this.id,
    required this.title,
    this.sourceType = '',
    this.indexingStatus = '',
  });

  final String id;
  final String title;
  final String sourceType;
  final String indexingStatus;

  factory ChapterSourceMaterialView.fromJson(Map<String, dynamic> json) {
    return ChapterSourceMaterialView(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      sourceType: json['sourceType']?.toString() ?? '',
      indexingStatus: json['indexingStatus']?.toString() ?? '',
    );
  }
}

class ExpertTask {
  const ExpertTask({
    required this.id,
    required this.courseId,
    required this.chapter,
    required this.type,
    required this.status,
    this.title = '',
    this.instructions = '',
    this.assigneeId = '',
    this.priority = 0,
    this.createdAt,
  });

  final String id;
  final String courseId;
  final String chapter;
  final String type;
  final String status;
  final String title;
  final String instructions;
  final String assigneeId;
  final int priority;
  final DateTime? createdAt;

  static const _closedStatuses = {'COMPLETED', 'CANCELLED'};
  static const _activeStatuses = {
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'SUBMITTED',
  };

  bool get isClosed => _closedStatuses.contains(status.toUpperCase());

  bool get isActive => _activeStatuses.contains(status.toUpperCase());

  bool get canClaim =>
      status.toUpperCase() == 'OPEN' && assigneeId.trim().isEmpty;

  bool get isSubmitted => status.toUpperCase() == 'SUBMITTED';

  bool isAssignedTo(String userId) =>
      assigneeId.isNotEmpty && assigneeId == userId;

  bool canContribute(String userId) =>
      isActive &&
      !isSubmitted &&
      isAssignedTo(userId) &&
      status.toUpperCase() != 'OPEN';

  bool canOpenContribute(String userId) => canContribute(userId);

  /// Coverage gap tạo 2 task mẫu: training (index RAG) và holdout (evaluation).
  String? get expectedUsage {
    if (type.toUpperCase() != 'GOLD_QA') return null;
    final haystack = '${title.toLowerCase()} ${instructions.toLowerCase()}';
    if (haystack.contains('holdout') || haystack.contains('evaluation')) {
      return 'EVALUATION';
    }
    if (haystack.contains('training')) return 'TRAINING';
    return null;
  }

  String get usageLabel {
    switch (expectedUsage) {
      case 'TRAINING':
        return 'TRAINING • index RAG sau duyệt';
      case 'EVALUATION':
        return 'EVALUATION • holdout, không index RAG';
      default:
        return type;
    }
  }

  factory ExpertTask.fromJson(Map<String, dynamic> json) {
    return ExpertTask(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapter: json['chapter']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      instructions: json['instructions']?.toString() ?? '',
      assigneeId: json['assigneeId']?.toString() ?? '',
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }
}

int compareExpertTasks(ExpertTask a, ExpertTask b) {
  final priority = b.priority.compareTo(a.priority);
  if (priority != 0) return priority;
  final aTime = a.createdAt?.millisecondsSinceEpoch ?? 0;
  final bTime = b.createdAt?.millisecondsSinceEpoch ?? 0;
  return bTime.compareTo(aTime);
}

class GoldQaItem {
  const GoldQaItem({
    required this.id,
    required this.courseId,
    required this.chapter,
    required this.question,
    required this.goldAnswer,
    required this.usage,
    required this.status,
    this.difficulty = '',
    this.holdout = false,
  });

  final String id;
  final String courseId;
  final String chapter;
  final String question;
  final String goldAnswer;
  final String usage;
  final String status;
  final String difficulty;
  final bool holdout;

  factory GoldQaItem.fromJson(Map<String, dynamic> json) {
    return GoldQaItem(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapter: json['chapter']?.toString() ?? '',
      question: json['question']?.toString() ?? '',
      goldAnswer: json['goldAnswer']?.toString() ?? '',
      usage: json['usage']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      difficulty: json['difficulty']?.toString() ?? '',
      holdout: json['holdout'] == true,
    );
  }
}

class ExpertRubricItem {
  const ExpertRubricItem({
    required this.id,
    required this.courseId,
    required this.chapter,
    required this.name,
    required this.status,
    this.description = '',
    this.criteriaWeights = const {},
  });

  final String id;
  final String courseId;
  final String chapter;
  final String name;
  final String status;
  final String description;
  final Map<String, double> criteriaWeights;

  factory ExpertRubricItem.fromJson(Map<String, dynamic> json) {
    final weights = <String, double>{};
    final raw = json['criteriaWeights'];
    if (raw is Map) {
      raw.forEach((k, v) {
        if (v is num) weights[k.toString()] = v.toDouble();
      });
    }
    return ExpertRubricItem(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapter: json['chapter']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      criteriaWeights: weights,
    );
  }
}

class EvalRunItem {
  const EvalRunItem({
    required this.id,
    required this.courseId,
    required this.chapter,
    required this.status,
    this.totalCases = 0,
    this.passedCases = 0,
    this.averageScore = 0,
    this.hallucinationRate = 0,
    this.regressionDetected = false,
  });

  final String id;
  final String courseId;
  final String chapter;
  final String status;
  final int totalCases;
  final int passedCases;
  final double averageScore;
  final double hallucinationRate;
  final bool regressionDetected;

  factory EvalRunItem.fromJson(Map<String, dynamic> json) {
    return EvalRunItem(
      id: json['id']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      chapter: json['chapter']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      totalCases: (json['totalCases'] as num?)?.toInt() ?? 0,
      passedCases: (json['passedCases'] as num?)?.toInt() ?? 0,
      averageScore: (json['averageScore'] as num?)?.toDouble() ?? 0,
      hallucinationRate: (json['hallucinationRate'] as num?)?.toDouble() ?? 0,
      regressionDetected: json['regressionDetected'] == true,
    );
  }
}
