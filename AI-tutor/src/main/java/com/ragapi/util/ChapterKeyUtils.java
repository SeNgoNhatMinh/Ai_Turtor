package com.ragapi.util;

import java.text.Normalizer;
import java.util.Locale;

public final class ChapterKeyUtils {

    private ChapterKeyUtils() {
    }

    public static String toChapterKey(String title) {
        if (title == null || title.isBlank()) {
            return "general";
        }
        String normalized = Normalizer.normalize(title.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? "general" : normalized;
    }
}
