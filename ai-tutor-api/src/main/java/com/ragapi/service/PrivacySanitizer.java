package com.ragapi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Redacts common credentials and student PII before text leaves the backend
 * for an AI provider. It intentionally does not modify the original data
 * stored by the application's business services.
 */
@Service
public class PrivacySanitizer {

    private static final List<RedactionRule> RULES = List.of(
            rule("[JWT]", "(?i)\\bBearer\\s+eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}"),
            rule("[JWT]", "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b"),
            rule("[API_KEY]", "\\bsk-(?:or-v1-)?[A-Za-z0-9_-]{20,}\\b"),
            rule("[EMAIL]", "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"),
            rule("[STUDENT_ID]", "(?i)\\b(?:MSSV|STUDENT(?:_?ID)?)\\s*[:#=-]?\\s*[A-Z]{0,4}\\d{5,12}\\b"),
            rule("[STUDENT_ID]", "(?i)\\b(?:SE|HE|QE|SS|SA|IA|DE|GD)\\d{6}\\b"),
            rule("[PHONE]", "(?<![A-Za-z0-9])(?:\\+?84|0)(?:[ .-]?\\d){9,10}(?![A-Za-z0-9])"),
            rule("[NATIONAL_ID]", "(?<!\\d)\\d{12}(?!\\d)"),
            rule("[IP_ADDRESS]", "(?<!\\d)(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?!\\d)")
    );

    private final boolean enabled;

    public PrivacySanitizer(@Value("${privacy.ai-sanitization.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public String sanitize(String text) {
        if (!enabled || text == null || text.isEmpty()) {
            return text;
        }
        String sanitized = text;
        for (RedactionRule rule : RULES) {
            sanitized = rule.pattern().matcher(sanitized).replaceAll(rule.replacement());
        }
        return sanitized;
    }

    private static RedactionRule rule(String replacement, String regex) {
        return new RedactionRule(Pattern.compile(regex), replacement);
    }

    private record RedactionRule(Pattern pattern, String replacement) {
    }
}
