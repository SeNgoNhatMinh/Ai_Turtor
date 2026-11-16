package com.ragapi.service.behavior;

import com.ragapi.dto.StudentTeachingProfileRequest;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.StudentTeachingProfile;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.repository.StudentTeachingProfileRepository;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.service.EmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.entity.TeachingBehavior.*;
import static com.ragapi.service.behavior.BehaviorText.*;

/** Per-student, per-course learning profile plus the student's pinned/blocked behaviors. */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentTeachingProfileService {
    public static final Set<String> PACES = Set.of("SLOW", "NORMAL", "FAST");
    static final int MAX_PROFILE_ITEMS = 8;
    static final int MAX_PROFILE_ITEM_LENGTH = 120;
    static final int MAX_USED_IDS = 50;

    private final StudentTeachingProfileRepository repository;
    private final TeachingBehaviorRepository behaviorRepository;
    private final EmbeddingService embeddingService;
    private final MongoTemplate mongoTemplate;

    public Optional<StudentTeachingProfile> find(String studentId, String courseId) {
        if (trimToNull(studentId) == null || trimToNull(courseId) == null) return Optional.empty();
        return repository.findByStudentIdAndCourseId(studentId.trim(), courseId.trim());
    }

    /** Returns the stored profile, or an unsaved empty one for display. */
    public StudentTeachingProfile getOrEmpty(String studentId, String courseId, String classId) {
        return find(studentId, courseId).orElseGet(() -> StudentTeachingProfile.builder()
                .studentId(studentId)
                .courseId(courseId)
                .classId(trimToNull(classId))
                .build());
    }

    public StudentTeachingProfile update(String studentId, String courseId, String classId,
                                         StudentTeachingProfileRequest request, String actorId) {
        if (request == null) throw new IllegalArgumentException("Thiếu nội dung hồ sơ");
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        if (request.getLearnsBestWith() != null) {
            profile.setLearnsBestWith(cleanList(request.getLearnsBestWith(), MAX_PROFILE_ITEMS, MAX_PROFILE_ITEM_LENGTH));
        }
        if (request.getStruggleSignals() != null) {
            profile.setStruggleSignals(cleanList(request.getStruggleSignals(), MAX_PROFILE_ITEMS, MAX_PROFILE_ITEM_LENGTH));
        }
        if (request.getPace() != null) {
            String pace = trimToNull(request.getPace());
            if (pace != null && !PACES.contains(pace.toUpperCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Nhịp học không hợp lệ");
            }
            profile.setPace(pace == null ? null : pace.toUpperCase(Locale.ROOT));
        }
        if (request.getTeacherNote() != null) {
            String note = trimToNull(request.getTeacherNote());
            if (note != null && note.length() > 500) throw new IllegalArgumentException("Ghi chú tối đa 500 ký tự");
            profile.setTeacherNote(note);
        }
        profile.setUpdatedBy(actorId);
        return save(profile, classId);
    }

    /** Folds the reviewer's observations into the profile, newest first. */
    public void mergeFromReview(AdaptiveLearningReview review) {
        if (review == null) return;
        if (safe(review.getLearnsBestWith()).isEmpty() && safe(review.getStruggleSignals()).isEmpty()) return;
        StudentTeachingProfile profile = getOrEmpty(review.getStudentId(), review.getCourseId(), review.getClassId());
        profile.setLearnsBestWith(mergeNewestFirst(review.getLearnsBestWith(), profile.getLearnsBestWith(),
                MAX_PROFILE_ITEMS, MAX_PROFILE_ITEM_LENGTH));
        profile.setStruggleSignals(mergeNewestFirst(review.getStruggleSignals(), profile.getStruggleSignals(),
                MAX_PROFILE_ITEMS, MAX_PROFILE_ITEM_LENGTH));
        save(profile, review.getClassId());
    }

    public StudentTeachingProfile pin(String studentId, String courseId, String classId, String behaviorId, String actorId) {
        requireApplicable(behaviorId, studentId, courseId);
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        profile.setPinnedBehaviorIds(addId(profile.getPinnedBehaviorIds(), behaviorId));
        profile.setBlockedBehaviorIds(removeId(profile.getBlockedBehaviorIds(), behaviorId));
        profile.setUpdatedBy(actorId);
        return save(profile, classId);
    }

    public StudentTeachingProfile unpin(String studentId, String courseId, String classId, String behaviorId, String actorId) {
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        profile.setPinnedBehaviorIds(removeId(profile.getPinnedBehaviorIds(), behaviorId));
        profile.setUpdatedBy(actorId);
        return save(profile, classId);
    }

    public StudentTeachingProfile block(String studentId, String courseId, String classId, String behaviorId, String actorId) {
        requireApplicable(behaviorId, studentId, courseId);
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        profile.setBlockedBehaviorIds(addId(profile.getBlockedBehaviorIds(), behaviorId));
        profile.setPinnedBehaviorIds(removeId(profile.getPinnedBehaviorIds(), behaviorId));
        profile.setUpdatedBy(actorId);
        return save(profile, classId);
    }

    public StudentTeachingProfile unblock(String studentId, String courseId, String classId, String behaviorId, String actorId) {
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        profile.setBlockedBehaviorIds(removeId(profile.getBlockedBehaviorIds(), behaviorId));
        profile.setUpdatedBy(actorId);
        return save(profile, classId);
    }

    /** Remembers which behaviors reached the tutor, so the next review can score them. */
    public void recordUsage(String studentId, String courseId, String classId, Collection<String> behaviorIds) {
        if (behaviorIds == null || behaviorIds.isEmpty()
                || trimToNull(studentId) == null || trimToNull(courseId) == null) return;
        Update update = new Update()
                .addToSet("usedBehaviorIdsSinceReview").each(new LinkedHashSet<>(behaviorIds).toArray())
                .setOnInsert("_id", UUID.randomUUID().toString())
                .setOnInsert("createdAt", LocalDateTime.now());
        if (trimToNull(classId) != null) update.setOnInsert("classId", classId.trim());
        mongoTemplate.upsert(profileQuery(studentId, courseId), update, StudentTeachingProfile.class);
    }

    /** Returns and clears the behaviors used since the previous review. */
    public List<String> takeUsedBehaviorIds(String studentId, String courseId) {
        if (trimToNull(studentId) == null || trimToNull(courseId) == null) return List.of();
        StudentTeachingProfile previous = mongoTemplate.findAndModify(
                profileQuery(studentId, courseId),
                new Update().set("usedBehaviorIdsSinceReview", new ArrayList<String>()),
                StudentTeachingProfile.class);
        if (previous == null) return List.of();
        List<String> used = safe(previous.getUsedBehaviorIdsSinceReview());
        return used.size() > MAX_USED_IDS ? used.subList(used.size() - MAX_USED_IDS, used.size()) : used;
    }

    private static Query profileQuery(String studentId, String courseId) {
        return Query.query(Criteria.where("studentId").is(studentId.trim()).and("courseId").is(courseId.trim()));
    }

    /** The student's own RAG set: personal behaviors plus the shared ones pinned or blocked for them. */
    public Map<String, Object> studentBehaviors(String studentId, String courseId, String classId) {
        StudentTeachingProfile profile = getOrEmpty(studentId, courseId, classId);
        List<TeachingBehavior> personal = new ArrayList<>(behaviorRepository.findByScopeAndStudentIdAndCourseIdAndStatusIn(
                SCOPE_STUDENT, studentId, courseId, List.of(STATUS_AI_PENDING, STATUS_APPROVED, STATUS_RETIRED)));
        personal.sort(Comparator.comparing(TeachingBehavior::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profile", profile);
        result.put("personal", personal);
        result.put("pinned", orderedById(profile.getPinnedBehaviorIds()));
        result.put("blocked", orderedById(profile.getBlockedBehaviorIds()));
        return result;
    }

    private List<TeachingBehavior> orderedById(List<String> ids) {
        if (safe(ids).isEmpty()) return List.of();
        Map<String, TeachingBehavior> byId = new HashMap<>();
        behaviorRepository.findAllById(ids).forEach(behavior -> byId.put(behavior.getId(), behavior));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    public static boolean isEmpty(StudentTeachingProfile profile) {
        return profile == null || (safe(profile.getLearnsBestWith()).isEmpty()
                && safe(profile.getStruggleSignals()).isEmpty()
                && trimToNull(profile.getPace()) == null
                && trimToNull(profile.getTeacherNote()) == null);
    }

    public static String profileText(StudentTeachingProfile profile) {
        if (isEmpty(profile)) return "";
        List<String> parts = new ArrayList<>();
        if (!safe(profile.getLearnsBestWith()).isEmpty()) {
            parts.add("learns best with: " + String.join("; ", profile.getLearnsBestWith()));
        }
        if (!safe(profile.getStruggleSignals()).isEmpty()) {
            parts.add("struggles with: " + String.join("; ", profile.getStruggleSignals()));
        }
        if (trimToNull(profile.getPace()) != null) parts.add("pace: " + profile.getPace());
        if (trimToNull(profile.getTeacherNote()) != null) parts.add("teacher note: " + profile.getTeacherNote());
        return String.join(" | ", parts);
    }

    private StudentTeachingProfile save(StudentTeachingProfile profile, String classId) {
        LocalDateTime now = LocalDateTime.now();
        if (profile.getId() == null) profile.setId(UUID.randomUUID().toString());
        if (profile.getCreatedAt() == null) profile.setCreatedAt(now);
        if (trimToNull(classId) != null) profile.setClassId(classId.trim());
        profile.setUpdatedAt(now);
        profile.setProfileEmbedding(embed(profileText(profile)));
        return repository.save(profile);
    }

    private List<Float> embed(String text) {
        if (trimToNull(text) == null) return null;
        try {
            return embeddingService.generatePassageEmbedding(text).vectorAsList();
        } catch (Exception error) {
            log.warn("Teaching profile embedding unavailable: {}", error.getMessage());
            return null;
        }
    }

    /** Only behaviors that can apply to this student/course may be pinned or blocked. */
    private void requireApplicable(String behaviorId, String studentId, String courseId) {
        TeachingBehavior behavior = behaviorRepository.findById(Objects.requireNonNullElse(trimToNull(behaviorId), ""))
                .orElseThrow(() -> new NoSuchElementException("Không tìm thấy hành vi giảng dạy"));
        if (!appliesTo(behavior, studentId, courseId)) {
            throw new IllegalArgumentException("Hành vi này không thuộc sinh viên hoặc môn học này");
        }
    }

    static boolean appliesTo(TeachingBehavior behavior, String studentId, String courseId) {
        return switch (String.valueOf(behavior.getScope())) {
            case SCOPE_STUDENT -> Objects.equals(behavior.getStudentId(), studentId)
                    && Objects.equals(behavior.getCourseId(), courseId);
            case SCOPE_COURSE -> Objects.equals(behavior.getCourseId(), courseId);
            case SCOPE_DOMAIN, SCOPE_GLOBAL -> true;
            default -> false;
        };
    }

    private static List<String> addId(List<String> ids, String id) {
        List<String> result = new ArrayList<>(safe(ids));
        if (trimToNull(id) != null && !result.contains(id.trim())) result.add(id.trim());
        return result;
    }

    private static List<String> removeId(List<String> ids, String id) {
        List<String> result = new ArrayList<>(safe(ids));
        result.remove(id == null ? null : id.trim());
        return result;
    }
}
