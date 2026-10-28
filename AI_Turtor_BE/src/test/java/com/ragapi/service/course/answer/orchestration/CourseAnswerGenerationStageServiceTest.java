package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.generation.CourseAnswerPromptService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.aiworker.AiWorkerTraceService;
import com.ragapi.service.aiworker.AiWorkerOrchestrator;
import com.ragapi.service.aiworker.AiWorkerResult;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.util.StudentFacingMessages;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.function.Supplier;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseAnswerGenerationStageServiceTest {

    private AiWorkerOrchestrator inlineWorkerOrchestrator() {
        AiWorkerOrchestrator orchestrator = mock(AiWorkerOrchestrator.class);
        when(orchestrator.executeParallel(anyMap(), org.mockito.ArgumentMatchers.any(Duration.class)))
                .thenAnswer(invocation -> {
                    Map<String, Supplier<String>> workers = invocation.getArgument(0);
                    Map<String, AiWorkerResult<String>> results = new LinkedHashMap<>();
                    workers.forEach((id, task) -> {
                        try {
                            results.put(id, AiWorkerResult.success(task.get(), 0L));
                        } catch (RuntimeException failure) {
                            results.put(id, AiWorkerResult.failed(failure.getClass().getSimpleName(), 0L));
                        }
                    });
                    return results;
                });
        return orchestrator;
    }


    @Test
    void retriesModelInsufficientMaterialClaimAfterGroundingAlreadyPassed() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());
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
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn("Tài liệu hiện có không đủ nội dung để trả lời.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
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
        verify(generationService, times(1)).generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
    }

    @Test
    void lessonTeachRetriesAndDoesNotPersistAResponseWithoutExplanationAndQuiz() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());
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
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null), anyBoolean()))
                .thenReturn("## Giải thích\nNội dung quá ngắn.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null), anyBoolean()))
                .thenReturn("## Giải thích\nNội dung vẫn quá ngắn.");
        when(resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, List.of("Main Material")))
                .thenReturn(unavailable);

        CourseRagAnswer result = service.generate(prepared);

        assertSame(unavailable, result);
        verify(generationService, times(1)).generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null), anyBoolean());
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null), anyBoolean());
    }

    @Test
    void singlePassModeReturnsUsableLessonWithoutStartingSecondProviderChain() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

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
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null), anyBoolean()))
                .thenReturn(firstAnswer);
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(), firstAnswer))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PRJ301"), eq(Map.of()), eq(firstAnswer)))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(firstAnswer, result.getAnswer());
        verify(generationService, never()).generateGroundedQualityFallbackAnswer(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyBoolean());
    }

    @Test
    void highSupportKeepsOneTextbookExampleWithoutAnotherProviderChain() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

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
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
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
                anyString(), anyString(), anyString(), anyString(), anyString(), anyBoolean());
    }

    @Test
    void highSupportKeepsTheFirstLessonWhenTheExampleRetryFails() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

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
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(firstLesson);
        when(generationService.generateGroundedQualityFallbackAnswer(
                contains("HIGH_SUPPORT RECOVERY"), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
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
                contains("HIGH_SUPPORT RECOVERY"), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
    }

    @Test
    void headingsOnlyWorkerOneAnswerIsRetriedSoStudentDoesNotReceiveQuizOnly() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Tôi muốn tìm hiểu về Theo dõi quá trình")
                .courseId("PRO192")
                .classId("SE1833")
                .teachingMode("EXPLAIN_CONCEPT")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                "PRO192",
                request.question(),
                List.of(),
                "Chương trình Java kết thúc khi mọi thread non-daemon đã kết thúc và các shutdown hook đã hoàn thành.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Java material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String headingsOnly = """
                ## Theo tài liệu môn học

                ## Nguồn tài liệu đã dùng
                materialId=6aa92c915a97315119973f9e
                """;
        String recoveredLesson = """
                ## Giải thích
                Theo dõi quá trình là việc quan sát vòng đời của các luồng khi chương trình Java chạy.
                Chương trình chỉ kết thúc khi mọi thread non-daemon đã kết thúc và các shutdown hook
                do JVM khởi động cũng đã hoàn thành, nên muốn theo dõi đúng phải phân biệt daemon
                với non-daemon và kiểm tra trạng thái từng luồng trong lúc chương trình vận hành.
                """;

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Java material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(headingsOnly);
        when(generationService.generateWorkerUtilityAnswer(anyString()))
                .thenAnswer(invocation -> {
                    String workerPrompt = invocation.getArgument(0);
                    return workerPrompt.contains("Worker 2")
                            ? "Q1.\nChương trình Java kết thúc khi nào?\nA. Khi daemon xong\nB. Khi mọi non-daemon kết thúc\nC. Khi gọi System.gc()\nD. Khi có exception\nĐáp án đúng: B\nGiải thích: Theo tài liệu, chương trình kết thúc khi mọi non-daemon đã kết thúc."
                            : "- Theo dõi vòng đời các luồng trong Java\n- Giám sát lỗi bất đồng bộ trong JVM";
                });
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(recoveredLesson);
        when(evidenceService.selectAnswerEvidenceChunks(eq(List.of()), eq(request.question()), anyString()))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PRO192"), eq(Map.of()), anyString()))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(true, result.getAnswer().contains("Theo dõi quá trình là việc quan sát"));
        assertEquals(true, result.getAnswer().contains("## Kiểm tra hiểu"));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
    }

    @Test
    void knowledgeCheckRequestIsExplainedBeforeQuiz() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Kiểm tra kiến thức của tôi về Cấu trúc CPU")
                .courseId("CEA201")
                .classId("SE1833")
                .teachingMode("EXPLAIN_CONCEPT")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                "CEA201",
                request.question(),
                List.of(),
                "CPU gồm ALU, đơn vị điều khiển CU và tập thanh ghi; pipeline chia chu kỳ lệnh thành nhiều giai đoạn chồng lấp.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("CEA material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String quizOnly = """
                ## Theo tài liệu môn học
                Câu hỏi: CPU gồm những khối chức năng nào?
                A. ALU và CU
                B. RAM và ROM
                C. Cache và Bus
                D. Màn hình và bàn phím
                Đáp án đúng: A
                Giải thích: Theo tài liệu.
                """;
        String recoveredLesson = """
                ## Giải thích
                CPU là bộ xử lý trung tâm gồm ALU thực hiện phép toán số học và logic,
                đơn vị điều khiển CU điều phối việc nạp và giải mã lệnh, cùng tập thanh ghi
                lưu dữ liệu tạm thời trong lúc xử lý. Pipeline chia chu kỳ lệnh thành nhiều
                giai đoạn chồng lấp nhau để tăng thông lượng xử lý của bộ xử lý.
                """;

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("CEA material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(quizOnly);
        when(generationService.generateWorkerUtilityAnswer(anyString()))
                .thenAnswer(invocation -> {
                    String workerPrompt = invocation.getArgument(0);
                    return workerPrompt.contains("Worker 2")
                            ? "Q1.\nKhối nào thực hiện phép toán số học?\nA. ALU\nB. CU\nC. Thanh ghi\nD. Bus\nĐáp án đúng: A\nGiải thích: ALU thực hiện phép toán số học và logic."
                            : "- Pipeline trong CPU\n- Tập thanh ghi của CPU";
                });
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(recoveredLesson);
        when(evidenceService.selectAnswerEvidenceChunks(eq(List.of()), eq(request.question()), anyString()))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("CEA201"), eq(Map.of()), anyString()))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        // Explanation comes first; the quiz is appended only after it.
        assertEquals(true, result.getAnswer().contains("CPU là bộ xử lý trung tâm"));
        assertEquals(true, result.getAnswer().contains("## Kiểm tra hiểu"));
        assertEquals(true, result.getAnswer().indexOf("CPU là bộ xử lý trung tâm")
                < result.getAnswer().indexOf("## Kiểm tra hiểu"));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
    }

    @Test
    void headingsOnlyWorkerOneAnswerIsNotDeliveredAsQuizOnlyWhenRetryAlsoFails() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService, mock(AiWorkerTraceService.class), inlineWorkerOrchestrator());

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Tôi muốn tìm hiểu về Theo dõi quá trình")
                .courseId("PRO192")
                .classId("SE1833")
                .teachingMode("EXPLAIN_CONCEPT")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                "PRO192",
                request.question(),
                List.of(),
                "Chương trình Java kết thúc khi mọi thread non-daemon đã kết thúc và các shutdown hook đã hoàn thành.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Java material"),
                0.9,
                true,
                false,
                false,
                null
        );
        String headingsOnly = """
                ## Theo tài liệu môn học

                ## Nguồn tài liệu đã dùng
                materialId=6aa92c915a97315119973f9e
                """;
        CourseRagAnswer unavailable = CourseRagAnswer.builder()
                .answer(StudentFacingMessages.GENERATION_BUSY)
                .build();

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Java material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateWorker1GroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(headingsOnly);
        when(generationService.generateWorkerUtilityAnswer(anyString()))
                .thenReturn("Q1.\nChương trình Java kết thúc khi nào?\nA. Khi daemon xong\nB. Khi mọi non-daemon kết thúc\nC. Khi gọi System.gc()\nD. Khi có exception\nĐáp án đúng: B\nGiải thích: Theo tài liệu.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean()))
                .thenReturn(headingsOnly);
        when(resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, List.of("Java material")))
                .thenReturn(unavailable);

        CourseRagAnswer result = service.generate(prepared);

        assertSame(unavailable, result);
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null), anyBoolean());
    }
}
