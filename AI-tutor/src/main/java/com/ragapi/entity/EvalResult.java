package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "eval_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvalResult {
    @Id
    private String id;
    private String evalRunId;
    private String goldQaId;
    private String courseId;
    private String chapter;
    private String question;
    private String goldAnswer;
    private String aiAnswer;
    private Double score;
    private Double ragConfidence;
    private Boolean passed;
    private Boolean hallucinated;
    private Map<String, Double> criterionScores;
    private LocalDateTime createdAt;
}
