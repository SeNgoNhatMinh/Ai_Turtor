package com.ragapi.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.util.regex.Pattern;

/**
 * Turns teacher rich-text HTML into readable plain text.
 * Editor markup is removed, while characters the teacher typed as {@code <} and {@code >}
 * stay in the text instead of remaining as {@code &lt;} and {@code &gt;}.
 */
public final class RichTextPlainText {
    private static final Pattern EDITOR_TAG = Pattern.compile(
            "(?i)</?(?:p|div|br|b|strong|i|em|u|s|strike|ul|ol|li|h[1-3]|blockquote|pre|code|a|span)\\b");
    private static final Pattern TRAILING_LINE_SPACE = Pattern.compile("[ \\t]+\\n");
    private static final Pattern EXCESSIVE_BLANK_LINES = Pattern.compile("\\n{3,}");

    private RichTextPlainText() {
    }

    public static String toPlain(String value) {
        if (value == null) {
            return null;
        }
        String raw = value.trim();
        if (raw.isEmpty()) {
            return raw;
        }
        if (raw.startsWith("<") && EDITOR_TAG.matcher(raw).find()) {
            return cleanup(extractEditorText(raw));
        }
        if (containsEntity(raw)) {
            return cleanup(decodeEntities(raw));
        }
        return raw;
    }

    private static boolean containsEntity(String value) {
        return value.contains("&lt;")
                || value.contains("&gt;")
                || value.contains("&amp;")
                || value.contains("&quot;")
                || value.contains("&nbsp;")
                || value.contains("&apos;")
                || value.contains("&#");
    }

    private static String extractEditorText(String html) {
        Document document = Jsoup.parse(html);
        document.outputSettings(new Document.OutputSettings().prettyPrint(false));
        document.select("br").after("\\n");
        document.select("p, div, li, h1, h2, h3, blockquote, pre, tr").after("\\n");
        return document.text().replace("\\n", "\n");
    }

    private static String decodeEntities(String value) {
        String text = value;
        for (int pass = 0; pass < 2; pass++) {
            text = text.replace("&nbsp;", " ")
                    .replace("&#160;", " ")
                    .replace("&#xA0;", " ")
                    .replace("&#xa0;", " ");
            text = text.replace("&amp;", "&")
                    .replace("&#38;", "&")
                    .replace("&#x26;", "&");
            text = text.replace("&lt;", "<")
                    .replace("&#60;", "<")
                    .replace("&#x3c;", "<")
                    .replace("&#x3C;", "<");
            text = text.replace("&gt;", ">")
                    .replace("&#62;", ">")
                    .replace("&#x3e;", ">")
                    .replace("&#x3E;", ">");
            text = text.replace("&quot;", "\"")
                    .replace("&#34;", "\"");
            text = text.replace("&#39;", "'")
                    .replace("&apos;", "'");
        }
        return text;
    }

    private static String cleanup(String value) {
        String text = decodeEntities(value);
        text = TRAILING_LINE_SPACE.matcher(text).replaceAll("\n");
        text = EXCESSIVE_BLANK_LINES.matcher(text).replaceAll("\n\n");
        return text.trim();
    }
}
