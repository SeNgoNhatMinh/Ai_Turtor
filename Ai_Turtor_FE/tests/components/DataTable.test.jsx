import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../../src/components/common/DataTable';

const records = Array.from({ length: 25 }, (_, index) => ({
  id: `record-${index + 1}`,
  name: `Bản ghi ${index + 1}`,
}));

describe('DataTable large collection controls', () => {
  it('mounts only the current page and navigates without losing records', () => {
    render(
      <DataTable
        data={records}
        columns={[{ accessorKey: 'name', header: 'Tên' }]}
      />,
    );

    expect(screen.getByText('Bản ghi 1')).toBeVisible();
    expect(screen.queryByText('Bản ghi 21')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(screen.getByText('Bản ghi 21')).toBeVisible();
    expect(screen.queryByText('Bản ghi 1')).not.toBeInTheDocument();
  });

  it('filters the complete collection and resets to the first result page', () => {
    render(
      <DataTable
        searchable
        searchKeys={['name']}
        searchPlaceholder="Tìm bản ghi"
        data={records}
        columns={[{ accessorKey: 'name', header: 'Tên' }]}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm bản ghi' }), {
      target: { value: 'Bản ghi 25' },
    });

    expect(screen.getByText('Bản ghi 25')).toBeVisible();
    expect(screen.getByText('1/25 kết quả')).toBeVisible();
    expect(screen.queryByText('Bản ghi 1')).not.toBeInTheDocument();
  });
});
