import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Select, Modal, Popconfirm, Tag, Space, Tabs, Typography } from 'antd';
import { CreditCard, Zap, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';

const { Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

function AdminBilling({ adminPlans = [], triggerToast }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [formAssign] = Form.useForm();

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // ── Loaders ──────────────────────────────────────────────
  const loadSubscriptions = async () => {
    setSubsLoading(true);
    const data = await apiService.getAdminSubscriptions();
    setSubscriptions(Array.isArray(data) ? data : []);
    setSubsLoading(false);
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleDeletePlan = async (planId) => {
    await apiService.deleteSubscriptionPlan(planId);
    triggerToast('Plan deleted.');
  };
  const handleAssignSub = async (values) => {
    await apiService.assignSubscription(values);
    triggerToast('Plan assigned to user.');
    setAssignModal(false);
    formAssign.resetFields();
    loadSubscriptions();
  };
  const handleDeleteSub = async (subId) => {
    await apiService.deleteSubscription(subId);
    triggerToast('Subscription deleted.');
    setSubscriptions(prev => prev.filter(s => s.id !== subId));
  };

  // ── Columns ──────────────────────────────────────────────
  const planColumns = [
    { title: 'Plan Name', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v) => <Tag color="gold">{v}</Tag> },
    {
      title: 'Price', dataIndex: 'price', key: 'price',
      render: (v, r) => <Text strong style={{ color: '#F37021' }}>{(v || 0).toLocaleString('vi-VN')} {r.currency || 'VND'}</Text>
    },
    { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this plan?" onConfirm={() => handleDeletePlan(record.id || record.code)}>
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  const subColumns = [
    { title: 'User ID', dataIndex: 'userId', key: 'userId', ellipsis: true },
    { title: 'Plan', dataIndex: 'planCode', key: 'plan', render: (v) => <Tag color="gold">{v || '—'}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || '—'}</Tag> },
    { title: 'Start Date', dataIndex: 'startAt', key: 'start', render: (v) => v ? new Date(v).toLocaleDateString('vi-VN') : '—' },
    {
      title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this subscription?" onConfirm={() => handleDeleteSub(record.id)}>
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="portal-view">
      <Tabs defaultActiveKey="plans" type="card">
        {/* Plans */}
        <TabPane
          tab={<><CreditCard size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Plans ({(Array.isArray(adminPlans) ? adminPlans : []).length})</>}
          key="plans"
        >
          <Card hoverable>
            <Table
              dataSource={Array.isArray(adminPlans) ? adminPlans : []}
              columns={planColumns}
              rowKey={r => r.id || r.code}
              pagination={false}
              size="middle"
            />
          </Card>
        </TabPane>

        {/* Subscriptions */}
        <TabPane
          tab={<><Zap size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Subscriptions ({subscriptions.length})</>}
          key="subscriptions"
        >
          <Card hoverable>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setAssignModal(true)}>Assign Plan to User</Button>
              <Button onClick={loadSubscriptions} icon={<RefreshCw size={14} />}>Reload</Button>
            </Space>
            <Table
              dataSource={subscriptions}
              columns={subColumns}
              rowKey="id"
              loading={subsLoading}
              pagination={{ pageSize: 8 }}
              size="middle"
              locale={{ emptyText: 'No subscriptions yet' }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Assign subscription modal */}
      <Modal title="Assign Plan to User" open={assignModal} onCancel={() => setAssignModal(false)} footer={null} destroyOnClose>
        <Form form={formAssign} layout="vertical" onFinish={handleAssignSub}>
          <Form.Item name="userId" label="User ID" rules={[{ required: true }]}>
            <Input placeholder="student-a1" />
          </Form.Item>
          <Form.Item name="planCode" label="Plan" rules={[{ required: true }]}>
            <Select placeholder="Choose a plan">
              {(Array.isArray(adminPlans) ? adminPlans : []).map(p => (
                <Option key={p.code} value={p.code}>{p.name} ({(p.price || 0).toLocaleString('vi-VN')} VND)</Option>
              ))}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Confirm Assignment</Button>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminBilling;
