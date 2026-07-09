import { Button, Card, Col, Form, Input, Row, Tag } from 'antd';
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'View details' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
];

function TermsTab({ form, semesters, onCreate, onReload, onAction }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Create New Term" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="semesterCode" label="Term Code" rules={[{ required: true, message: 'Enter a term code' }]}>
              <Input placeholder="Example: SEM5, SUMMER2026" />
            </Form.Item>
            <Form.Item name="name" label="Term Name" rules={[{ required: true, message: 'Enter a term name' }]}>
              <Input placeholder="Summer 2026" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Add Term</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Term List" hoverable extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />}>Reload</Button>}>
          <DataTable
            data={semesters || []}
            columns={[
              { accessorKey: 'semesterCode', header: 'Code' },
              { accessorKey: 'name', header: 'Name' },
              { 
                accessorKey: 'status', 
                header: 'Status', 
                cell: ({ row }) => {
                  const value = row.getValue('status');
                  return <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value}</Tag>;
                }
              },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <EntityActionMenu
                    items={actionItems}
                    onAction={(key, meta) => onAction('semester', row.original, key, meta)}
                    ariaLabel="Term actions"
                  />
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

export default TermsTab;
