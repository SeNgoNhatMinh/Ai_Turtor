package com.ragapi.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StudyLessonTitlesTest {

    @Test
    void keepsChapterLessonsAndWritesShortVietnameseLabels() {
        List<StudyLessonTitles.Chip> chips = StudyLessonTitles.chips(List.of(
                "Chapter 1: Introducing Java Platform, Enterprise Edition",
                "Understanding the Basic Web Application Structure",
                "Chapter 2: Using Web Containers",
                "Choosing a Web Container",
                "Installing Tomcat on Your Machine",
                "Chapter 3: Writing Your First Servlet",
                "Creating a Servlet Class"
        ));

        assertEquals(List.of(
                "Bài 1: Giới thiệu nền tảng Java EE",
                "Bài 2: Sử dụng web container",
                "Bài 3: Viết Servlet đầu tiên"
        ), chips.stream().map(StudyLessonTitles.Chip::label).toList());
        assertEquals(
                "Chapter 1: Introducing Java Platform, Enterprise Edition",
                chips.get(0).sourceTitle()
        );
        assertEquals(
                "Bài 1: Giới thiệu nền tảng Java EE || Chapter 1: Introducing Java Platform, Enterprise Edition",
                chips.get(0).markdownLine()
        );
    }

    @Test
    void keepsVietnameseLessonWording() {
        List<String> lines = StudyLessonTitles.welcomeLines(List.of(
                "Tổng quan về Pascal",
                "Cấu trúc rẽ nhánh"
        ));

        assertEquals(List.of(
                "Bài 1: Tổng quan về Pascal || Tổng quan về Pascal",
                "Bài 2: Cấu trúc rẽ nhánh || Cấu trúc rẽ nhánh"
        ), lines);
    }

    @Test
    void writesVietnameseLabelsForLaterJavaEeChapters() {
        List<String> labels = StudyLessonTitles.chips(List.of(
                "Chapter:4 Using JSPs to Display Content",
                "Chapter 5: Maintaining State Using Sessions",
                "Chapter 6: Using the Expression Language in JSPs",
                "Chapter 8: Writing Custom Tag and Function Libraries"
        )).stream().map(StudyLessonTitles.Chip::label).toList();

        assertEquals(List.of(
                "Bài 4: Dùng JSP để hiển thị nội dung",
                "Bài 5: Duy trì trạng thái bằng session",
                "Bài 6: Dùng Expression Language trong JSP",
                "Bài 8: Viết thư viện thẻ và hàm tùy chỉnh"
        ), labels);
    }

    @Test
    void dropsNumberedSubsectionsWhenAChapterLessonExists() {
        List<String> lines = StudyLessonTitles.welcomeLines(List.of(
                "1 INTRODUCTION",
                "1.1 WHAT IS AN OPERATING SYSTEM?",
                "1.2 HISTORY OF OPERATING SYSTEMS"
        ));

        assertEquals(List.of("Bài 1: Giới thiệu || 1 INTRODUCTION"), lines);
    }
}
