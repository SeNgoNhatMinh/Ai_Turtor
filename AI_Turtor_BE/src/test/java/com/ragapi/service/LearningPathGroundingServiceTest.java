package com.ragapi.service;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.cotraining.ChapterOutlineView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningPathGroundingServiceTest {

    @Mock ChapterOutlineService chapterOutlineService;
    @InjectMocks LearningPathGroundingService service;

    @Test
    void exposesOnlyMaterialBackedHeadingsWithPerLessonIdentity() {
        when(chapterOutlineService.suggestChapters("PFP191")).thenReturn(List.of(
                chapter("debug-list", "Debugging Lists", 20, "material-main"),
                chapter("debug-dict", "Debugging Dictionaries", 30, "material-main"),
                ChapterOutlineView.builder()
                        .chapterKey("copyright")
                        .title("Copyright Detail")
                        .materialHealth("NO_MATERIAL")
                        .pageStart(14)
                        .build()
        ));

        List<SuggestionItem> result = service.ground(
                "PFP191",
                "Hôm nay mình muốn học Debugging",
                List.of(
                        new SuggestionItem("Bắt đầu bài 1: Debugging danh sách", "", List.of(), "AI"),
                        new SuggestionItem("Bắt đầu bài 2: Debugging từ điển", "", List.of(), "AI")
                )
        );

        assertThat(result).extracting(SuggestionItem::getChapterKey)
                .containsExactly("debug-list", "debug-dict");
        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Debugging Lists", "Debugging Dictionaries");
        assertThat(result).allSatisfy(item -> {
            assertThat(item.getSourceMaterialIds()).containsExactly("material-main");
            assertThat(item.getSourceChunkIds()).isEmpty();
            assertThat(item.getSource()).isEqualTo("MATERIAL_OUTLINE");
        });
    }

    @Test
    void returnsNoClickableLessonWhenNoRelevantMaterialHeadingExists() {
        when(chapterOutlineService.suggestChapters("PFP191")).thenReturn(List.of(
                chapter("servlet", "Servlet Lifecycle", 10, "material-main")
        ));

        assertThat(service.ground(
                "PFP191",
                "Debugging dictionaries",
                List.of(new SuggestionItem("Bài 1: Dictionary", "", List.of(), "AI"))
        )).isEmpty();
    }

    private static ChapterOutlineView chapter(String key, String title, int page, String materialId) {
        return ChapterOutlineView.builder()
                .chapterKey(key)
                .title(title)
                .sourceMaterialIds(List.of(materialId))
                .chunkCount(2)
                .approxChars(2500)
                .materialHealth("MATERIAL_OK")
                .pageStart(page)
                .build();
    }
}
