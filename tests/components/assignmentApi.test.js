import { describe, expect, it } from 'vitest';
import { assertAssignmentUploadReceipt } from '../../src/services/assignmentApi';

describe('assertAssignmentUploadReceipt', () => {
  it('accepts a real assignment entity returned by the backend', () => {
    const response = { id: 'assignment-1', title: 'OOP exercise' };

    expect(assertAssignmentUploadReceipt(response)).toBe(response);
  });

  it('rejects a success-shaped response without an assignment id', () => {
    expect(() => assertAssignmentUploadReceipt({ message: 'Published' })).toThrowError(
      expect.objectContaining({
        code: 'INVALID_ASSIGNMENT_UPLOAD_RESPONSE',
        status: 502,
      }),
    );
  });
});
