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
      title="User Profile & Security"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
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
                Profile
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
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter your full name' }]}
                >
                  <Input placeholder="John Doe" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Please enter your email' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input placeholder="john@example.com" disabled />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={updateProfile.isPending}>
                    Save Changes
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
                Security
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
                  label="Current Password"
                  rules={[{ required: true, message: 'Please enter your current password' }]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item
                  name="newPassword"
                  label="New Password"
                  rules={[
                    { required: true, message: 'Please enter a new password' },
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="Confirm New Password"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Please confirm your new password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('The two passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={changePassword.isPending}>
                    Change Password
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
