import { RefreshCw, Trash2 } from 'lucide-react';
import { Button, Card, Space, Table } from 'antd';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import StatusLabel from '../../../../components/common/StatusLabel';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { findPersonById, getPersonDisplayName, getPersonEmail } from '../../../../utils/displayNames';

export default function AdminEscalationsTab({ escalations, users }) {
  const columns = [
    {
      title: 'Sinh viên',
      dataIndex: 'userId',
      key: 'userId',
      render: (value, record) => {
        const account = findPersonById(users, record.studentId || value);
        const displayRecord = { ...(account || {}), ...record };
        const email = getPersonEmail(displayRecord);
        return (
          <div className="entity-name-cell">
            <strong>{getPersonDisplayName(displayRecord, 'Sinh viên')}</strong>
            {email && <span>{email}</span>}
          </div>
        );
      },
    },
    { title: 'Câu hỏi', dataIndex: 'question', key: 'question', ellipsis: true, render: (value) => value || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (value) => <StatusLabel status={value || 'PENDING'} />,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <EntityActionMenu
          items={[{ key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa yêu cầu', danger: true }]}
          ariaLabel="Thao tác yêu cầu hỗ trợ"
          onAction={(_, meta) => confirmDanger({
            title: 'Xóa yêu cầu hỗ trợ này?',
            content: 'Yêu cầu sẽ bị xóa khỏi hàng chờ quản trị.',
            anchorRect: meta?.anchorRect,
            onOk: () => escalations.remove(record.id),
          })}
        />
      ),
    },
  ];

  return (
    <Card hoverable>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={escalations.reload} icon={<RefreshCw size={14} />}>Làm mới</Button>
      </Space>
      <Table
        dataSource={escalations.list}
        columns={columns}
        rowKey="id"
        loading={escalations.loading}
        pagination={{ pageSize: 8 }}
        size="middle"
        scroll={{ x: 680 }}
        locale={{ emptyText: 'Không có yêu cầu hỗ trợ.' }}
      />
    </Card>
  );
}
