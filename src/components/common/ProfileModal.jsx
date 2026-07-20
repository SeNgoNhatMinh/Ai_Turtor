import { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button } from 'antd';
import { User, Lock } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';

export default function ProfileModal({ isOpen, onClose, userId }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  
  const { profile, updateProfile, changePassword } = useProfile(userId);

  useEffect(() => {
    if (profile && isOpen) {
      profileForm.setFieldsValue({
        fullName: profile.fullName || '',
        email: profile.email || '',
      });
    }
  }, [profile, isOpen, profileForm]);

  const handleUpdateProfile = async (values) => {
    await updateProfile.mutateAsync(values);
  };

  const handleChangePassword = async (values) => {
    await changePassword.mutateAsync({
      oldPassword: values.oldPassword,
      newPassword: values.newPassword
    });
    passwordForm.resetFields();
  };

  return (
    <Modal
      title="Hồ sơ & bảo mật"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={500}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'profile',
            label: (
              <span>
                <User size={16} style={{ marginRight: 8 }} />
                Hồ sơ
              </span>
            ),
            children: (
              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleUpdateProfile}
                style={{ marginTop: 16 }}
              >
                <Form.Item
                  name="fullName"
                  label="Họ và tên"
                  rules={[{ required: true, message: 'Hãy nhập họ và tên' }]}
                >
                  <Input placeholder="John Doe" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Hãy nhập email' },
                    { type: 'email', message: 'Email không hợp lệ' }
                  ]}
                >
                  <Input placeholder="john@example.com" disabled />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={updateProfile.isPending}>
                    Lưu thay đổi
                  </Button>
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'security',
            label: (
              <span>
                <Lock size={16} style={{ marginRight: 8 }} />
                Bảo mật
              </span>
            ),
            children: (
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
                style={{ marginTop: 16 }}
              >
                <Form.Item
                  name="oldPassword"
                  label="Mật khẩu hiện tại"
                  rules={[{ required: true, message: 'Hãy nhập mật khẩu hiện tại' }]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item
                  name="newPassword"
                  label="Mật khẩu mới"
                  rules={[
                    { required: true, message: 'Hãy nhập mật khẩu mới' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                  ]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="Xác nhận mật khẩu mới"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Hãy xác nhận mật khẩu mới' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={changePassword.isPending}>
                    Đổi mật khẩu
                  </Button>
                </Form.Item>
              </Form>
            )
          }
        ]}
      />
    </Modal>
  );
}
