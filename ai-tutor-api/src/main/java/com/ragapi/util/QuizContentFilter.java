package com.ragapi.util;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Keeps AI quiz generation focused on academic concepts, not document metadata
 * (page numbers, TOC index lines, source URLs).
 */
public final class QuizContentFilter {

    private static final Pattern SOURCE_URL_LINE =
            Pattern.compile("(?i)^\\s*Source URL:.*$");
    private static final Pattern PAGE_TITLE_LINE =
            Pattern.compile("(?i)^\\s*Page title:.*$");
    private static final Pattern TOC_INDEX_LINE =
            Pattern.compile("(?i)^\\s*[\\p{L}\\p{N}\\s._-]+(?:class|interface|enum|method|field|chapter|section)?\\s*,\\s*\\d+(?:\\s*[-–]\\s*\\d+)?\\s*$");
    private static final Pattern METADATA_QUESTION =
            Pattern.compile("(?i)(?:"
                    + "trang\\s*\\d+"
                    + "|page\\s*\\d+"
                    + "|(?:ở|tại|theo|on)\\s+(?:các\\s+)?trang"
                    + "|trong\\s+tài\\s+liệu(?:\\s+có\\s+ghi)?"
                    + "|xuất\\s+hiện\\s+ở\\s+(?:các\\s+)?trang"
                    + "|được\\s+(?:tham\\s+chiếu|mô\\s+tả|đề\\s+cập|ghi)\\s+ở"
                    + "|referenced\\s+on\\s+page"
                    + "|appears\\s+on\\s+page"
                    + "|materialId"
                    + "|source\\s+url"
                    + "|mục\\s+lục"
                    + "|table\\s+of\\s+contents"
                    + ")");

    private QuizContentFilter() {
    }

    public static String sanitizeMaterialContextForQuiz(String context) {
        if (context == null || context.isBlank()) {
            return "";
        }
        List<String> kept = new ArrayList<>();
        for (String rawLine : context.split("\\R")) {
            String line = rawLine.trim();
            if (line.isBlank()) {
                continue;
            }
            if (SOURCE_URL_LINE.matcher(line).matches()
                    || PAGE_TITLE_LINE.matcher(line).matches()
                    || TOC_INDEX_LINE.matcher(line).matches()) {
                continue;
            }
            kept.add(line);
        }
        return String.join("\n", kept).trim();
    }

    public static boolean isAcademicQuizQuestion(String questionText, String explanation) {
        String combined = ((questionText == null ? "" : questionText) + " "
                + (explanation == null ? "" : explanation)).trim();
        if (combined.isBlank()) {
            return false;
        }
        return !METADATA_QUESTION.matcher(combined).find();
    }
}
