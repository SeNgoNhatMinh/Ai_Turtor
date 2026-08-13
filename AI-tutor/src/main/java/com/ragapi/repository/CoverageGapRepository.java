package com.ragapi.repository;

import com.ragapi.entity.CoverageGap;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface CoverageGapRepository extends MongoRepository<CoverageGap, String> {
    List<CoverageGap> findByCourseIdOrderByDetectedAtDesc(String courseId);
    Optional<CoverageGap> findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(
            String courseId, String chapter, List<String> statuses);
}
