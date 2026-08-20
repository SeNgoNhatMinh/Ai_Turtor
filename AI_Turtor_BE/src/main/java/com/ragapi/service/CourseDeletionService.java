package com.ragapi.service;

import com.ragapi.entity.Course;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.CourseRepository;
import lombok.AllArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@AllArgsConstructor
public class CourseDeletionService {

    private static final String COURSES_COLLECTION = "courses";
    private static final String MATERIALS_COLLECTION = "course_materials";

    private final MongoTemplate mongoTemplate;
    private final CourseRepository courseRepository;
    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialLifecycleService materialLifecycleService;

    public Map<String, Long> findDependencies(String courseId) {
        Query courseQuery = Query.query(Criteria.where("courseId").is(courseId));
        Map<String, Long> dependencies = new LinkedHashMap<>();

        mongoTemplate.getCollectionNames().stream()
                .filter(name -> !COURSES_COLLECTION.equals(name))
                .sorted(Comparator.naturalOrder())
                .forEach(collectionName -> {
                    long count = mongoTemplate.count(courseQuery, collectionName);
                    if (count > 0) {
                        dependencies.put(collectionName, count);
                    }
                });

        return dependencies;
    }

    public Map<String, Object> deleteCourseCascade(Course course) throws IOException {
        String courseId = course.getCourseId();
        List<CourseMaterial> materials = materialRepository.findByCourseId(courseId);

        long deletedChunks = 0;
        long deletedVisualPages = 0;
        for (CourseMaterial material : materials) {
            Map<String, Object> result = materialLifecycleService.deleteMaterialAsSystem(courseId, material.getId());
            deletedChunks += asLong(result.get("deletedChunks"));
            deletedVisualPages += asLong(result.get("deletedVisualPages"));
        }

        Query courseQuery = Query.query(Criteria.where("courseId").is(courseId));
        Map<String, Long> deletedRecords = new LinkedHashMap<>();
        mongoTemplate.getCollectionNames().stream()
                .filter(name -> !COURSES_COLLECTION.equals(name))
                .filter(name -> !MATERIALS_COLLECTION.equals(name))
                .sorted(Comparator.naturalOrder())
                .forEach(collectionName -> {
                    long deleted = mongoTemplate.remove(courseQuery, collectionName).getDeletedCount();
                    if (deleted > 0) {
                        deletedRecords.put(collectionName, deleted);
                    }
                });

        courseRepository.delete(course);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "DELETED");
        response.put("mode", "CASCADE");
        response.put("courseId", courseId);
        response.put("deletedMaterials", materials.size());
        response.put("deletedChunks", deletedChunks);
        response.put("deletedVisualPages", deletedVisualPages);
        response.put("deletedRecords", deletedRecords);
        return response;
    }

    private long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
