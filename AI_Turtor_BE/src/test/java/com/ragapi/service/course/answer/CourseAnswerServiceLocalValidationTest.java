package com.ragapi.service.course.answer;

import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.orchestration.CourseAnswerPipelineService;
import com.ragapi.service.course.answer.policy.CourseAnswerRequestPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CourseAnswerServiceLocalValidationTest {

    @Mock
    private CourseAnswerGenerationService generationService;

    @Mock
    private CourseAnswerPipelineService pipelineService;

    private CourseAnswerService service;

    @BeforeEach
    void setUp() {
        service = new CourseAnswerService(
                generationService,
                pipelineService,
                new CourseAnswerRequestPolicyService()
        );
    }

    @Test
    void incompleteStudentInputReturnsLocalAnswerWithoutHostedLlm() {
        var answer = service.answerTutorInteraction(
                "hôm nay tôi muốn...",
                "DBI202",
                "OFF_TOPIC",
                "",
                "",
                ""
        );

        assertTrue(answer.getAnswer().contains("chưa hoàn chỉnh"));
        verifyNoInteractions(generationService, pipelineService);
    }

    @Test
    void offTopicInputReturnsLocalAnswerWithoutHostedLlm() {
        var answer = service.answerTutorInteraction(
                "thời tiết hôm nay như thế nào?",
                "DBI202",
                "OFF_TOPIC",
                "",
                "",
                ""
        );

        assertTrue(answer.getAnswer().contains("không sử dụng API AI bên ngoài"));
        verifyNoInteractions(generationService, pipelineService);
    }
}
