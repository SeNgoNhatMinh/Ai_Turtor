package com.ragapi.service;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.ImprovePlan;
import com.ragapi.entity.ImprovePlanItem;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.entity.StudentWeakTopic;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.ImprovePlanRepository;
import com.ragapi.util.TextSanitizer;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@AllArgsConstructor
public class ImprovePlanService {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Set<String> STOP_WORDS = Set.of(
            "review", "practice", "small", "exercise", "about", "topic", "on", "for",
            "ôn", "lại", "lai", "thực", "thuc", "hành", "hanh", "chủ", "chu", "đề", "de"
    );

    private final ImprovePlanRepository improvePlanRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialChunkingService chunkingService;

    public ImprovePlan generateOrUpdatePlan(StudentCourseMemory memory, String generatedBy) {
        if (memory == null || isBlank(memory.getStudentId()) || isBlank(memory.getCourseId())) {
            throw new IllegalArgumentException("studentId and courseId are required to generate improve plan");
        }

        List<AssignmentSubmission> submissions = submissionRepository.findByStudentId(memory.getStudentId()).stream()
                .filter(item -> memory.getCourseId().equals(item.getCourseId()))
                .toList();

        Set<String> weakTopics = new LinkedHashSet<>();
        if (memory.getWeakTopics() != null) weakTopics.addAll(memory.getWeakTopics());
        submissions.stream()
                .filter(item -> item.getWeakTopics() != null)
                .flatMap(item -> item.getWeakTopics().stream())
                .forEach(weakTopics::add);

        List<String> evidence = new ArrayList<>();
        if (memory.getRecentQuestions() != null && !memory.getRecentQuestions().isEmpty()) {
            evidence.add("Recent questions: " + Math.min(memory.getRecentQuestions().size(), 20));
        }
        submissions.stream()
                .filter(item -> item.getScore() != null)
                .forEach(item -> evidence.add("Assignment score: " + item.getScore() + " for submission " + item.getId()));
        if (memory.getImproveSuggestions() != null) {
            memory.getImproveSuggestions().stream()
                    .filter(item -> item != null && !item.isBlank())
                    .forEach(item -> evidence.add("Feedback: " + item));
        }

        LocalDateTime now = LocalDateTime.now();
        List<ImprovePlanItem> planItemDetails = buildPlanItemDetails(
                weakTopics,
                memory,
                submissions,
                generatedBy,
                now
        );
        List<String> planItems = planItemDetails.stream()
                .map(item -> firstNonBlank(item.getInstruction(), item.getTitle()))
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        String riskLevel = calculateRiskLevel(weakTopics.size(), submissions);

        ImprovePlan plan = improvePlanRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(memory.getStudentId(), memory.getCourseId(), "ACTIVE")
                .orElseGet(() -> ImprovePlan.builder()
                        .id(UUID.randomUUID().toString())
                        .studentId(memory.getStudentId())
                        .courseId(memory.getCourseId())
                        .createdAt(now)
                        .status("ACTIVE")
                        .build());

        plan.setClassId(memory.getClassId());
        plan.setRiskLevel(riskLevel);
        plan.setWeakTopics(new ArrayList<>(weakTopics));
        plan.setPlanItems(planItems);
        plan.setPlanItemDetails(planItemDetails);
        plan.setEvidence(evidence);
        plan.setGeneratedBy(isBlank(generatedBy) ? "SYSTEM" : generatedBy.trim());
        plan.setGeneratedAt(now);
        plan.setUpdatedAt(now);
        return improvePlanRepository.save(plan);
    }

    public List<ImprovePlan> listPlans(String studentId, String courseId) {
        if (isBlank(studentId)) {
            throw new IllegalArgumentException("studentId is required");
        }
        if (!isBlank(courseId)) {
            return improvePlanRepository.findByStudentIdAndCourseId(studentId.trim(), courseId.trim());
        }
        return improvePlanRepository.findByStudentId(studentId.trim());
    }

