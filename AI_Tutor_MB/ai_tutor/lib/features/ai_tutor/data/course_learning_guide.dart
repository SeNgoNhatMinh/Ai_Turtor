import '../../../core/utils/json_helpers.dart';

class CourseLearningGuideTopic {
  const CourseLearningGuideTopic({required this.title, this.detail = ''});

  final String title;
  final String detail;

  factory CourseLearningGuideTopic.fromJson(Map<String, dynamic> json) {
    return CourseLearningGuideTopic(
      title: readString(json, 'title', fallback: readString(json, 'name')),
      detail: readString(
        json,
        'detail',
        fallback: readString(json, 'description'),
      ),
    );
  }
}

class CourseLearningGuide {
  const CourseLearningGuide({
    required this.courseId,
    required this.courseName,
    required this.welcomeMarkdown,
    this.overview = '',
    this.status = '',
    this.source = '',
    this.knowledgeObjectives = const [],
    this.skillObjectives = const [],
    this.topics = const [],
    this.keywords = const [],
  });

  final String courseId;
  final String courseName;
  final String welcomeMarkdown;
  final String overview;
  final String status;
  final String source;
  final List<String> knowledgeObjectives;
  final List<String> skillObjectives;
  final List<CourseLearningGuideTopic> topics;
  final List<String> keywords;

  List<String> get topicTitles => [
    for (final topic in topics)
      if (topic.title.trim().isNotEmpty) topic.title.trim(),
  ];

  factory CourseLearningGuide.fromJson(Map<String, dynamic> json) {
    final rawTopics = unwrapList(json['topics']);
    final topics = <CourseLearningGuideTopic>[];
    for (final item in rawTopics) {
      if (item is Map) {
        final topic = CourseLearningGuideTopic.fromJson(
          Map<String, dynamic>.from(item),
        );
        if (topic.title.isNotEmpty) topics.add(topic);
      } else {
        final title = item?.toString().trim() ?? '';
        if (title.isNotEmpty) {
          topics.add(CourseLearningGuideTopic(title: title));
        }
      }
    }

    return CourseLearningGuide(
      courseId: readString(json, 'courseId'),
      courseName: readString(json, 'courseName'),
      welcomeMarkdown: readString(json, 'welcomeMarkdown'),
      overview: readString(json, 'overview'),
      status: readString(json, 'status'),
      source: readString(json, 'source'),
      knowledgeObjectives: parseStringList(json['knowledgeObjectives']),
      skillObjectives: parseStringList(json['skillObjectives']),
      topics: topics,
      keywords: parseStringList(json['keywords']),
    );
  }
}
