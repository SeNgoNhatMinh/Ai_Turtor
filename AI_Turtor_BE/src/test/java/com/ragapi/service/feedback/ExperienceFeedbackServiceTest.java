package com.ragapi.service.feedback;

import com.ragapi.entity.ExperienceFeedback;
import com.ragapi.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExperienceFeedbackServiceTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ExperienceFeedbackService service = new ExperienceFeedbackService(mongoTemplate, users);

    private ExperienceFeedback valid() {
        return ExperienceFeedback.builder().overall(4).aiQuality(5).speed(3).easeOfUse(4).recommend(9).build();
    }

    @Test
    void savesUnderTheCallerIdAndDropsUnknownFeatures() {
        when(users.findById("student-1")).thenReturn(Optional.empty());
        when(mongoTemplate.save(any(ExperienceFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ExperienceFeedback input = valid();
        input.setUserId("someone-else");
        input.setFeaturesUsed(List.of("chat", "QUIZ", "HACK"));
        input.setHadIssues(false);
        input.setIssueDetail("ignored because no issue");

        ExperienceFeedback saved = service.submit("student-1", input);

        assertThat(saved.getUserId()).isEqualTo("student-1");
        assertThat(saved.getFeaturesUsed()).containsExactly("CHAT", "QUIZ");
        assertThat(saved.getIssueDetail()).isNull();
    }

    @Test
    void rejectsMissingOrOutOfRangeRatings() {
        ExperienceFeedback missing = valid();
        missing.setSpeed(null);
        assertThatThrownBy(() -> service.submit("student-1", missing)).isInstanceOf(IllegalArgumentException.class);

        ExperienceFeedback outOfRange = valid();
        outOfRange.setRecommend(11);
        assertThatThrownBy(() -> service.submit("student-1", outOfRange)).isInstanceOf(IllegalArgumentException.class);
    }
}
