package com.ragapi.service.aiworker;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Bounded in-process executor for independent AI tasks.
 *
 * Keep this separate from Spring MVC's request executor so AI fan-out cannot
 * consume every request-handling thread. Values are intentionally conservative
 * and can be overridden through configuration properties.
 */
@Configuration
public class AiWorkerExecutorConfig {

    @Bean(name = "aiWorkerExecutor")
    public ThreadPoolTaskExecutor aiWorkerExecutor(
            org.springframework.core.env.Environment environment
    ) {
        int coreSize = environment.getProperty("ai.worker.pool.core-size", Integer.class, 3);
        int maxSize = environment.getProperty("ai.worker.pool.max-size", Integer.class, 6);
        int queueCapacity = environment.getProperty("ai.worker.pool.queue-capacity", Integer.class, 24);

        if (coreSize < 1 || maxSize < coreSize || queueCapacity < 1) {
            throw new IllegalArgumentException(
                    "Invalid AI worker pool settings: require core-size >= 1, max-size >= core-size, queue-capacity >= 1");
        }

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(coreSize);
        executor.setMaxPoolSize(maxSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("ai-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        return executor;
    }
}
