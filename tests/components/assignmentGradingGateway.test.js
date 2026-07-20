import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/n8nClient', () => ({
  N8N_ENABLED: true,
  N8N_ASSIGNMENT_GRADING_ENABLED: true,
}));

vi.mock('../../src/services/n8nService', () => ({
  n8nService: { gradeAssignmentSubmission: vi.fn() },
}));

vi.mock('../../src/services/assignmentApi', () => ({
  assignmentApi: { aiGradeAssignmentSubmission: vi.fn() },
}));

import { assignmentGradingGateway } from '../../src/features/ai-harness/assignmentGradingGateway';
import { assignmentApi } from '../../src/services/assignmentApi';
import { n8nService } from '../../src/services/n8nService';

describe('assignment AI grading gateway', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the configured n8n workflow without replaying through the backend', async () => {
    n8nService.gradeAssignmentSubmission.mockResolvedValue({
      id: 'submission-1',
      aiGradingStatus: 'SUGGESTED',
      aiSuggestedScore: 8,
    });

    const result = await assignmentGradingGateway.gradeSubmission({
      submissionId: 'submission-1',
      teacherId: 'teacher-1',
    });

    expect(result.aiSuggestedScore).toBe(8);
    expect(n8nService.gradeAssignmentSubmission).toHaveBeenCalledWith(
      { submissionId: 'submission-1', teacherId: 'teacher-1' },
      { signal: undefined },
    );
    expect(assignmentApi.aiGradeAssignmentSubmission).not.toHaveBeenCalled();
  });

  it('does not duplicate the mutation when the n8n request fails', async () => {
    n8nService.gradeAssignmentSubmission.mockRejectedValue(new Error('timeout'));

    await expect(assignmentGradingGateway.gradeSubmission({
      submissionId: 'submission-1',
      teacherId: 'teacher-1',
    })).rejects.toThrow('timeout');
    expect(assignmentApi.aiGradeAssignmentSubmission).not.toHaveBeenCalled();
  });
});
