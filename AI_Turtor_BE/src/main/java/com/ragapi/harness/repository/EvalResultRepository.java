package com.ragapi.harness.repository;

import com.ragapi.harness.entity.EvalResult;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface EvalResultRepository extends MongoRepository<EvalResult, String> {
    List<EvalResult> findByEvalRunIdOrderByCreatedAtAsc(String evalRunId);
}
