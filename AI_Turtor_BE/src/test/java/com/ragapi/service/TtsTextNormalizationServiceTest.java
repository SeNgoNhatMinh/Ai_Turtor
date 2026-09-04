package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TtsTextNormalizationServiceTest {

    private TtsTextNormalizationService service;

    @BeforeEach
    void setUp() {
        service = new TtsTextNormalizationService();
        ReflectionTestUtils.setField(service, "maxTextLength", 6000);
        ReflectionTestUtils.setField(service, "maxChunkLength", 1900);
    }

    @Test
    void keepsReadableVietnameseAndRemovesMarkdownNoise() {
        String normalized = service.normalize("""
                ## Khái niệm
                **Kế thừa** giúp tái sử dụng [mã nguồn](https://example.com). [1]
                ![sơ đồ](https://example.com/image.png)
                """);

        assertEquals("Khái niệm Kế thừa giúp tái sử dụng mã nguồn.", normalized);
        assertFalse(normalized.contains("http"));
    }

    @Test
    void replacesCodeBlocksInsteadOfReadingCodeSymbols() {
        String normalized = service.normalize("Giải thích:\n```java\nif (ready) { run(); }\n```\nHoàn tất.");

        assertEquals("Giải thích: Đoạn mã bên dưới là ví dụ minh họa. Hoàn tất.", normalized);
    }

    @Test
    void limitsVeryLongAnswersAtAUsefulBoundary() {
        ReflectionTestUtils.setField(service, "maxTextLength", 40);

        String normalized = service.normalize("Câu đầu tiên đã đủ dài. Câu thứ hai cũng khá dài và còn tiếp tục.");

        assertTrue(normalized.length() <= 40);
        assertTrue(normalized.endsWith("."));
    }

    @Test
    void splitsAtReadableBoundariesWithoutExceedingProviderLimit() {
        ReflectionTestUtils.setField(service, "maxChunkLength", 100);
        String text = ("Câu này giải thích nội dung bài học một cách rõ ràng. ").repeat(6);

        var chunks = service.normalizeAndChunk(text);

        assertTrue(chunks.size() > 1);
        assertTrue(chunks.stream().allMatch(chunk -> chunk.length() <= 100));
        assertTrue(chunks.stream().allMatch(chunk -> chunk.endsWith(".")));
    }
}
