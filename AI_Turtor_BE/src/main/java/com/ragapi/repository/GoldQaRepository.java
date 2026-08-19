package com.ragapi.repository;

import com.ragapi.entity.GoldQa;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface GoldQaRepository extends MongoRepository<GoldQa, String> {
    List<GoldQa> findByCourseIdOrderByCreatedAtDesc(String courseId);
    List<GoldQa> findByCourseIdAndUsageAndStatus(String courseId, String usage, String status);
    List<GoldQa> findByCourseIdAndChapterAndUsage(String courseId, String chapter, String usage);
    List<GoldQa> findByCourseIdAndChapterOrderByCreatedAtDesc(String courseId, String chapter);
}
