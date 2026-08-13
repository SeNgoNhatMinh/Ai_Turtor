package com.ragapi.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Extracts and repairs common JSON syntax errors from LLM quiz responses.
 */
public final class QuizJsonParser {

    private static final Pattern TRAILING_COMMA = Pattern.compile(",(\\s*[}\\]])");
    private static final Pattern MISSING_COMMA_BEFORE_KEY =
            Pattern.compile("\"([^\"\\\\]*?)\"\\s+\"(\\w+)\":");
    private static final Pattern MISSING_COMMA_BEFORE_KEY_MULTILINE =
            Pattern.compile("\"([^\"\\\\]*?)\"\\s*\\n\\s*\"(\\w+)\":");
    private static final Pattern DOUBLE_QUOTE_BEFORE_KEY =
            Pattern.compile("\"([^\"\\\\]*?)\"\"(\\w+)\":");
    private static final Pattern ADJACENT_OBJECTS =
            Pattern.compile("}\\s*\\{");
    private static final Pattern SMART_DOUBLE_QUOTE = Pattern.compile("[\\u201C\\u201D]");
    private static final Pattern SMART_SINGLE_QUOTE = Pattern.compile("[\\u2018\\u2019]");

    private QuizJsonParser() {
    }

    public static String extractJson(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("AI returned empty quiz payload");
        }
        String cleaned = raw.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("```\\s*$", "").trim();
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return cleaned.substring(start, end + 1);
        }
        return cleaned;
    }

    public static String repairJson(String json) {
        if (json == null || json.isBlank()) {
            return "";
        }
        String repaired = json.trim();
        repaired = SMART_DOUBLE_QUOTE.matcher(repaired).replaceAll("\"");
        repaired = SMART_SINGLE_QUOTE.matcher(repaired).replaceAll("'");
        repaired = DOUBLE_QUOTE_BEFORE_KEY.matcher(repaired).replaceAll("\"$1\", \"$2\":");
        repaired = MISSING_COMMA_BEFORE_KEY.matcher(repaired).replaceAll("\"$1\", \"$2\":");
        repaired = MISSING_COMMA_BEFORE_KEY_MULTILINE.matcher(repaired).replaceAll("\"$1\",\n      \"$2\":");
        repaired = ADJACENT_OBJECTS.matcher(repaired).replaceAll("}, {");
        repaired = TRAILING_COMMA.matcher(repaired).replaceAll("$1");
        return repaired;
    }

    public static <T> T readValue(String raw, ObjectMapper mapper, Class<T> type) throws IOException {
        String json = repairJson(extractJson(raw));
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException strictError) {
            return readValueLenient(json, mapper, type, strictError);
        }
    }

    private static <T> T readValueLenient(
            String json,
            ObjectMapper mapper,
            Class<T> type,
            JsonProcessingException strictError
    ) throws IOException {
        JsonNode root;
        try {
            root = mapper.readTree(repairJson(json));
        } catch (JsonProcessingException treeError) {
            root = parseQuestionsRootFromFragments(json, mapper);
        }
        if (root == null || root.isMissingNode()) {
            throw new IOException("Invalid quiz JSON from AI: " + strictError.getOriginalMessage(), strictError);
        }
        try {
            return mapper.treeToValue(root, type);
        } catch (JsonProcessingException mappingError) {
            throw new IOException("Invalid quiz JSON from AI: " + mappingError.getOriginalMessage(), mappingError);
        }
    }

    private static JsonNode parseQuestionsRootFromFragments(String json, ObjectMapper mapper) throws IOException {
        List<String> objects = extractBalancedObjects(json);
        if (objects.isEmpty()) {
            throw new IOException("Could not recover quiz question objects from AI JSON");
        }
        List<JsonNode> parsed = new ArrayList<>();
        for (String objectJson : objects) {
            JsonNode node = tryParseObject(objectJson, mapper);
            if (node != null && node.has("questionText")) {
                parsed.add(node);
            }
        }
        if (parsed.isEmpty()) {
            throw new IOException("Could not parse any quiz questions from AI JSON fragments");
        }
        var root = mapper.createObjectNode();
        var array = mapper.createArrayNode();
        parsed.forEach(array::add);
        root.set("questions", array);
        return root;
    }

    private static JsonNode tryParseObject(String objectJson, ObjectMapper mapper) {
        List<String> candidates = List.of(objectJson, repairJson(objectJson));
        for (String candidate : candidates) {
            try {
                return mapper.readTree(candidate);
            } catch (JsonProcessingException ignored) {
                // try next repair pass
            }
        }
        return null;
    }

    static List<String> extractBalancedObjects(String json) {
        List<String> objects = new ArrayList<>();
        int questionsIdx = json.indexOf("\"questions\"");
        int scanFrom = questionsIdx >= 0 ? json.indexOf('[', questionsIdx) : json.indexOf('[');
        if (scanFrom < 0) {
            scanFrom = 0;
        }
        for (int i = scanFrom; i < json.length(); i++) {
            if (json.charAt(i) != '{') {
                continue;
            }
            int end = findMatchingBrace(json, i);
            if (end > i) {
                objects.add(json.substring(i, end + 1));
                i = end;
            }
        }
        return objects;
    }

    private static int findMatchingBrace(String text, int start) {
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int i = start; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch == '\\') {
                    escaped = true;
                } else if (ch == '"') {
                    inString = false;
                }
                continue;
            }
            if (ch == '"') {
                inString = true;
                continue;
            }
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return -1;
    }
}
