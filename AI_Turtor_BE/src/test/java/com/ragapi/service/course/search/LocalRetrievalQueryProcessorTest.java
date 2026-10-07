package com.ragapi.service.course.search;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LocalRetrievalQueryProcessorTest {

    private final LocalRetrievalQueryProcessor processor = new LocalRetrievalQueryProcessor();

    @Test
    void keepsMixedQuestionAndExtractsCanonicalTechnicalTerms() {
        var result = processor.process("Spring Boot dependency injection là gì?");

        assertThat(result.semanticQuery()).isEqualTo("Spring Boot dependency injection là gì?");
        assertThat(result.language()).isEqualTo("mixed");
        assertThat(result.technicalTerms()).containsExactly("Dependency Injection", "Spring Boot");
        assertThat(result.keywordQuery()).isEqualTo("Spring Boot dependency injection là gì?");
    }

    @Test
    void detectsVietnameseWithoutCallingATranslationModel() {
        var result = processor.process("Giải thích cách bộ nhớ hoạt động");

        assertThat(result.language()).isEqualTo("vi");
        assertThat(result.semanticQuery()).isEqualTo("Giải thích cách bộ nhớ hoạt động");
    }

    @Test
    void detectsEnglishQuestion() {
        assertThat(processor.process("How does memory allocation work?").language()).isEqualTo("en");
    }

    @Test
    void detectsVietnameseWithoutDiacriticsAndPreservesTechnicalTerm() {
        var result = processor.process("Spring Boot la gi?");

        assertThat(result.language()).isEqualTo("mixed");
        assertThat(result.technicalTerms()).containsExactly("Spring Boot");
        assertThat(result.keywordQuery()).isEqualTo("Spring Boot la gi?");
    }

    @Test
    void keepsEachParaphraseInsteadOfRewritingItToADictionaryLabel() {
        var named = processor.process("Con trỏ trong C là gì?");
        var paraphrased = processor.process("Biến tham chiếu này hoạt động thế nào?");

        assertThat(named.keywordQuery()).isEqualTo("Con trỏ trong C là gì?");
        assertThat(paraphrased.keywordQuery()).isEqualTo("Biến tham chiếu này hoạt động thế nào?");
        assertThat(named.technicalTerms()).isEmpty();
        assertThat(paraphrased.technicalTerms()).isEmpty();
    }
}
