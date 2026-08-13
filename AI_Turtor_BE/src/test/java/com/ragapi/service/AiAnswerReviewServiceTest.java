package com.ragapi.service;



import com.ragapi.dto.AiAnswerReviewRequest;

import com.ragapi.dto.GroupedAiAnswerReviewItem;
import com.ragapi.dto.SeniorReviewResolutionRequest;

import com.ragapi.entity.AiAnswerReview;

import com.ragapi.repository.AiAnswerReviewRepository;

import com.ragapi.repository.KnowledgeCandidateRepository;

import org.junit.jupiter.api.BeforeEach;

import org.junit.jupiter.api.Test;

import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;

import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;



import java.util.ArrayList;

import java.util.List;



import static org.junit.jupiter.api.Assertions.assertEquals;

import static org.mockito.ArgumentMatchers.any;

import static org.mockito.ArgumentMatchers.anyString;

import static org.mockito.Mockito.atLeastOnce;

import static org.mockito.Mockito.verify;

import static org.mockito.Mockito.when;



@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiAnswerReviewServiceTest {



    @Mock

    private AiAnswerReviewRepository reviewRepository;



    @Mock

    private KnowledgeCandidateRepository knowledgeCandidateRepository;



    @Mock

    private RealtimeEventService realtimeEvents;



    private AiAnswerReviewService service;



    private final List<AiAnswerReview> stored = new ArrayList<>();



    @BeforeEach

    void setUp() {

        service = new AiAnswerReviewService(
                reviewRepository,
                knowledgeCandidateRepository,
                realtimeEvents);

        stored.clear();



        when(reviewRepository.save(any(AiAnswerReview.class))).thenAnswer(invocation -> {

            AiAnswerReview review = invocation.getArgument(0);

            stored.removeIf(item -> item.getId().equals(review.getId()));

            stored.add(review);

            return review;

        });

        when(reviewRepository.findById(anyString())).thenAnswer(invocation -> stored.stream()

                .filter(item -> invocation.getArgument(0).equals(item.getId()))

                .findFirst());

        when(reviewRepository.findByCourseIdAndAnswerFingerprint(anyString(), anyString()))

                .thenAnswer(invocation -> stored.stream()

                        .filter(item -> invocation.getArgument(0).equals(item.getCourseId()))

                        .filter(item -> invocation.getArgument(1).equals(item.getAnswerFingerprint()))

                        .toList());

        when(reviewRepository.findByStatus(anyString())).thenAnswer(invocation -> stored.stream()

                .filter(item -> invocation.getArgument(0).equals(item.getStatus()))

                .toList());

    }



    @Test

    void singleModerateReviewAppearsInMentorQueueImmediately() {

        AiAnswerReview saved = service.submitReview(moderateReview("student-a", 3));



        assertEquals("NEEDS_MENTOR_REVIEW", saved.getStatus());
        assertEquals("MODERATE", saved.getEscalationTier());

    }



    @Test

    void secondModerateReviewEscalatesToMentorQueue() {

        service.submitReview(moderateReview("student-a", 3));

        AiAnswerReview second = service.submitReview(moderateReview("student-b", 2));



        assertEquals("NEEDS_MENTOR_REVIEW", second.getStatus());

        assertEquals("MODERATE", second.getEscalationTier());

        verify(realtimeEvents, atLeastOnce()).publishToRoles(

                any(),

                anyString(),

                anyString(),

                anyString(),

                anyString(),

                any()

        );

    }



    @Test

    void secondSevereReviewEscalatesToSeniorQueue() {

        service.submitReview(severeReview("student-a"));

        AiAnswerReview second = service.submitReview(severeReview("student-b"));



        assertEquals("NEEDS_SENIOR_REVIEW", second.getStatus());

        assertEquals("SEVERE", second.getEscalationTier());

    }



    @Test

    void groupedMentorPendingAggregatesSameAnswerFingerprint() {

        service.submitReview(moderateReview("student-a", 3));

        service.submitReview(moderateReview("student-b", 2));



        List<GroupedAiAnswerReviewItem> groups =

                service.listGroupedPending("NEEDS_MENTOR_REVIEW", "PRJ301");



        assertEquals(1, groups.size());

        assertEquals(2, groups.get(0).getDistinctStudentCount());

        assertEquals(2, groups.get(0).getReviewCount());

        assertEquals("MODERATE", groups.get(0).getEscalationTier());

    }

    @Test
    void groupedQueueKeepsOneLatestEvidenceRowPerStudent() {
        service.submitReview(moderateReview("student-a", 3));
        service.submitReview(moderateReview("student-a", 2));

        GroupedAiAnswerReviewItem group =
                service.listGroupedPending("NEEDS_MENTOR_REVIEW", "PRJ301").get(0);

        assertEquals(2, group.getReviewCount());
        assertEquals(1, group.getDistinctStudentCount());
        assertEquals(1, group.getReviews().size());
        assertEquals(2, group.getReviews().get(0).getRating());
    }

    @Test
    void seniorResolutionClosesEveryPendingReviewInFingerprintGroup() {
        AiAnswerReview first = service.submitReview(severeReview("student-a"));
        service.submitReview(severeReview("student-b"));
        SeniorReviewResolutionRequest request = new SeniorReviewResolutionRequest();
        request.setSeniorReviewerId("senior-1");
        request.setReviewerRole("SENIOR_MENTOR");
        request.setDecision("APPROVE_FEEDBACK");
        request.setNotes("Đã kiểm tra toàn bộ nhóm phản hồi.");

        service.resolveBySeniorReviewer(first.getId(), request);

        assertEquals(2, stored.stream()
                .filter(item -> "RESOLVED".equals(item.getStatus()))
                .count());
        assertEquals(0, service.listGroupedPending("NEEDS_SENIOR_REVIEW", "PRJ301").size());
    }

    @Test
    void legacyReviewsWithoutFingerprintAreGroupedAndResolvedTogether() {
        AiAnswerReview first = legacySeniorReview("legacy-1", "student-a");
        AiAnswerReview second = legacySeniorReview("legacy-2", "student-b");
        stored.add(first);
        stored.add(second);

        List<GroupedAiAnswerReviewItem> groups =
                service.listGroupedPending("NEEDS_SENIOR_REVIEW", "PRJ301");

        assertEquals(1, groups.size());
        assertEquals(2, groups.get(0).getReviewCount());
        SeniorReviewResolutionRequest request = new SeniorReviewResolutionRequest();
        request.setSeniorReviewerId("senior-1");
        request.setReviewerRole("SENIOR_MENTOR");
        request.setDecision("APPROVE_FEEDBACK");
        request.setNotes("Đã xử lý một lần cho toàn bộ nội dung trùng.");

        service.resolveBySeniorReviewer(first.getId(), request);

        assertEquals(2, stored.stream()
                .filter(item -> "RESOLVED".equals(item.getStatus()))
                .count());
    }



    @Test

    void sourceConflictEscalatesImmediatelyWithoutCrowdGate() {

        AiAnswerReviewRequest request = severeReview("student-a");

        request.setReviewType("SOURCE_CONFLICT");

        request.setFeedback("Slide sai so voi tai lieu");



        AiAnswerReview saved = service.submitReview(request);



        assertEquals("NEEDS_SENIOR_REVIEW", saved.getStatus());

        assertEquals("IMMEDIATE", saved.getEscalationTier());

    }



    private AiAnswerReviewRequest moderateReview(String studentId, int rating) {

        AiAnswerReviewRequest request = baseReview(studentId);

        request.setRating(rating);

        request.setFeedback("AI giai thich chua ro");

        return request;

    }



    private AiAnswerReviewRequest severeReview(String studentId) {

        AiAnswerReviewRequest request = baseReview(studentId);

        request.setRating(1);

        request.setFeedback("AI giai thich sai hoan toan");

        return request;

    }

    private AiAnswerReview legacySeniorReview(String id, String studentId) {
        return AiAnswerReview.builder()
                .id(id)
                .studentId(studentId)
                .courseId("PRJ301")
                .classId("SE1840")
                .question("Spring Boot la gi?")
                .answer("Spring Boot la framework Java.")
                .rating(1)
                .status("NEEDS_SENIOR_REVIEW")
                .createdAt(java.time.LocalDateTime.now())
                .build();
    }



    private AiAnswerReviewRequest baseReview(String studentId) {

        AiAnswerReviewRequest request = new AiAnswerReviewRequest();

        request.setStudentId(studentId);

        request.setCourseId("PRJ301");

        request.setClassId("SE1840");

        request.setMode("RAG");

        request.setReviewType("ANSWER_DISPUTE");

        request.setQuestion("JSP la gi?");

        request.setAnswer("JSP la Java Server Pages...");

        request.setAccurate(false);

        request.setHelpful(false);

        request.setReviewedBy(studentId);

        request.setReviewerRole("STUDENT");

        return request;

    }

}
