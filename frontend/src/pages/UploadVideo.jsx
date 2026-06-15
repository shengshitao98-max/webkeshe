import React, { useState } from 'react';
import { Card, Button, Upload, Form, Input, Select, message, Progress } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { videoAPI } from '../services/api';

const UploadVideo = () => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileList, setFileList] = useState([]);

  const handleUpload = async (values) => {
    if (fileList.length === 0) {
      message.error('请选择视频文件');
      return;
    }

    const file = fileList[0].originFileObj || fileList[0];
    if (!file || !file.size || file.size === 0) {
      message.error('无效的视频文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', values.title);
    formData.append('description', values.description || '');
    formData.append('category', values.category);

    try {
      const response = await videoAPI.uploadVideo(formData);
      message.success('视频上传成功，系统正在处理...');
      form.resetFields();
      setFileList([]);
      setUploadProgress(0);
    } catch (error) {
      message.error('上传失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">上传视频</h1>

      <Card className="max-w-2xl">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
        >
          <Form.Item label="视频文件">
            <Upload
              fileList={fileList}
              onChange={({ fileList: newList }) => setFileList(newList.slice(-1))}
              beforeUpload={(file) => {
                const isValid = file.size <= 209715200;
                if (!isValid) {
                  message.error('文件大小不能超过200MB');
                }
                return isValid || Upload.LIST_IGNORE;
              }}
              accept="video/*"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>
                选择视频 (MP4, MOV, AVI，最大200MB)
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="视频标题"
            name="title"
            rules={[{ required: true, message: '请输入视频标题' }]}
          >
            <Input placeholder="请输入视频标题" />
          </Form.Item>

          <Form.Item label="视频描述" name="description">
            <Input.TextArea rows={4} placeholder="请输入视频描述" />
          </Form.Item>

          <Form.Item
            label="视频分类"
            name="category"
            rules={[{ required: true, message: '请选择视频分类' }]}
          >
            <Select placeholder="请选择视频分类">
              <Select.Option value="news">新闻资讯</Select.Option>
              <Select.Option value="entertainment">娱乐搞笑</Select.Option>
              <Select.Option value="education">教育科普</Select.Option>
              <Select.Option value="lifestyle">生活记录</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>

          {uploading && (
            <Form.Item>
              <Progress percent={uploadProgress} />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={uploading}
              block
              size="large"
            >
              {uploading ? '上传中...' : '上传视频'}
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-8 p-4 bg-blue-50 rounded">
          <h3 className="font-bold mb-2">上传须知:</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>支持 MP4、MOV、AVI 格式</li>
            <li>单个文件不超过 200MB</li>
            <li>上传后系统将自动进行 AI 分析</li>
            <li>处理时间视频长度而定，通常需要几分钟</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default UploadVideo;
