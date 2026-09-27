package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.service.ChapterOutlineService;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseLessonPreviewServiceTest {

    @Mock CourseMaterialStoreGateway materialRepository;
    @Mock ChapterOutlineService chapterOutlineService;
    @InjectMocks CourseLessonPreviewService service;

    @Test
    void chapterKeyWinsOverTheLearnerFriendlyPromptText() {
        ChapterPreviewView preview = ChapterPreviewView.builder()
                .courseId("PFP191")
                .chapterKey("debugging-dictionaries")
                .title("Debugging Dictionaries")
                .hasMaterialContent(true)
                .excerpt("Dictionary debugging material")
                .build();
        when(chapterOutlineService.previewChapter("PFP191", "debugging-dictionaries", true))
                .thenReturn(preview);
        RagQueryIntent intent = RagQueryIntent.builder()
                .chapterKey("debugging-dictionaries")
                .chapterTitle("Debugging Dictionaries")
                .build();

        ChapterPreviewView result = service.resolve(
                "Bắt đầu bài 2: Debugging trong từ điển - Học cách kiểm tra lỗi key-value",
                "PFP191",
                intent
        );

        assertThat(result).isSameAs(preview);
        verify(chapterOutlineService).previewChapter("PFP191", "debugging-dictionaries", true);
    }
}