    public ImprovePlan getLatestActivePlan(String studentId, String courseId) {
        if (isBlank(studentId) || isBlank(courseId)) {
            throw new IllegalArgumentException("studentId and courseId are required");
        }
        return improvePlanRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(studentId.trim(), courseId.trim(), "ACTIVE")
                .orElse(null);
    }

    public RagQueryIntent resolveReviewIntent(
            String studentId,
            String courseId,
            String improvePlanId,
            String planItemId
    ) {
        if (isBlank(improvePlanId) || isBlank(planItemId)) {
            return null;
        }
        if (isBlank(studentId)) {
            throw new IllegalArgumentException("studentId is required");
        }

        ImprovePlan plan = improvePlanRepository.findById(improvePlanId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Improve plan not found"));
        if (!studentId.trim().equals(plan.getStudentId())) {
            throw new SecurityException("Student is not allowed to access this improve plan");
        }
        if (!isBlank(courseId) && !courseId.trim().equalsIgnoreCase(plan.getCourseId())) {
            throw new SecurityException("Improve plan course does not match this chat");
        }

        ImprovePlanItem item = findPlanItem(plan, planItemId.trim());
        if (item == null) {
            throw new IllegalArgumentException("Improve plan item not found");
        }

        List<String> sourceTerms = cleanList(item.getSourceTerms());
        List<String> retrievalTerms = cleanList(merge(
                sourceTerms,
                item.getRetrievalTerms(),
                nonBlankList(item.getSourceTopic(), item.getTitle())
        ));
        String retrievalQuery = String.join(" ", retrievalTerms.stream().limit(14).toList());
        if (retrievalQuery.isBlank()) {
            retrievalQuery = firstNonBlank(item.getSourceTopic(), item.getTitle(), item.getInstruction());
        }

        log.info(
                "Improve plan review resolved (improvePlanId={}, planItemId={}, courseId={}, sourceMaterials={}, sourceChunks={}, retrievalTerms={})",
                plan.getId(),
                item.getId(),
                plan.getCourseId(),
                item.getSourceMaterialIds() == null ? 0 : item.getSourceMaterialIds().size(),
                item.getSourceChunkIds() == null ? 0 : item.getSourceChunkIds().size(),
                retrievalTerms
        );

        return RagQueryIntent.builder()
                .learningObjective(firstNonBlank(item.getInstruction(), item.getTitle()))
                .retrievalQuery(retrievalQuery)
                .retrievalTerms(retrievalTerms)
                .teachingMode("EXPLAIN_CONCEPT")
                .outputConstraints(List.of(
                        "Explain this improve-plan item step by step.",
                        "Use the linked course evidence first.",
                        "Do not introduce unrelated lessons."
                ))
                .improvePlanId(plan.getId())
                .planItemId(item.getId())
                .sourceChunkIds(cleanList(item.getSourceChunkIds()))
                .sourceMaterialIds(cleanList(item.getSourceMaterialIds()))
                .sourceTerms(sourceTerms)
                .build();
    }

    public ImprovePlan completePlan(String planId) {
        ImprovePlan plan = improvePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Improve plan not found"));
        plan.setStatus("COMPLETED");
        plan.setCompletedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        return improvePlanRepository.save(plan);
    }

    private List<ImprovePlanItem> buildPlanItemDetails(
            Set<String> weakTopics,
            StudentCourseMemory memory,
            List<AssignmentSubmission> submissions,
            String generatedBy,
            LocalDateTime now
    ) {
        List<ImprovePlanItem> items = new ArrayList<>();
        for (String rawTopic : weakTopics) {
            String topic = normalizeClean(rawTopic);
            if (topic == null) {
                continue;
            }
            TopicGrounding grounding = groundTopic(topic, memory);
            items.add(buildTopicPlanItem(topic, "review", "Ôn lại " + topic,
                    "Ôn lại " + topic + " và tự giải thích bằng ví dụ nhỏ.", grounding, generatedBy, now));
            items.add(buildTopicPlanItem(topic, "practice", "Thực hành " + topic,
                    "Làm một bài thực hành nhỏ về " + topic + " dựa trên tài liệu môn học.",
                    grounding, generatedBy, now));
        }
        boolean hasLowScore = submissions.stream()
                .anyMatch(item -> item.getScore() != null && item.getScore() < 5.0);
        if (hasLowScore) {
            items.add(legacyPlanItem("low-score-feedback", "Xem lại phản hồi bài tập điểm thấp", now, generatedBy));
            items.add(legacyPlanItem("weak-assignment-step", "Nhờ AI Tutor giải thích từng bước chủ đề yếu nhất trong bài tập", now, generatedBy));
        }
        if (items.isEmpty()) {
            items.add(legacyPlanItem("recent-material-review", "Ôn lại tài liệu môn học gần đây", now, generatedBy));
            items.add(legacyPlanItem("pre-quiz-checklist", "Nhờ AI Tutor tạo checklist ngắn trước quiz hoặc bài tập tiếp theo", now, generatedBy));
        }
        return items.stream()
                .collect(java.util.stream.Collectors.collectingAndThen(
                        java.util.stream.Collectors.toMap(
                                ImprovePlanItem::getId,
                                item -> item,
                                (first, second) -> first,
                                java.util.LinkedHashMap::new
                        ),
                        map -> new ArrayList<>(map.values())
                ));
    }

    private ImprovePlanItem buildTopicPlanItem(
            String topic,
            String action,
            String title,
            String instruction,
            TopicGrounding grounding,
            String generatedBy,
            LocalDateTime now
    ) {
        return ImprovePlanItem.builder()
                .id(stableItemId(topic, action))
                .title(title)
                .instruction(instruction)
                .sourceTopic(topic)
                .sourceTerms(grounding.sourceTerms())
                .retrievalTerms(expandRetrievalTerms(topic, grounding.sourceTerms()))
                .sourceChunkIds(grounding.sourceChunkIds())
                .sourceMaterialIds(grounding.sourceMaterialIds())
                .generatedBy(isBlank(generatedBy) ? "SYSTEM" : generatedBy.trim())
                .groundingStatus(grounding.grounded() ? "GROUNDED" : "UNGROUNDED")
                .groundingConfidence(grounding.confidence())
                .createdAt(now)
                .build();
    }

    private ImprovePlanItem legacyPlanItem(String idSuffix, String instruction, LocalDateTime now, String generatedBy) {
        return ImprovePlanItem.builder()
                .id(idSuffix)
                .title(instruction)
                .instruction(instruction)
                .retrievalTerms(cleanList(List.of(instruction)))
                .generatedBy(isBlank(generatedBy) ? "SYSTEM" : generatedBy.trim())
                .groundingStatus("FALLBACK")
                .groundingConfidence(0.0)
                .createdAt(now)
                .build();
    }

    private TopicGrounding groundTopic(String topic, StudentCourseMemory memory) {
        StudentWeakTopic memoryDetail = findWeakTopicDetail(topic, memory.getWeakTopicDetails());
        if (memoryDetail != null && hasAny(memoryDetail.getSourceMaterialIds(), memoryDetail.getSourceChunkIds())) {
            return new TopicGrounding(
                    cleanList(memoryDetail.getSourceTerms()),
                    cleanList(memoryDetail.getSourceChunkIds()),
                    cleanList(memoryDetail.getSourceMaterialIds()),
                    true,
                    memoryDetail.getConfidence() == null ? 0.85 : memoryDetail.getConfidence()
            );
        }

        List<String> topicTokens = significantTokens(String.join(" ", expandRetrievalTerms(topic, List.of())));
        List<GroundedChunk> matches = new ArrayList<>();
        for (CourseMaterial material : materialRepository.findByCourseId(memory.getCourseId().trim())) {
            if (!isVisibleForClass(material, memory.getClassId())
                    || !isTextbookMaterial(material)
                    || material.getContent() == null
                    || material.getContent().isBlank()) {
                continue;
            }
            for (CourseMaterialChunkingService.HierarchicalChunk chunk : chunkingService.chunkHierarchically(material)) {
                double score = relevance(topicTokens, chunk.parentContent() + "\n" + chunk.content());
                if (score <= 0) {
                    continue;
                }
                matches.add(new GroundedChunk(material.getId(), chunk.chunkId(), chunk.parentContent(), score));
            }
        }

        List<GroundedChunk> selected = matches.stream()
                .sorted(Comparator.comparing(GroundedChunk::score).reversed())
                .limit(4)
                .toList();
        List<String> sourceTerms = selected.stream()
                .flatMap(chunk -> extractSourceTerms(chunk.content(), topicTokens).stream())
                .distinct()
                .limit(8)
                .toList();
        List<String> chunkIds = selected.stream().map(GroundedChunk::chunkId).filter(Objects::nonNull).distinct().toList();
        List<String> materialIds = selected.stream().map(GroundedChunk::materialId).filter(Objects::nonNull).distinct().toList();
        boolean grounded = !materialIds.isEmpty();
        return new TopicGrounding(sourceTerms, chunkIds, materialIds, grounded, grounded ? 0.78 : 0.0);
    }

    private ImprovePlanItem findPlanItem(ImprovePlan plan, String planItemId) {
        if (plan.getPlanItemDetails() != null) {
            for (ImprovePlanItem item : plan.getPlanItemDetails()) {
                if (item != null && planItemId.equals(item.getId())) {
                    return item;
                }
            }
        }
        List<String> legacyItems = plan.getPlanItems();
        if (legacyItems == null) {
            return null;
        }
        for (int index = 0; index < legacyItems.size(); index++) {
            String legacyId = "legacy-" + index;
            if (!legacyId.equals(planItemId)) {
                continue;
            }
            String text = normalizeClean(legacyItems.get(index));
            if (text == null) {
                return null;
            }
            String sourceTopic = stripLegacyVerb(text);
            return ImprovePlanItem.builder()
                    .id(legacyId)
                    .title(text)
                    .instruction(text)
                    .sourceTopic(sourceTopic)
                    .retrievalTerms(expandRetrievalTerms(sourceTopic, List.of()))
                    .groundingStatus("LEGACY")
                    .groundingConfidence(0.0)
                    .build();
        }
        return null;
    }

    private StudentWeakTopic findWeakTopicDetail(String topic, List<StudentWeakTopic> details) {
        if (details == null) {
            return null;
        }
        for (StudentWeakTopic detail : details) {
            if (detail == null || detail.getTopic() == null) {
                continue;
            }
            if (detail.getTopic().equalsIgnoreCase(topic)
                    || (detail.getCanonicalTopic() != null && detail.getCanonicalTopic().equalsIgnoreCase(topic))) {
                return detail;
            }
        }
        return null;
    }


    private List<String> nonBlankList(String... values) {
        if (values == null || values.length == 0) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String value : values) {
            String clean = normalizeClean(value);
            if (clean != null) {
                result.add(clean);
            }
        }
        return result;
    }

