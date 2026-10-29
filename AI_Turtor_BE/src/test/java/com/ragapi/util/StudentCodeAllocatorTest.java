package com.ragapi.util;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudentCodeAllocatorTest {

    @Test
    void allocatesSixDigitStudentCode() {
        String code = StudentCodeAllocator.allocate(value -> false);
        assertTrue(StudentCodeAllocator.isStudentCode(code));
        assertEquals(8, code.length());
    }

    @Test
    void skipsCodesThatAreAlreadyUsed() {
        Set<String> used = new HashSet<>();
        String first = StudentCodeAllocator.allocate(used::contains);
        used.add(first);
        String second = StudentCodeAllocator.allocate(used::contains);
        assertTrue(StudentCodeAllocator.isStudentCode(second));
        assertTrue(!first.equals(second));
    }

    @Test
    void allocatesTeacherAndSeniorPrefixes() {
        String teacher = StudentCodeAllocator.allocateForRole("TEACHER", value -> false);
        String senior = StudentCodeAllocator.allocateForRole("SENIOR_MENTOR", value -> false);
        assertTrue(teacher.startsWith("GV"));
        assertTrue(senior.startsWith("SR"));
        assertTrue(StudentCodeAllocator.matchesRole(teacher, "TEACHER"));
        assertTrue(StudentCodeAllocator.matchesRole(senior, "SENIOR_MENTOR"));
        assertTrue(!StudentCodeAllocator.matchesRole(teacher, "STUDENT"));
    }
}
