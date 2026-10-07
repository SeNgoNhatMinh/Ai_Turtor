package com.ragapi.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Collapses page-level index headings such as "Chapter 2 - Basic Computations Page 11"
 * into one study unit per chapter number.
 */
public final class IndexedChapterTitles {

    private static final Pattern PAGE_HEADING = Pattern.compile(
            "(?i)^chapter\\s+(\\d+)\\s*[-–—]\\s*(.+?)\\s+page\\s+\\d+.*$"
    );
    private static final Pattern DOTTED_HEADING = Pattern.compile(
            "(?i)^chapter\\s+(\\d+)\\.\\s*(.+)$"
    );

    private IndexedChapterTitles() {
    }

    public static List<String> studyUnits(List<String> rawTitles) {
        TreeMap<Integer, String> byNumber = new TreeMap<>();
        if (rawTitles == null) {
            return List.of();
        }
        for (String raw : rawTitles) {
            Parsed parsed = parse(raw);
            if (parsed == null || !ChapterHeadingUtils.isStudyUnitTitle(parsed.title())) {
                continue;
            }
            byNumber.putIfAbsent(parsed.number(), parsed.title());
        }
        return List.copyOf(byNumber.values());
    }

    private static Parsed parse(String raw) {
        if (raw == null || raw.isBlank() || ChapterHeadingUtils.isInternalKnowledgeTitle(raw)) {
            return null;
        }
        String title = raw.trim().replaceAll("\\s+", " ");
        Matcher dotted = DOTTED_HEADING.matcher(title);
        if (dotted.matches()) {
            return new Parsed(Integer.parseInt(dotted.group(1)), "Chapter " + dotted.group(1) + ". " + cleanName(dotted.group(2)));
        }
        Matcher page = PAGE_HEADING.matcher(title);
        if (page.matches()) {
            return new Parsed(Integer.parseInt(page.group(1)), "Chapter " + page.group(1) + ". " + cleanName(page.group(2)));
        }
        return null;
    }

    private static String cleanName(String name) {
        String cleaned = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) {
            return cleaned;
        }
        return cleaned.substring(0, 1).toUpperCase(Locale.ROOT) + cleaned.substring(1);
    }

    private record Parsed(int number, String title) {
    }
}
