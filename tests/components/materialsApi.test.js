import { describe, expect, it } from 'vitest';
import { assertMaterialUploadReceipt } from '../../src/services/materialsApi';

describe('assertMaterialUploadReceipt', () => {
  it('accepts a backend response containing a material id', () => {
    const response = { materialId: 'material-123', status: 'PROCESSING' };

    expect(assertMaterialUploadReceipt(response)).toBe(response);
  });

  it('accepts the legacy document id response field', () => {
    const response = { documentId: 'document-123' };

    expect(assertMaterialUploadReceipt(response)).toBe(response);
  });

  it('rejects an unconfirmed success-shaped response', () => {
    expect(() => assertMaterialUploadReceipt({ message: 'Accepted' })).toThrowError(
      expect.objectContaining({
        code: 'INVALID_MATERIAL_UPLOAD_RESPONSE',
        status: 502,
      }),
    );
  });
});
