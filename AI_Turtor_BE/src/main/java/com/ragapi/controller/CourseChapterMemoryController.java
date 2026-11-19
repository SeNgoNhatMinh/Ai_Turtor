package com.ragapi.controller;

import com.ragapi.harness.curriculum.CourseChapterExcerptCache;
import com.ragapi.harness.curriculum.CourseIndexedChunkLoader;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tutor/chapter-memory")
@Tag(name = "Chapter memory", description = "Indexed chapter text currently held in RAM")
public class CourseChapterMemoryController {

    private final CourseChapterExcerptCache chapterExcerptCache;
    private final CourseIndexedChunkLoader indexedChunkLoader;

    @GetMapping
    @Operation(summary = "List chapter excerpts currently stored in RAM for one course")
    public ResponseEntity<?> snapshot(@RequestParam("courseId") String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseId is required"));
        }
        return ResponseEntity.ok(snapshotOf(courseId.trim()));
    }

    @PostMapping("/reload")
    @Operation(summary = "Copy the course's indexed chapter chunks into RAM again")
    public ResponseEntity<?> reload(@RequestParam("courseId") String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseId is required"));
        }
        try {
            indexedChunkLoader.reloadCourse(courseId.trim());
            return ResponseEntity.ok(snapshotOf(courseId.trim()));
        } catch (RuntimeException error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Không nạp lại được chunk đã index vào RAM."));
        }
    }

    private Map<String, Object> snapshotOf(String courseId) {
        List<CourseChapterExcerptCache.ChapterExcerpt> chapters = chapterExcerptCache.chapters(courseId);
        int characters = chapters.stream().mapToInt(chapter -> chapter.text() == null ? 0 : chapter.text().length()).sum();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("courseId", courseId);
        body.put("loaded", chapterExcerptCache.isLoaded(courseId));
        body.put("chapterCount", chapters.size());
        body.put("excerptLimit", CourseChapterExcerptCache.EXCERPT_LIMIT);
        body.put("characters", characters);
        body.put("chapters", chapters.stream().map(chapter -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("chapterKey", chapter.chapterKey());
            item.put("title", chapter.title());
            item.put("characters", chapter.text() == null ? 0 : chapter.text().length());
            item.put("materialId", chapter.materialId());
            item.put("text", chapter.text());
            return item;
        }).toList());
        return body;
    }
}
