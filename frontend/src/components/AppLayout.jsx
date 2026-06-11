import React from 'react';
import { Layout, Menu, Button, Dropdown } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';

const { Header, Content, Sider } = Layout;

const AppLayout = ({ children, location }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile">
        <UserOutlined /> 个人资料
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" onClick={handleLogout}>
        <LogoutOutlined /> 退出登录
      </Menu.Item>
    </Menu>
  );

  const siderMenu = user ? (
    user.role === 'reviewer' ? [
      { key: '/review', label: '待复审' },
      { key: '/statistics', label: '统计看板' },
    ] : [
      { key: '/upload', label: '上传视频' },
      { key: '/review', label: '待复审' },
      { key: '/statistics', label: '统计看板' },
    ]
  ) : [
    { key: '/upload', label: '上传视频' },
    { key: '/review', label: '待复审' },
    { key: '/statistics', label: '统计看板' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="bg-white shadow">
        <div className="flex justify-between items-center h-16 px-4">
          <h1 className="text-xl font-bold m-0">短视频审核管理系统</h1>
          <Dropdown menu={{ items: [{ key: 'logout', label: '退出登录', onClick: handleLogout }] }}>
            <Button type="text" icon={<UserOutlined />}>
              {user?.username}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        <Sider width={200} theme="light" className="bg-white border-r">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={siderMenu.map(item => ({
              key: item.key,
              label: item.label,
              onClick: () => navigate(item.key),
            }))}
          />
        </Sider>

        <Content className="bg-gray-50">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
