package com.ragapi.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class StudyActivityMath {

    private static final String[] WEEKDAY_LABELS = {"", "T2", "T3", "T4", "T5", "T6", "T7", "CN"};

    private StudyActivityMath() {
    }

    static int streakDays(Set<LocalDate> activeDays, LocalDate today) {
        if (activeDays == null || activeDays.isEmpty() || today == null) return 0;
        LocalDate cursor = activeDays.contains(today) ? today : today.minusDays(1);
        if (!activeDays.contains(cursor)) return 0;
        int streak = 0;
        while (activeDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    static int improvementPercent(List<Integer> oldestFirst) {
        if (oldestFirst == null || oldestFirst.size() < 2) return 0;
        Integer first = oldestFirst.get(0);
        Integer last = oldestFirst.get(oldestFirst.size() - 1);
        if (first == null || last == null) return 0;
        return last - first;
    }

    static Integer latestPercent(List<Integer> oldestFirst) {
        if (oldestFirst == null || oldestFirst.isEmpty()) return null;
        for (int index = oldestFirst.size() - 1; index >= 0; index--) {
            Integer value = oldestFirst.get(index);
            if (value != null) return value;
        }
        return null;
    }

    static List<Map<String, Object>> week(Set<LocalDate> activeDays, LocalDate today) {
        List<Map<String, Object>> days = new ArrayList<>();
        if (today == null) return days;
        for (int offset = 6; offset >= 0; offset--) {
            LocalDate date = today.minusDays(offset);
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", date.toString());
            day.put("label", WEEKDAY_LABELS[date.getDayOfWeek().getValue()]);
            day.put("active", activeDays != null && activeDays.contains(date));
            days.add(day);
        }
        return days;
    }
}
