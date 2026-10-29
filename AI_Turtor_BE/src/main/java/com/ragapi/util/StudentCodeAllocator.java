package com.ragapi.util;

import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;
import java.util.regex.Pattern;

public final class StudentCodeAllocator {
    public static final Pattern CODE = Pattern.compile("SE\\d{6}");
    public static final String STUDENT_PREFIX = "SE";
    public static final String TEACHER_PREFIX = "GV";
    public static final String SENIOR_PREFIX = "SR";
    private static final int ATTEMPTS = 40;

    private StudentCodeAllocator() {
    }

    public static String allocate(Predicate<String> alreadyUsed) {
        return allocateForRole("STUDENT", alreadyUsed);
    }

    public static String allocateForRole(String role, Predicate<String> alreadyUsed) {
        String prefix = prefixForRole(role);
        if (prefix == null) {
            throw new IllegalArgumentException("Role does not use an account code: " + role);
        }
        for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
            String code = prefix + String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
            if (!alreadyUsed.test(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Không cấp được mã tài khoản duy nhất");
    }

    public static String prefixForRole(String role) {
        if (role == null) return null;
        return switch (role.trim().toUpperCase()) {
            case "STUDENT" -> STUDENT_PREFIX;
            case "TEACHER", "MENTOR" -> TEACHER_PREFIX;
            case "SENIOR_MENTOR" -> SENIOR_PREFIX;
            default -> null;
        };
    }

    public static boolean matchesRole(String value, String role) {
        String prefix = prefixForRole(role);
        return prefix != null && value != null && value.matches(prefix + "\\d{6}");
    }

    public static boolean isStudentCode(String value) {
        return value != null && CODE.matcher(value).matches();
    }
}
