package com.ragapi.config;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
public class RagRetrievalExecutorConfiguration {

    @Bean(name = "ragRetrievalExecutor")
    public Executor ragRetrievalExecutor(
            @Value("${rag.retrieval.parallel.core-pool-size:3}") int corePoolSize,
            @Value("${rag.retrieval.parallel.max-pool-size:6}") int maxPoolSize,
            @Value("${rag.retrieval.parallel.queue-capacity:64}") int queueCapacity
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Math.max(1, corePoolSize));
        executor.setMaxPoolSize(Math.max(Math.max(1, corePoolSize), maxPoolSize));
        executor.setQueueCapacity(Math.max(1, queueCapacity));
        executor.setThreadNamePrefix("rag-retrieval-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setTaskDecorator(mdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    private TaskDecorator mdcTaskDecorator() {
        return runnable -> {
            Map<String, String> context = MDC.getCopyOfContextMap();
            return () -> {
                Map<String, String> previous = MDC.getCopyOfContextMap();
                try {
                    if (context == null) MDC.clear();
                    else MDC.setContextMap(context);
                    runnable.run();
                } finally {
                    if (previous == null) MDC.clear();
                    else MDC.setContextMap(previous);
                }
            };
        };
    }
}
