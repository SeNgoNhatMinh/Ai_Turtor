package com.ragapi.util;

import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;
import java.util.regex.Pattern;

public final class StudentCodeAllocator {
    public static final Pattern CODE = Pattern.compile("SE\\d{6}");
    private static final int ATTEMPTS = 40;

    private StudentCodeAllocator() {
    }

    public static String allocate(Predicate<String> alreadyUsed) {
        for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
            String code = "SE" + String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
            if (!alreadyUsed.test(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Không cấp được mã sinh viên duy nhất");
    }

    public static boolean isStudentCode(String value) {
        return value != null && CODE.matcher(value).matches();
    }
}
