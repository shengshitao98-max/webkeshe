import React, { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { useAuthStore } from '../stores';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { VideoCameraOutlined, LockOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined, KeyOutlined, RobotOutlined } from '@ant-design/icons';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* 科技感网格背景 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* 动态粒子效果 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-blue-400 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-50" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-cyan-300 rounded-full animate-ping opacity-70" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-blue-300 rounded-full animate-ping opacity-30" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* 渐变光晕 */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>

      {/* 扫描线效果 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-scan"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-500">
          {/* 顶部装饰 */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 rounded-2xl shadow-lg shadow-cyan-500/30">
              <VideoCameraOutlined className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="text-center mb-10 mt-4">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-3 tracking-wider">
              AI内容审核系统
            </h1>
            <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
              <RobotOutlined className="text-cyan-400" />
              智能视频内容安全检测平台
              <RobotOutlined className="text-cyan-400" />
            </p>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            className="space-y-5"
          >
            <Form.Item
              label={<span className="text-cyan-400 font-medium">用户名</span>}
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <div className="relative group">
                <UserOutlined className="absolute left-4 top-1/2 transform -translate-y-1/2 text-cyan-400 group-hover:text-cyan-300 transition-colors z-10" />
                <Input
                  placeholder="请输入用户名"
                  className="pl-12 py-5 bg-slate-700/50 border border-cyan-500/30 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 hover:border-cyan-400/50"
                />
                <div className="absolute inset-0 rounded-xl bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            </Form.Item>

            <Form.Item
              label={<span className="text-cyan-400 font-medium">密码</span>}
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <div className="relative group">
                <LockOutlined className="absolute left-4 top-1/2 transform -translate-y-1/2 text-cyan-400 group-hover:text-cyan-300 transition-colors z-10" />
                <Input.Password
                  placeholder="请输入密码"
                  iconRender={(visible) => (
                    <span onClick={() => setShowPassword(!showPassword)} className="cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors">
                      {visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </span>
                  )}
                  className="pl-12 py-5 bg-slate-700/50 border border-cyan-500/30 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 hover:border-cyan-400/50"
                />
                <div className="absolute inset-0 rounded-xl bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            </Form.Item>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className="py-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 border-none rounded-xl font-bold text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transform hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="flex items-center justify-center gap-2">
                  <KeyOutlined />
                  登录系统
                </span>
              </Button>
            </Form.Item>
          </Form>

          {/* 账号说明 */}
          <div className="mt-8 space-y-3">
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 text-cyan-400 text-sm mb-2">
                <KeyOutlined />
                <span className="font-semibold">管理员账号</span>
              </div>
              <p className="text-gray-400 text-xs">admin / admin123</p>
              <p className="text-gray-500 text-xs mt-1">可查看评分阈值、统计数据等</p>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 border border-gray-600/20">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <UserOutlined />
                <span className="font-medium">普通账号</span>
              </div>
              <p className="text-gray-400 text-xs">reviewer1 / 任意密码</p>
              <p className="text-gray-500 text-xs mt-1">可上传视频并查看审核结果</p>
            </div>
          </div>

          {/* 底部装饰 */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              系统在线
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          </div>
        </div>

        {/* 版本信息 */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-xs">Video Audit System v1.0 | Powered by AI</p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
