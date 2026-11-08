package com.ragapi.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Puts 1. 2. 3. on the section titles the student sees. Quiz and lesson-path
 * headings stay exact because the chat UI finds them by those words.
 */
public final class NumberedAnswerHeadings {

    private static final Pattern FENCE = Pattern.compile("^\\s*```");
    private static final Pattern HEADING = Pattern.compile("^(#{2,3})[ \\t]+(?:\\d+\\.\\s+)?(.+?)\\s*$");
    private static final Set<String> UNNUMBERED = Set.of(
            "kiem tra hieu",
            "understanding check",
            "quiz tu luyen",
            "hoc chuyen sau",
            "hoc tiep phan nay",
            "bai tiep theo",
            "nguon tai lieu da dung",
            "lo trinh hoc",
            "bat dau the nao"
    );

    private NumberedAnswerHeadings() {
    }

    public static String number(String markdown) {
        if (markdown == null || markdown.isBlank()) return markdown;
        String[] lines = markdown.split("\\R", -1);
        boolean[] insideFence = fenceMask(lines);
        List<String> kept = new ArrayList<>();
        for (int lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            String line = lines[lineIndex];
            Matcher heading = HEADING.matcher(line);
            if (!insideFence[lineIndex]
                    && heading.matches()
                    && !unnumbered(heading.group(2))
                    && !hasBody(lines, insideFence, lineIndex)) {
                continue;
            }
            kept.add(line);
        }
        StringBuilder out = new StringBuilder();
        boolean inFence = false;
        int index = 0;
        for (int lineIndex = 0; lineIndex < kept.size(); lineIndex++) {
            String line = kept.get(lineIndex);
            if (FENCE.matcher(line).find()) inFence = !inFence;
            if (!inFence) {
                Matcher heading = HEADING.matcher(line);
                if (heading.matches() && !unnumbered(heading.group(2))) {
                    index++;
                    line = heading.group(1) + " " + index + ". " + heading.group(2).trim();
                }
            }
            if (lineIndex > 0) out.append('\n');
            out.append(line);
        }
        return out.toString();
    }

    private static boolean[] fenceMask(String[] lines) {
        boolean[] inside = new boolean[lines.length];
        boolean inFence = false;
        for (int index = 0; index < lines.length; index++) {
            inside[index] = inFence;
            if (FENCE.matcher(lines[index]).find()) inFence = !inFence;
        }
        return inside;
    }

    /** A heading is empty when the next content line is another heading, or the answer ends. */
    private static boolean hasBody(String[] lines, boolean[] insideFence, int headingIndex) {
        for (int index = headingIndex + 1; index < lines.length; index++) {
            if (FENCE.matcher(lines[index]).find()) return true;
            if (insideFence[index] || lines[index].isBlank()) continue;
            return !HEADING.matcher(lines[index]).matches();
        }
        return false;
    }

    private static boolean unnumbered(String title) {
        String key = TextSanitizer.normalizeAccentInsensitive(title)
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
        return UNNUMBERED.contains(key);
    }
}
