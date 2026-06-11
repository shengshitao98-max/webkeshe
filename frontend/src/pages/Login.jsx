import React, { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { useAuthStore } from '../stores';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { VideoCameraOutlined, LockOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [showPassword, setShowPassword] = useState(false);
  const { setUser, setToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await authAPI.login(values.username, values.password);
      setToken(response.data.token);
      setUser(response.data.user);
      message.success('登录成功');
      navigate('/review');
    } catch (error) {
      message.error('登录失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-30"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-lg transform hover:scale-105 transition-transform duration-300">
              <VideoCameraOutlined className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">
              短视频审核系统
            </h1>
            <p className="text-white/60 text-sm">
              AI智能内容安全检测平台
            </p>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            className="space-y-6"
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <div className="relative">
                <UserOutlined className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="请输入用户名"
                  className="pl-12 py-4 bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <div className="relative">
                <LockOutlined className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input.Password
                  placeholder="请输入密码"
                  iconRender={(visible) => (
                    <span onClick={() => setShowPassword(!showPassword)} className="cursor-pointer">
                      {visible ? <EyeOutlined className="text-gray-400" /> : <EyeInvisibleOutlined className="text-gray-400" />}
                    </span>
                  )}
                  className="pl-12 py-4 bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className="py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-none rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              演示账号: <span className="text-white font-medium">reviewer1</span> / 密码: 任意
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
              <span className="w-8 h-px bg-white/20"></span>
              <span>安全认证</span>
              <span className="w-8 h-px bg-white/20"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
