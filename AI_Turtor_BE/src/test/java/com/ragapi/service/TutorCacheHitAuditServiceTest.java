package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.TutorCacheHitMetadata;
import com.ragapi.entity.TutorCacheHitAudit;
import com.ragapi.repository.TutorCacheHitAuditRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TutorCacheHitAuditServiceTest {
    @Mock
    private TutorCacheHitAuditRepository repository;
    @Mock
    private MongoTemplate mongoTemplate;
    @InjectMocks
    private TutorCacheHitAuditService service;

    @Test
    void completeHitPersistsFinalTimingAndThirtyDayExpiry() {
        CourseRagAnswer answer = CourseRagAnswer.builder()
                .answer("cached")
                .cacheHitMetadata(TutorCacheHitMetadata.builder()
                        .hitType("SEMANTIC_EARLY")
                        .matchedCacheId("cache-1")
                        .similarity(0.98)
                        .cacheLookupMs(12L)
                        .courseId("CEA201")
                        .classId("CEA201-01")
                        .build())
                .build();

        service.completeHit(answer, System.nanoTime());

        ArgumentCaptor<TutorCacheHitAudit> captor = ArgumentCaptor.forClass(TutorCacheHitAudit.class);
        verify(repository, timeout(1000)).save(captor.capture());
        TutorCacheHitAudit audit = captor.getValue();
        assertThat(audit.getMatchedCacheId()).isEqualTo("cache-1");
        assertThat(audit.getCacheLookupMs()).isEqualTo(12L);
        assertThat(audit.getBackendProcessingMs()).isGreaterThanOrEqualTo(0L);
        assertThat(audit.getExpiresAt()).isAfterOrEqualTo(audit.getCreatedAt().plusDays(30));
    }
}