    private List<String> expandRetrievalTerms(String topic, List<String> sourceTerms) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        addAll(terms, sourceTerms);
        add(terms, topic);
        String normalized = normalizeForMatch(String.join(" ", terms));
        if (normalized.contains("banker") || normalized.contains("allocation")) {
            addAll(terms, List.of("resources currently assigned", "resource allocation", "allocated resources"));
        }
        if (normalized.contains("need")) {
            addAll(terms, List.of("resources still needed", "remaining resource needs", "total resource needs"));
        }
        if (normalized.contains("available")) {
            addAll(terms, List.of("available resources", "free resources"));
        }
        if (normalized.contains("max")) {
            addAll(terms, List.of("maximum demand", "maximum resource requirement", "total resource needs"));
        }
        if (normalized.contains("safe state") || normalized.contains("banker")) {
            addAll(terms, List.of("Banker's Algorithm", "safe state"));
        }
        return terms.stream().filter(value -> !value.isBlank()).limit(16).toList();
    }

    private List<String> extractSourceTerms(String content, List<String> topicTokens) {
        String clean = TextSanitizer.clean(content);
        if (clean == null || clean.isBlank()) {
            return List.of();
        }
        List<String> terms = new ArrayList<>();
        for (String sentence : clean.split("(?<=[.!?])\\s+|\\R+")) {
            String trimmed = sentence.trim();
            if (trimmed.length() < 16) {
                continue;
            }
            String normalized = normalizeForMatch(trimmed);
            boolean matched = topicTokens.isEmpty()
                    || topicTokens.stream().anyMatch(normalized::contains);
            if (matched) {
                terms.add(trimmed.length() <= 140 ? trimmed : trimmed.substring(0, 137).trim() + "...");
            }
            if (terms.size() >= 4) {
                break;
            }
        }
        return terms;
    }

    private double relevance(List<String> tokens, String content) {
        if (tokens.isEmpty() || content == null || content.isBlank()) {
            return 0.0;
        }
        String normalized = normalizeForMatch(content);
        long matched = tokens.stream().filter(normalized::contains).count();
        return (double) matched / tokens.size();
    }

    private List<String> significantTokens(String value) {
        String normalized = normalizeForMatch(value);
        if (normalized.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim();
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                result.add(token);
            }
        }
        return new ArrayList<>(result);
    }

    private String stableItemId(String topic, String suffix) {
        String normalized = normalizeForMatch(topic).replaceAll("[^a-z0-9]+", "-");
        normalized = normalized.replaceAll("^-+|-+$", "");
        if (normalized.isBlank()) {
            normalized = Integer.toHexString(topic.hashCode());
        }
        return normalized + "-" + suffix;
    }

    private String stripLegacyVerb(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceFirst("(?i)^review\\s+", "")
                .replaceFirst("(?i)^do one small practice exercise about\\s+", "")
                .trim();
    }

    private String calculateRiskLevel(int weakTopicCount, List<AssignmentSubmission> submissions) {
        long lowScores = submissions.stream()
                .filter(item -> item.getScore() != null && item.getScore() < 5.0)
                .count();
        if (weakTopicCount >= 4 || lowScores >= 2) return "HIGH";
        if (weakTopicCount >= 2 || lowScores == 1) return "MEDIUM";
        return "LOW";
    }

    private boolean isTextbookMaterial(CourseMaterial material) {
        return material != null
                && !"KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                && !"GOLD_QA".equalsIgnoreCase(material.getSourceType())
                && !"senior-approved-knowledge".equalsIgnoreCase(material.getCategory());
    }

    private boolean isVisibleForClass(CourseMaterial material, String requestedClassId) {
        String materialClassId = material.getClassId();
        if (materialClassId == null || materialClassId.isBlank() || "null".equalsIgnoreCase(materialClassId)) {
            return true;
        }
        return requestedClassId != null && materialClassId.equalsIgnoreCase(requestedClassId.trim());
    }

    private List<String> cleanList(List<String> values) {
        if (values == null) {
            return List.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : values) {
            add(result, value);
        }
        return new ArrayList<>(result);
    }

    @SafeVarargs
    private final List<String> merge(List<String>... lists) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (List<String> list : lists) {
            addAll(result, list);
        }
        return new ArrayList<>(result);
    }

    private void addAll(LinkedHashSet<String> target, List<String> values) {
        if (values == null) {
            return;
        }
        values.forEach(value -> add(target, value));
    }

    private void add(LinkedHashSet<String> target, String value) {
        String clean = normalizeClean(value);
        if (clean != null) {
            target.add(clean);
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String clean = normalizeClean(value);
            if (clean != null) {
                return clean;
            }
        }
        return null;
    }

    private boolean hasAny(List<String> first, List<String> second) {
        return (first != null && !first.isEmpty()) || (second != null && !second.isEmpty());
    }

    private String normalizeClean(String value) {
        String clean = TextSanitizer.clean(value);
        return clean == null || clean.isBlank() ? null : clean.trim();
    }

    private String normalizeForMatch(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed)
                .replaceAll("")
                .replace('đ', 'd')
                .replaceAll("[^\\p{L}\\p{N}+#]+", " ")
                .trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record TopicGrounding(
            List<String> sourceTerms,
            List<String> sourceChunkIds,
            List<String> sourceMaterialIds,
            boolean grounded,
            double confidence
    ) {
    }

    private record GroundedChunk(String materialId, String chunkId, String content, double score) {
    }
}
