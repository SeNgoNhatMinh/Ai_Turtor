package com.ragapi.service.course.search;

import com.ragapi.service.RetrievalQueryTranslationService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseRetrievalQueryServiceTest {

    @Test
    void bothParaphrasesKeepTheirWordingAndUseTheRewrittenSearchText() {
        RetrievalQueryTranslationService translation = mock(RetrievalQueryTranslationService.class);
        when(translation.expandForRetrieval("Con trỏ trong C là gì?", "PRF192", false))
                .thenReturn("Con trỏ trong C là gì? | What is a pointer in C; memory address");
        when(translation.expandForRetrieval("Biến tham chiếu này hoạt động thế nào?", "PRF192", false))
                .thenReturn("Biến tham chiếu này hoạt động thế nào? | How does a reference variable work; pointer; memory address");
        CourseRetrievalQueryService service = new CourseRetrievalQueryService(
                new LocalRetrievalQueryProcessor(),
                translation
        );

        var named = service.resolve("Con trỏ trong C là gì?", "PRF192", null, null);
        var paraphrased = service.resolve("Biến tham chiếu này hoạt động thế nào?", "PRF192", null, null);

        assertThat(named.focus()).isEqualTo("Con trỏ trong C là gì?");
        assertThat(named.keywordQuery()).startsWith("Con trỏ trong C là gì?");
        assertThat(named.keywordQuery()).contains("memory address");
        assertThat(paraphrased.focus()).isEqualTo("Biến tham chiếu này hoạt động thế nào?");
        assertThat(paraphrased.keywordQuery()).startsWith("Biến tham chiếu này hoạt động thế nào?");
        assertThat(paraphrased.keywordQuery()).contains("pointer");
        assertThat(named.technicalTerms()).isEmpty();
        assertThat(paraphrased.technicalTerms()).isEmpty();
    }
}
