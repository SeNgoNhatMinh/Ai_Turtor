package com.ragapi.service;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.RagSourceEvidence;
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
    void vietnameseStudyTopicUsesVerifiedEnglishRetrievalEvidence() {
        when(chapterOutlineService.suggestChapters("DBI202")).thenReturn(List.of(
                chapter("intro", "Introduction to Database Systems", 10, "db-textbook"),
                chapter("normalization", "Relational Database Design and Normalization", 120, "db-textbook")
        ));
        RagSourceEvidence evidence = RagSourceEvidence.builder()
                .materialId("db-textbook")
                .chunkId("chunk-intro")
                .chapter("Introduction to Database Systems")
                .excerpt("A database is a shared collection of logically related data and its description.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        List<SuggestionItem> result = service.ground(
                "DBI202",
                "Tôi muốn học về cơ sở dữ liệu",
                List.of(),
                List.of(evidence)
        );

        assertThat(result).isNotEmpty();
        assertThat(result.get(0).getChapterTitle()).isEqualTo("Introduction to Database Systems");
        assertThat(result.get(0).getSourceMaterialIds()).containsExactly("db-textbook");
    }

    @Test
    void verifiedEvidenceIsSafeFallbackWhenOutlineHasOnlyWholeBook() {
        when(chapterOutlineService.suggestChapters("DBI202")).thenReturn(List.of(
                chapter("main", "Main Material", 1, "db-textbook")
        ));
        RagSourceEvidence evidence = RagSourceEvidence.builder()
                .materialId("db-textbook")
                .chunkId("chunk-sql")
                .chapter("SQL Data Definition")
                .excerpt("SQL data definition includes statements that create and alter database schemas.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        List<SuggestionItem> result = service.ground(
                "DBI202",
                "Tôi muốn học về cơ sở dữ liệu SQL",
                List.of(),
                List.of(evidence)
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("SQL Data Definition");
        assertThat(result.get(0).getSourceChunkIds()).containsExactly("chunk-sql");
        assertThat(result.get(0).getSource()).isEqualTo("RETRIEVED_EVIDENCE");
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

    @Test
    void supportLevelKeepsOnlyRealChaptersAndChangesHowManyLessonsAppear() {
        when(chapterOutlineService.suggestChapters("PFP191")).thenReturn(List.of(
                chapter("c1", "Counting and summing loops", 10, "textbook"),
                chapter("c2", "Nested loops", 20, "textbook"),
                chapter("c3", "Loop patterns", 30, "textbook"),
                chapter("c4", "Iteration loops", 40, "textbook"),
                chapter("c5", "While loops", 50, "textbook"),
                chapter("c6", "Files and loops", 60, "textbook"),
                chapter("other", "Dictionaries", 70, "textbook")
        ));
        List<SuggestionItem> proposed = List.of(
                new SuggestionItem("Bài 1: Invented topic", "", List.of(), "AI")
        );

        List<SuggestionItem> high = service.ground(
                "PFP191", "Hôm nay mình muốn học loops", proposed, List.of(), "HIGH_SUPPORT");
        List<SuggestionItem> standard = service.ground(
                "PFP191", "Hôm nay mình muốn học loops", proposed, List.of(), "STANDARD");
        List<SuggestionItem> challenge = service.ground(
                "PFP191", "Hôm nay mình muốn học loops", proposed, List.of(), "CHALLENGE");

        assertThat(high).extracting(SuggestionItem::getChapterTitle)
                .containsExactly(
                        "Counting and summing loops",
                        "Nested loops",
                        "Loop patterns",
                        "Iteration loops",
                        "While loops",
                        "Files and loops"
                );
        assertThat(standard).hasSize(5);
        assertThat(challenge).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Counting and summing loops", "Nested loops", "Loop patterns");
        assertThat(high).extracting(SuggestionItem::getChapterTitle).doesNotContain("Dictionaries", "Invented topic");
        assertThat(service.pathAnswer(high, "HIGH_SUPPORT")).contains("chia nhỏ");
        assertThat(service.pathAnswer(challenge, "CHALLENGE")).contains("ít bài hơn");
    }

    @Test
    void jdbcQuestionDoesNotBecomeJpaChaptersFromANearbySummary() {
        when(chapterOutlineService.suggestChapters("PRJ301")).thenReturn(List.of(
                chapter("jdbc", "Chapter 12: JDBC Database Access", 240, "book"),
                chapter("jpa", "Chapter 19: Introducing Java Persistence API and Hibernate ORM", 560, "book"),
                chapter("mapping", "Chapter 20: Mapping Entities to Tables with JPA Annotations", 580, "book"),
                chapter("repo", "Chapter 21: Using JPA in Spring Framework Repositories", 600, "book")
        ));
        RagSourceEvidence summary = RagSourceEvidence.builder()
                .materialId("book")
                .chunkId("chunk-summary")
                .chapter("Summary")
                .pageStart(601)
                .excerpt("This summary reviews the Java Persistence API, Hibernate ORM, JPA annotations, and Spring repositories.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        List<SuggestionItem> result = service.ground(
                "PRJ301",
                "Hôm nay mình muốn học về kết nối cơ sở dữ liệu JDBC",
                List.of(),
                List.of(summary),
                "CHALLENGE"
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Chapter 12: JDBC Database Access");
        assertThat(service.citedEvidence(result, List.of(summary))).isEmpty();
    }

    @Test
    void jdbcQuestionStaysEmptyWhenTheBookOnlyHasJpaChapters() {
        when(chapterOutlineService.suggestChapters("PRJ301")).thenReturn(List.of(
                chapter("jpa", "Chapter 19: Introducing Java Persistence API and Hibernate ORM", 560, "book"),
                chapter("mapping", "Chapter 20: Mapping Entities to Tables with JPA Annotations", 580, "book"),
                chapter("repo", "Chapter 21: Using JPA in Spring Framework Repositories", 600, "book")
        ));
        RagSourceEvidence summary = RagSourceEvidence.builder()
                .materialId("book")
                .chapter("Summary")
                .pageStart(601)
                .excerpt("JDBC is the lower-level API. This chapter then introduces Hibernate and the Java Persistence API.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        assertThat(service.ground(
                "PRJ301",
                "Hôm nay mình muốn học về kết nối cơ sở dữ liệu JDBC",
                List.of(),
                List.of(summary),
                "CHALLENGE"
        )).isEmpty();
    }

    @Test
    void jdbcEvidenceCanSelectTheChapterThatActuallyContainsIt() {
        when(chapterOutlineService.suggestChapters("PRJ301")).thenReturn(List.of(
                chapter("access", "Connecting Applications to a Database", 240, "book"),
                chapter("jpa", "Chapter 19: Introducing Java Persistence API and Hibernate ORM", 560, "book")
        ));
        RagSourceEvidence jdbc = RagSourceEvidence.builder()
                .materialId("book")
                .chunkId("chunk-jdbc")
                .chapter("Connecting Applications to a Database")
                .excerpt("JDBC connects a Java application to a database with DriverManager, Connection, and PreparedStatement.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        List<SuggestionItem> result = service.ground(
                "PRJ301",
                "Hôm nay mình muốn học về kết nối cơ sở dữ liệu JDBC",
                List.of(),
                List.of(jdbc),
                "CHALLENGE"
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Connecting Applications to a Database");
        assertThat(service.citedEvidence(result, List.of(jdbc))).extracting(RagSourceEvidence::getChunkId)
                .containsExactly("chunk-jdbc");
    }

    @Test
    void jdbcMentionInsideBookConventionsIsNotALesson() {
        when(chapterOutlineService.suggestChapters("PRJ301")).thenReturn(List.of(
                chapter("conventions", "Conventions Used in This Book", 45, "book"),
                chapter("jdbc", "Chapter 12: JDBC Database Access", 240, "book")
        ));
        RagSourceEvidence conventions = RagSourceEvidence.builder()
                .materialId("book")
                .chunkId("chunk-conventions")
                .chapter("Conventions Used in This Book")
                .pageStart(45)
                .excerpt("Code listings use a monospace font. The examples mention JDBC, JPA, and servlet names.")
                .sourceKind("COURSE_MATERIAL")
                .excerptVerified(true)
                .build();

        List<SuggestionItem> result = service.ground(
                "PRJ301",
                "Hôm nay mình muốn học về kết nối cơ sở dữ liệu JDBC",
                List.of(),
                List.of(conventions),
                "CHALLENGE"
        );

        assertThat(result).extracting(SuggestionItem::getChapterTitle)
                .containsExactly("Chapter 12: JDBC Database Access");
        assertThat(service.citedEvidence(result, List.of(conventions))).isEmpty();
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
