package com.ragapi.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Student-facing lesson names for welcome chips.
 * Outline headings stay available after {@link #SOURCE_SEPARATOR} so retrieval
 * can still target the original chapter. The visible label is a short
 * Vietnamese lesson title, not the raw English table of contents.
 */
public final class StudyLessonTitles {

    public static final String SOURCE_SEPARATOR = " || ";

    private static final Pattern TOP_CHAPTER = Pattern.compile(
            "(?i)^(?:chapter|chương|chuong|ch\\.)\\s*:?\\s*(\\d+)\\b(?!\\.)"
    );
    private static final Pattern TOP_NUMBER = Pattern.compile("^(\\d+)\\s+\\p{L}");
    private static final Pattern CHAPTER_PREFIX = Pattern.compile(
            "(?i)^(?:chapter|chương|chuong|ch\\.)\\s*:?\\s*\\d+\\s*[:.\\-–—]?\\s*"
    );
    private static final Pattern NUMBER_PREFIX = Pattern.compile("^\\d+(?:\\.\\d+)*\\s+");
    private static final Pattern VIETNAMESE_LETTER = Pattern.compile("[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern ALREADY_LESSON = Pattern.compile("(?i)^(?:bài|bai|chương|chuong)\\s+\\d+\\b");

    private static final List<Lead> LEADS = List.of(
            new Lead("(?i)^writing your first\\s+(.+)$", "Viết %s đầu tiên"),
            new Lead("(?i)^an introduction to\\s+(.+)$", "Giới thiệu %s"),
            new Lead("(?i)^introduction to\\s+(.+)$", "Giới thiệu %s"),
            new Lead("(?i)^introducing\\s+(.+)$", "Giới thiệu %s"),
            new Lead("(?i)^understanding(?:\\s+the)?\\s+(.+)$", "Tìm hiểu %s"),
            new Lead("(?i)^overview of(?:\\s+the)?\\s+(.+)$", "Tổng quan %s"),
            new Lead("(?i)^getting started with\\s+(.+)$", "Bắt đầu với %s"),
            new Lead("(?i)^working with\\s+(.+)$", "Làm việc với %s"),
            new Lead("(?i)^deploying and undeploying\\s+(.+)$", "Triển khai và gỡ %s"),
            new Lead("(?i)^what is(?:\\s+an|\\s+a)?\\s+(.+)$", "%s là gì"),
            new Lead("(?i)^history of\\s+(.+)$", "Lịch sử %s"),
            new Lead("(?i)^using(?:\\s+the)?\\s+(.+)$", "Sử dụng %s"),
            new Lead("(?i)^creating(?:\\s+an|\\s+a|\\s+the)?\\s+(.+)$", "Tạo %s"),
            new Lead("(?i)^choosing(?:\\s+an|\\s+a|\\s+the)?\\s+(.+)$", "Lựa chọn %s"),
            new Lead("(?i)^installing\\s+(.+)$", "Cài đặt %s"),
            new Lead("(?i)^debugging\\s+(.+)$", "Gỡ lỗi %s"),
            new Lead("(?i)^building\\s+(.+)$", "Xây dựng %s"),
            new Lead("(?i)^configuring\\s+(.+)$", "Cấu hình %s"),
            new Lead("(?i)^managing\\s+(.+)$", "Quản lý %s"),
            new Lead("(?i)^maintaining\\s+(.+)$", "Duy trì %s"),
            new Lead("(?i)^replacing\\s+(.+)$", "Thay %s"),
            new Lead("(?i)^improving\\s+(.+)$", "Cải thiện %s"),
            new Lead("(?i)^making\\s+(.+)$", "Làm %s"),
            new Lead("(?i)^eliminating\\s+(.+)$", "Bỏ %s"),
            new Lead("(?i)^searching for\\s+(.+)$", "Tìm %s"),
            new Lead("(?i)^mapping\\s+(.+)$", "Ánh xạ %s"),
            new Lead("(?i)^authenticating\\s+(.+)$", "Xác thực %s"),
            new Lead("(?i)^securing\\s+(.+)$", "Bảo vệ %s"),
            new Lead("(?i)^internationalizing\\s+(.+)$", "Quốc tế hóa %s")
    );

    /** Full chapter titles from the PRJ301 textbook, after the "Chapter N" prefix. */
    private static final Map<String, String> KNOWN_TITLES = Map.ofEntries(
            Map.entry("using jsps to display content", "Dùng JSP để hiển thị nội dung"),
            Map.entry("maintaining state using sessions", "Duy trì trạng thái bằng session"),
            Map.entry("using the expression language in jsps", "Dùng Expression Language trong JSP"),
            Map.entry("using the java standard tag library", "Dùng thư viện thẻ chuẩn JSTL"),
            Map.entry("writing custom tag and function libraries", "Viết thư viện thẻ và hàm tùy chỉnh"),
            Map.entry("improving your application using filters", "Cải thiện ứng dụng bằng filter"),
            Map.entry("making your application interactive with websockets", "Làm ứng dụng tương tác với WebSocket"),
            Map.entry("using logging to monitor your application", "Dùng logging để theo dõi ứng dụng"),
            Map.entry("replacing your servlets with controllers", "Thay Servlet bằng controller"),
            Map.entry("using services and repositories to support your controllers", "Dùng service và repository cho controller"),
            Map.entry("internationalizing your application with spring framework i18n", "Quốc tế hóa ứng dụng với Spring i18n"),
            Map.entry("using jsr 349, spring framework, and hibernate validator for bean validation", "Kiểm tra bean với JSR 349 và Hibernate Validator"),
            Map.entry("creating restful and soap web services", "Tạo web service REST và SOAP"),
            Map.entry("using messaging and clustering for flexibility and reliability", "Dùng messaging và clustering"),
            Map.entry("introducing java persistence api and hibernate orm", "Giới thiệu JPA và Hibernate ORM"),
            Map.entry("mapping entities to tables with jpa annotations", "Ánh xạ entity sang bảng bằng annotation JPA"),
            Map.entry("using jpa in spring framework repositories", "Dùng JPA trong repository Spring"),
            Map.entry("eliminating boilerplate repositories with spring data jpa", "Bỏ repository lặp lại với Spring Data JPA"),
            Map.entry("searching for data with jpa and hibernate search", "Tìm dữ liệu với JPA và Hibernate Search"),
            Map.entry("creating advanced mappings and custom data types", "Tạo ánh xạ nâng cao và kiểu dữ liệu tùy chỉnh"),
            Map.entry("introducing spring security", "Giới thiệu Spring Security"),
            Map.entry("authenticating users with spring security", "Xác thực người dùng với Spring Security"),
            Map.entry("using authorization tags and annotations", "Dùng thẻ và annotation phân quyền"),
            Map.entry("securing restful web services with oauth", "Bảo vệ web service REST bằng OAuth")
    );

    private static final String[][] PHRASES = {
            {"java platform, enterprise edition", "nền tảng Java EE"},
            {"enterprise edition", "phiên bản doanh nghiệp"},
            {"web application structure", "cấu trúc ứng dụng web"},
            {"web applications", "ứng dụng web"},
            {"web application", "ứng dụng web"},
            {"expression language", "Expression Language"},
            {"web containers", "web container"},
            {"in jsps", "trong JSP"},
            {"jsps", "JSP"},
            {"servlet class", "lớp Servlet"},
            {"on your machine", "trên máy tính"},
            {"from your ide", "trong IDE"},
            {"your ide", "IDE"}
    };

    private StudyLessonTitles() {
    }

    public record Chip(String label, String sourceTitle) {
        public String markdownLine() {
            if (sourceTitle == null || sourceTitle.isBlank() || sourceTitle.equalsIgnoreCase(label)) {
                return label;
            }
            return label + SOURCE_SEPARATOR + sourceTitle.trim();
        }
    }

    public static List<String> welcomeLines(List<String> studyTitles) {
        return chips(studyTitles).stream().map(Chip::markdownLine).toList();
    }

    public static List<Chip> chips(List<String> studyTitles) {
        List<String> ranged = ChapterHeadingUtils.studySuggestionRange(studyTitles);
        List<String> lessons = lessonLevel(ranged);
        List<Chip> chips = new ArrayList<>();
        int fallback = 1;
        for (String source : lessons) {
            if (source == null || source.isBlank()) {
                continue;
            }
            Integer numbered = topNumber(source);
            int lessonNo = numbered != null ? numbered : fallback;
            chips.add(new Chip(label(lessonNo, source.trim()), source.trim()));
            fallback = lessonNo + 1;
        }
        return List.copyOf(chips);
    }

    static List<String> lessonLevel(List<String> titles) {
        if (titles == null || titles.isEmpty()) {
            return List.of();
        }
        List<String> chapters = titles.stream().filter(StudyLessonTitles::isTopLevelLesson).toList();
        if (!chapters.isEmpty()) {
            return chapters;
        }
        return titles;
    }

    static boolean isTopLevelLesson(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String trimmed = title.trim();
        if (TOP_CHAPTER.matcher(trimmed).find()) {
            return true;
        }
        return TOP_NUMBER.matcher(trimmed).find();
    }

    static String label(int lessonNo, String source) {
        String body = chapterBody(source);
        if (body.isBlank()) {
            body = source.trim();
        }
        if (ALREADY_LESSON.matcher(body).find()) {
            return body;
        }
        String subject = containsVietnamese(body) ? body : paraphrase(body);
        return "Bài " + lessonNo + ": " + subject;
    }

    private static String chapterBody(String source) {
        String body = CHAPTER_PREFIX.matcher(source.trim()).replaceFirst("").trim();
        body = NUMBER_PREFIX.matcher(body).replaceFirst("").trim();
        return body.replaceAll("\\s{2,}", " ").trim();
    }

    private static String paraphrase(String body) {
        String trimmed = sentenceCaseIfShouting(body.trim());
        String known = KNOWN_TITLES.get(trimmed.toLowerCase(Locale.ROOT).replaceAll("\\s+", " "));
        if (known != null) {
            return known;
        }
        if (trimmed.equalsIgnoreCase("introduction")) {
            return "Giới thiệu";
        }
        for (Lead lead : LEADS) {
            Matcher matcher = lead.pattern().matcher(trimmed);
            if (!matcher.matches()) {
                continue;
            }
            String phrase = polish(matcher.group(matcher.groupCount()), false);
            return lead.template().formatted(phrase).replaceAll("\\s{2,}", " ").trim();
        }
        return polish(trimmed, true);
    }

    private static String sentenceCaseIfShouting(String text) {
        String letters = text.replaceAll("[^\\p{L}]", "");
        if (letters.length() < 4 || !letters.equals(letters.toUpperCase(Locale.ROOT))) {
            return text;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static String polish(String phrase, boolean capitalize) {
        String current = phrase.trim();
        String lower = current.toLowerCase(Locale.ROOT);
        for (String[] pair : PHRASES) {
            int at = lower.indexOf(pair[0]);
            if (at < 0) {
                continue;
            }
            current = current.substring(0, at) + pair[1] + current.substring(at + pair[0].length());
            lower = current.toLowerCase(Locale.ROOT);
        }
        current = current.replaceAll("\\s{2,}", " ").trim();
        if (current.isEmpty()) {
            return phrase.trim();
        }
        if (!capitalize) {
            return current;
        }
        return Character.toUpperCase(current.charAt(0)) + current.substring(1);
    }

    private static boolean containsVietnamese(String text) {
        return VIETNAMESE_LETTER.matcher(text).find();
    }

    private static Integer topNumber(String title) {
        Matcher chapter = TOP_CHAPTER.matcher(title.trim());
        if (chapter.find()) {
            return Integer.valueOf(chapter.group(1));
        }
        Matcher number = TOP_NUMBER.matcher(title.trim());
        if (number.find()) {
            return Integer.valueOf(number.group(1));
        }
        return null;
    }

    private record Lead(Pattern pattern, String template) {
        private Lead(String regex, String template) {
            this(Pattern.compile(regex), template);
        }
    }
}
