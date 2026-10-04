package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.generation.CourseAnswerPromptService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.util.StudentFacingMessages;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseAnswerGenerationStageServiceTest {

    @Test
    void retriesModelInsufficientMaterialClaimAfterGroundingAlreadyPassed() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);
        ReflectionTestUtils.setField(service, "qualityFallbackEnabled", true);

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Giải thích lệnh continue trong vòng lặp while")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("EXPLAIN_CONCEPT")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                "Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Python material"),
                0.92,
                true,
                false,
                false,
                null
        );

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Python material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn("Tài liệu hiện có không đủ nội dung để trả lời.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn("Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp.");
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(),
                "Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp."))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PFP191"), eq(Map.of()), anyString()))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(false, result.getEscalationRecommended());
        assertEquals("Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp.",
                result.getAnswer());
        verify(generationService, times(1)).generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null));
    }

    @Test
    void lessonTeachRetriesAndDoesNotPersistAResponseWithoutExplanationAndQuiz() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);
        ReflectionTestUtils.setField(service, "qualityFallbackEnabled", true);

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Bắt đầu bài 3: Cấu trúc điều khiển")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("LESSON_TEACH")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                "if, while và for là các cấu trúc điều khiển trong Python.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Main Material"),
                0.9,
                true,
                false,
                false,
                null
        );
        CourseRagAnswer unavailable = CourseRagAnswer.builder()
                .answer(StudentFacingMessages.GENERATION_BUSY)
                .build();

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Main Material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("LESSON_TEACH"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn("## Giải thích\nNội dung quá ngắn.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn("## Giải thích\nNội dung vẫn quá ngắn.");
        when(resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, List.of("Main Material")))
                .thenReturn(unavailable);

        CourseRagAnswer result = service.generate(prepared);

        assertSame(unavailable, result);
        verify(generationService, times(1)).generateGroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null));
    }

    @Test
    void singlePassModeReturnsUsableLessonWithoutStartingSecondProviderChain() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Start lesson 3")
                .courseId("PRJ301")
                .classId("PRJ301-01")
                .teachingMode("LESSON_TEACH")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                "Expression Language replaces scriptlet expressions in JSP pages.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("PRJ301 material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String firstAnswer = "## Explanation\nExpression Language reads scoped values without embedding Java code.";

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("PRJ301 material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("LESSON_TEACH"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn(firstAnswer);
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(), firstAnswer))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PRJ301"), eq(Map.of()), eq(firstAnswer)))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(firstAnswer, result.getAnswer());
        verify(generationService, never()).generateGroundedQualityFallbackAnswer(
                anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void highSupportKeepsOneTextbookExampleWithoutAnotherProviderChain() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);

        String guidance = "ACTIVE SUPPORT LEVEL: HIGH_SUPPORT";
        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Cấu trúc dữ liệu list/dict/tuple")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("EXPLAIN_CONCEPT")
                .pedagogicalContext(guidance)
                .build();
        String context = """
                >>> t = ('a', 'b', 'c')
                >>> t[0]
                'a'
                >>> lst = []
                >>> lst.append(('a', 1))
                """;
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                context,
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Python material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String taught = """
                List là danh sách có thể thay đổi.
                ```python
                lst = []
                lst.append(('a', 1))
                ```
                Dòng đầu tạo danh sách rỗng. Dòng sau thêm một tuple vào đúng danh sách đó.
                Tuple không gán lại được sau khi tạo.
                """;

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Python material")), anyString(), anyString(),
                anyBoolean(), eq(guidance), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn(taught);
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(), taught))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PFP191"), eq(Map.of()), eq(taught)))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(false, result.getEscalationRecommended());
        assertEquals(true, result.getAnswer().contains("lst.append"));
        verify(generationService, never()).generateGroundedQualityFallbackAnswer(
                anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void highSupportKeepsTheFirstLessonWhenTheExampleRetryFails() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);

        String guidance = "ACTIVE SUPPORT LEVEL: HIGH_SUPPORT";
        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Cấu trúc dữ liệu list/dict/tuple")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("EXPLAIN_CONCEPT")
                .pedagogicalContext(guidance)
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                ">>> t = ('a', 'b', 'c')\n>>> t[0]\n'a'",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Python material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String firstLesson = """
                List là chuỗi phần tử có thể thêm hoặc xóa. Tuple giữ nguyên sau khi tạo và có thể làm khóa dictionary.
                Dict lưu từng khóa với một giá trị. Ví dụ trong tài liệu tạo tuple t rồi lấy phần tử đầu, sau đó dùng list để sắp xếp các cặp.
                Tài liệu không đủ để chép mọi dòng tương tác trong chương, nhưng ba cấu trúc này đều được giải thích ở trên.
                Sinh viên cần nhớ: append đổi danh sách hiện tại, còn phép cộng tạo danh sách mới. Khóa dictionary phải không đổi.
                """;

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Python material")), anyString(), anyString(),
                anyBoolean(), eq(guidance), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn(firstLesson);
        when(generationService.generateGroundedQualityFallbackAnswer(
                contains("HIGH_SUPPORT RECOVERY"), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn(StudentFacingMessages.GENERATION_UNAVAILABLE);
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(), firstLesson))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PFP191"), eq(Map.of()), eq(firstLesson)))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(false, result.getEscalationRecommended());
        assertEquals(true, result.getAnswer().contains("Tuple giữ nguyên"));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                contains("HIGH_SUPPORT RECOVERY"), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null));
    }
}
