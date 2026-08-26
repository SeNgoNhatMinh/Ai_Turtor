import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/n8nClient', () => ({
  N8N_ENABLED: true,
  N8N_TUTOR_V2_ENABLED: true,
}));

vi.mock('../../src/services/n8nService', () => ({
  n8nService: {
    analyzeTutorV2Coverage: vi.fn(),
    submitTutorV2GoldQa: vi.fn(),
    examTutorV2GoldQa: vi.fn(),
    submitTutorV2Rubric: vi.fn(),
    approveTutorV2GoldQa: vi.fn(),
    approveTutorV2Rubric: vi.fn(),
    runTutorV2Evaluation: vi.fn(),
  },
}));

vi.mock('../../src/services/expertTrainingApi', () => ({
  expertTrainingApi: {
    analyzeCoverage: vi.fn(),
    submitGoldQa: vi.fn(),
    examGoldQa: vi.fn(),
    submitRubric: vi.fn(),
    reviewGoldQa: vi.fn(),
    reviewRubric: vi.fn(),
    startEvaluation: vi.fn(),
  },
}));

import { expertTrainingGateway } from '../../src/features/ai-harness/expertTrainingGateway';
import { expertTrainingApi } from '../../src/services/expertTrainingApi';
import { n8nService } from '../../src/services/n8nService';

describe('expertTrainingGateway', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always saves DRAFT via API first; exam=true then runs exam endpoint', async () => {
    expertTrainingApi.analyzeCoverage.mockResolvedValue([
      { id: 'gap-1', courseId: 'PFP191', chapter: 'Recursion', status: 'OPEN' },
    ]);
    expertTrainingApi.submitGoldQa.mockResolvedValue({
      id: 'gold-1',
      courseId: 'PFP191',
      usage: 'TRAINING',
      status: 'DRAFT',
    });
    n8nService.examTutorV2GoldQa.mockResolvedValue({
      id: 'gold-1',
      courseId: 'PFP191',
      usage: 'TRAINING',
      status: 'BASELINE_EXAMINED',
      examUsedTeachingNote: false,
    });

    const gaps = await expertTrainingGateway.analyzeCoverage({ courseId: 'PFP191' });
    const submitted = await expertTrainingGateway.submitGoldQa({
      courseId: 'PFP191',
      question: 'Recursion là gì?',
    }, { exam: true });

    expect(gaps).toHaveLength(1);
    expect(submitted).toMatchObject({ id: 'gold-1', status: 'BASELINE_EXAMINED' });
    expect(expertTrainingApi.submitGoldQa).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'Recursion là gì?' }),
      { exam: false },
    );
    expect(n8nService.submitTutorV2GoldQa).not.toHaveBeenCalled();
    expect(n8nService.examTutorV2GoldQa).toHaveBeenCalledWith({ goldQaId: 'gold-1' });
  });

  it('defaults submitGoldQa to draft-only without exam', async () => {
    expertTrainingApi.submitGoldQa.mockResolvedValue({
      id: 'gold-plain',
      status: 'DRAFT',
    });

    const saved = await expertTrainingGateway.submitGoldQa({
      courseId: 'PRJ301',
      question: 'JSP là gì?',
    });

    expect(saved).toMatchObject({ id: 'gold-plain', status: 'DRAFT' });
    expect(n8nService.examTutorV2GoldQa).not.toHaveBeenCalled();
  });

  it('saves draft list items via API with exam=false and skips exam', async () => {
    expertTrainingApi.submitGoldQa.mockResolvedValue({
      id: 'gold-draft-1',
      status: 'DRAFT',
      question: 'Servlet lifecycle gồm gì?',
    });

    const saved = await expertTrainingGateway.submitGoldQa({
      courseId: 'PRJ301',
      question: 'Servlet lifecycle gồm gì?',
      goldAnswer: '- init\n- service\n- destroy',
    }, { exam: false });

    expect(saved).toMatchObject({ id: 'gold-draft-1', status: 'DRAFT' });
    expect(expertTrainingApi.submitGoldQa).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'Servlet lifecycle gồm gì?' }),
      { exam: false },
    );
    expect(n8nService.examTutorV2GoldQa).not.toHaveBeenCalled();
    expect(n8nService.submitTutorV2GoldQa).not.toHaveBeenCalled();
  });

  it('routes Senior approval through n8n but keeps rejection on the canonical API', async () => {
    n8nService.approveTutorV2GoldQa.mockResolvedValue({
      id: 'gold-1',
      courseId: 'PFP191',
      status: 'INDEXED',
      usage: 'TRAINING',
    });
    expertTrainingApi.reviewGoldQa.mockResolvedValue({
      id: 'gold-2',
      courseId: 'PFP191',
      status: 'REJECTED',
      usage: 'TRAINING',
    });

    const approved = await expertTrainingGateway.reviewGoldQa('gold-1', 'approve', {
      reviewerId: 'senior-1',
      reviewerRole: 'SENIOR_MENTOR',
    });
    const rejected = await expertTrainingGateway.reviewGoldQa('gold-2', 'reject', {
      reviewerId: 'senior-1',
      reviewerRole: 'SENIOR_MENTOR',
      rejectionReason: 'Cần bám sát giáo trình hơn.',
    });

    expect(approved.status).toBe('INDEXED');
    expect(n8nService.approveTutorV2GoldQa).toHaveBeenCalledWith(expect.objectContaining({
      goldQaId: 'gold-1',
    }));
    expect(rejected.status).toBe('REJECTED');
    expect(expertTrainingApi.reviewGoldQa).toHaveBeenCalledWith(
      'gold-2',
      'reject',
      expect.objectContaining({ rejectionReason: expect.any(String) }),
    );
  });
});
