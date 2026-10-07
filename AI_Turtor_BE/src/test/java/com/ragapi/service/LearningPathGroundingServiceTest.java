package com.ragapi.service;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.cotraining.ChapterOutlineView;
import com.ragapi.infrastructure.elasticsearch.ElasticsearchCourseSearchAdapter;
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
    @Mock ElasticsearchCourseSearchAdapter courseSearchAdapter;
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
    void topiclessStudyStartOffersTheFirstCourseLessons() {
        when(chapterOutlineService.suggestChapters("PFP191")).thenReturn(List.of(
                chapter("preface", "Preface", 1, "material-main"),
                chapter("variables", "Variables, expressions, and statements", 12, "material-main"),
                chapter("objects", "Object-oriented programming", 167, "material-main")
        ));

        List<SuggestionItem> result = service.ground("PFP191", "Hôm nay mình muốn học", List.of());

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Variables, expressions, and statements", "Object-oriented programming");
        assertThat(result.get(0).getTitle()).startsWith("Bắt đầu bài 1:");
        assertThat(service.guidanceAnswer("PFP191"))
                .contains("chưa soạn bài học")
                .contains("Bắt đầu bài 1: Variables, expressions, and statements");
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

    @Test
    void internalReviewNotesAreNotNumberedAsCourseLessons() {
        when(chapterOutlineService.suggestChapters("PRF192")).thenReturn(List.of(
                chapter("files", "Files", 90, "textbook"),
                chapter("review-note", "Senior-approved knowledge: Pointers and operator precedence", 1, "note"),
                chapter("pointers", "Pointers", 40, "textbook")
        ));

        List<SuggestionItem> result = service.ground(
                "PRF192",
                "Hôm nay tôi muốn học Pointers",
                List.of(new SuggestionItem("Bắt đầu bài 1: Files", "", List.of(), "AI"))
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle).containsExactly("Pointers");
        assertThat(result.get(0).getTitle()).doesNotContain("Senior-approved");
        assertThat(service.pathAnswer(result)).contains("Pointers").doesNotContain("Senior-approved");
    }

    @Test
    void studyStartUsesIndexedChapterHeadingsWhenTheOutlineIsOnlyTheWholeBook() {
        when(chapterOutlineService.suggestChapters("PRF192")).thenReturn(List.of(
                chapter("main", "Main Material", 1, "textbook"),
                chapter("note", "Senior-approved knowledge: Pointers and operator precedence", 1, "note")
        ));
        when(courseSearchAdapter.listChapterTitles("PRF192")).thenReturn(List.of(
                "Chapter 8 - Files Page 100",
                "Document",
                "Chapter 1. Introduction",
                "Chapter 2 - Basic Computations Page 11",
                "Senior-approved knowledge: Pointers"
        ));

        List<SuggestionItem> result = service.ground(
                "PRF192",
                "Hôm nay tôi muốn học cú pháp ngôn ngữ C",
                List.of()
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly(
                        "Chapter 1. Introduction",
                        "Chapter 2. Basic Computations",
                        "Chapter 8. Files"
                );
        assertThat(result.get(0).getSourceMaterialIds()).containsExactly("textbook");
        assertThat(service.pathAnswer(result)).contains("Chapter 1. Introduction").doesNotContain("Senior-approved");
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
