package com.ragapi.controller;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/diagnostics")
@RequiredArgsConstructor
public class AdminElasticsearchDiagnosticsController {

    private final ElasticsearchClient elasticsearchClient;

    @Value("${elasticsearch.index}")
    private String index;

    @GetMapping("/elasticsearch")
    public ResponseEntity<Map<String, Object>> checkElasticsearch() {
        long startedAt = System.nanoTime();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checkedAt", Instant.now().toString());
        result.put("index", index);

        try {
            var info = elasticsearchClient.info();
            boolean indexExists = elasticsearchClient.indices()
                    .exists(ExistsRequest.of(request -> request.index(index)))
                    .value();

            result.put("status", "UP");
            result.put("clusterName", info.clusterName());
            result.put("nodeName", info.name());
            result.put("version", info.version().number());
            result.put("indexExists", indexExists);
            result.put("documentCount", indexExists
                    ? elasticsearchClient.count(request -> request.index(index)).count()
                    : 0L);
            result.put("responseTimeMs", elapsedMillis(startedAt));
            return ResponseEntity.ok(result);
        } catch (Exception exception) {
            result.put("status", "DOWN");
            result.put("responseTimeMs", elapsedMillis(startedAt));
            result.put("error", safeMessage(exception));
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(result);
        }
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? exception.getClass().getSimpleName()
                : message;
    }
}
