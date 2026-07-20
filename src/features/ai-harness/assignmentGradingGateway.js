import { assignmentApi } from '../../services/assignmentApi';
import {
  N8N_ASSIGNMENT_GRADING_ENABLED,
  N8N_ENABLED,
} from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';

const isAssignmentGradingHarnessEnabled = () => (
  N8N_ENABLED && N8N_ASSIGNMENT_GRADING_ENABLED
);

export const assignmentGradingGateway = {
  async gradeSubmission({ submissionId, teacherId, signal }) {
    if (isAssignmentGradingHarnessEnabled()) {
      // This mutation can be expensive and is not known to be idempotent. Do
      // not replay it through Spring Boot after an n8n timeout.
      return n8nService.gradeAssignmentSubmission(
        { submissionId, teacherId },
        { signal },
      );
    }

    return assignmentApi.aiGradeAssignmentSubmission(submissionId, teacherId, { signal });
  },
};
