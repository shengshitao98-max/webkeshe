import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Modal, Form, Input, message, Select, Collapse, Space, Tabs } from 'antd';
import { UploadOutlined, CheckOutlined, CloseOutlined, WarningOutlined, InfoCircleOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { videoAPI, reviewAPI } from '../services/api';
import { useVideoStore } from '../stores';
import { colorMap, riskLevelMap, categoryMap } from '../styles/constants';

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Dashboard = () => {
  const [statistics, setStatistics] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingReviews();
    fetchAllVideos();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      const response = await reviewAPI.getPendingReviews(10, 0);
      setPendingReviews(response.data.pendingReviews || []);
    } catch (error) {
      message.error('加载待复审列表失败');
    }
  };

  const fetchAllVideos = async () => {
    try {
      const response = await videoAPI.getAllVideos(20, 0);
      setAllVideos(response.data.videos || []);
    } catch (error) {
      message.error('加载视频列表失败');
    }
  };

  const handleReviewClick = async (record) => {
    try {
      const [videoData, analysisResult] = await Promise.all([
        videoAPI.getVideo(record.videoId),
        videoAPI.getAnalysisResult(record.videoId),
      ]);
      const completeData = { 
        ...record, 
        ...analysisResult.data,
        video: videoData.data 
      };
      setSelectedReview(completeData);
    } catch (error) {
      console.error('Error fetching video details:', error);
      setSelectedReview(record);
    }
    setReviewModal(true);
  };

  const handleSubmitReview = async (values) => {
    setLoading(true);
    try {
      await reviewAPI.submitReview({
        videoId: selectedReview.videoId,
        auditResultId: selectedReview.id,
        finalDecision: values.decision,
        reviewComment: values.comment,
      });
      message.success('复审已提交');
      setReviewModal(false);
      reviewForm.resetFields();
      fetchPendingReviews();
    } catch (error) {
      message.error('提交复审失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '视频ID',
      dataIndex: ['video', 'id'],
      key: 'videoId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: ['video', 'title'],
      key: 'title',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: ['video', 'category'],
      key: 'category',
      render: (text) => categoryMap[text] || text,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (text) => (
        <Tag color={colorMap[text]}>{riskLevelMap[text]}</Tag>
      ),
    },
    {
      title: '风险分数',
      dataIndex: 'overallRiskScore',
      key: 'score',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleReviewClick(record)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const renderReasoningItem = (item, index) => {
    if (item.includes('过高') || item.includes('超过') || item.includes('模糊度较高')) {
      return (
        <div key={index} className="flex items-start gap-2 text-red-600">
          <WarningOutlined className="mt-0.5" />
          <span>{item}</span>
        </div>
      );
    } else if (item.includes('较高') || item.includes('接近')) {
      return (
        <div key={index} className="flex items-start gap-2 text-orange-600">
          <WarningOutlined className="mt-0.5" />
          <span>{item}</span>
        </div>
      );
    }
    return (
      <div key={index} className="flex items-start gap-2 text-gray-600">
        <InfoCircleOutlined className="mt-0.5" />
        <span>{item}</span>
      </div>
    );
  };

  const renderMetricBar = (label, value, maxValue = 100, warningThreshold = 50, dangerThreshold = 70) => {
    let color = 'bg-green-500';
    if (value >= dangerThreshold) color = 'bg-red-500';
    else if (value >= warningThreshold) color = 'bg-yellow-500';
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium">{value}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-500`}
            style={{ width: `${(value / maxValue) * 100}%` }}
          />
        </div>
      </div>
    );
  };

  const allVideosColumns = [
    {
      title: '视频ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (text) => categoryMap[text] || text,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => {
        const statusMap = {
          pending: { label: '待处理', color: 'orange' },
          processing: { label: '处理中', color: 'blue' },
          completed: { label: '已完成', color: 'green' },
          failed: { label: '失败', color: 'red' },
        };
        const status = statusMap[text] || { label: text, color: 'gray' };
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: 'AI判定',
      key: 'riskLevel',
      render: (_, record) => {
        const riskLevel = record.auditResult?.riskLevel;
        if (!riskLevel) return <Tag color="gray">未审核</Tag>;
        return <Tag color={colorMap[riskLevel]}>{riskLevelMap[riskLevel]}</Tag>;
      },
    },
    {
      title: '复审结果',
      key: 'reviewStatus',
      render: (_, record) => {
        const review = record.reviews?.[0];
        if (!review) return <Tag color="gray">未复审</Tag>;
        const reviewMap = {
          pass: { label: '通过', color: 'green' },
          violation: { label: '违规', color: 'red' },
          appeal_pending: { label: '待申诉', color: 'orange' },
        };
        const status = reviewMap[review.finalDecision] || { label: review.finalDecision, color: 'gray' };
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: '简介',
      dataIndex: ['auditResult', 'summary'],
      key: 'summary',
      width: 300,
      render: (text) => {
        if (!text || text === '-') return <span className="text-gray-400">-</span>;
        return (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
            {text}
          </div>
        );
      },
    },
    {
      title: '风险分数',
      key: 'score',
      render: (_, record) => record.auditResult?.overallRiskScore || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.auditResult) {
          return (
            <Button
              type="primary"
              size="small"
              onClick={() => handleReviewClick(record.auditResult)}
            >
              查看详情
            </Button>
          );
        }
        return '-';
      },
    },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">复审工作台</h1>

      <Row gutter={16} className="mb-8">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待复审数"
              value={pendingReviews.length}
              prefix={<UploadOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={allVideos.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="all"
        className="mb-8"
        items={[
          {
            key: 'all',
            label: '全部视频',
            children: (
              <Card title="视频总览">
                <Table
                  columns={allVideosColumns}
                  dataSource={allVideos}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={false}
                />
              </Card>
            ),
          },
          {
            key: 'pending',
            label: '待复审',
            children: (
              <Card title="待复审列表">
                <Table
                  columns={columns}
                  dataSource={pendingReviews}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={false}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="审核详情"
        open={reviewModal}
        onCancel={() => setReviewModal(false)}
        width={900}
        footer={null}
      >
        {selectedReview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">视频标题</p>
                <p className="font-bold text-lg">{selectedReview.video?.title || '未设置'}</p>
              </div>
              <div>
                <p className="text-gray-600">AI 判定风险等级</p>
                <Space>
                  <Tag color={colorMap[selectedReview.riskLevel]} className="text-lg px-4 py-1">
                    {riskLevelMap[selectedReview.riskLevel]}
                  </Tag>
                  <span className="text-gray-500 text-sm">
                    (综合分数: {selectedReview.overallRiskScore})
                  </span>
                </Space>
              </div>
              <div>
                <p className="text-gray-600">视频分类</p>
                <p className="font-medium">{categoryMap[selectedReview.video?.category] || '其他'}</p>
              </div>
              <div>
                <p className="text-gray-600">视频ID</p>
                <p className="font-mono text-sm text-gray-500">{selectedReview.videoId}</p>
              </div>
            </div>

            <Card title="视频预览" variant="outlined">
              <div className="flex justify-center">
                {selectedReview.videoId ? (
                  <video
                    key={selectedReview.videoId}
                    controls
                    className="max-w-full max-h-80 rounded-lg shadow-lg"
                    poster={`/api/videos/thumbnail/${selectedReview.videoId}?token=${localStorage.getItem('token')}`}
                    onError={(e) => {
                      console.error('Video poster failed to load');
                    }}
                  >
                    <source
                      src={`/api/videos/stream/${selectedReview.videoId}?token=${localStorage.getItem('token')}`}
                      type="video/mp4"
                    />
                    您的浏览器不支持视频播放
                  </video>
                ) : (
                  <p className="text-gray-400 py-8">无视频预览</p>
                )}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">时长</p>
                  <p className="font-medium">{selectedReview.video?.duration ? formatDuration(selectedReview.video.duration) : '--:--'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">分辨率</p>
                  <p className="font-medium">{selectedReview.video?.resolution || '未知'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">帧率</p>
                  <p className="font-medium">{selectedReview.video?.fps || '--'} FPS</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">文件大小</p>
                  <p className="font-medium">
                    {selectedReview.video?.fileSize ? (
                      (selectedReview.video.fileSize / 1024 / 1024).toFixed(2) + ' MB'
                    ) : '未知'}
                  </p>
                </div>
              </div>
            </Card>

            <Card title="AI 判断依据" variant="outlined" className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <Collapse
                defaultActiveKey={['1', '2']}
                ghost
                items={[
                  {
                    key: '1',
                    label: <span className="flex items-center gap-2"><BarChartOutlined /> 图像分析判定</span>,
                    children: (
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">关键帧检测指标：</p>
                          {selectedReview.imageClassifications?.length > 0 && (
                            <div className="space-y-4">
                              {selectedReview.imageClassifications.slice(0, 3).map((frame, idx) => (
                                <div key={idx} className="border-t pt-3">
                                  <p className="text-xs text-gray-500 mb-2">第 {idx + 1} 帧</p>
                                  <div className="grid grid-cols-2 gap-4">
                                    {renderMetricBar('皮肤占比', frame.metrics?.skinPercentage || 0, 100, 30, 45)}
                                {renderMetricBar('红色区域', frame.metrics?.bloodPercentage || 0, 100, 5, 15)}
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                {renderMetricBar('模糊度', frame.metrics?.blurScore || 0, 100, 50, 70)}
                                {renderMetricBar('色彩饱和度', frame.metrics?.colorSaturation || 0, 100, 85, 95)}
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">边缘密度</span>
                                    <span className="font-medium">{(frame.metrics?.edgeDensity || 0).toFixed(3)}</span>
                                  </div>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${(frame.metrics?.edgeDensity || 0) > 0.15 ? 'bg-red-500' : 'bg-green-500'}`}
                                      style={{ width: `${(frame.metrics?.edgeDensity || 0) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">画面混乱度</span>
                                    <span className="font-medium">{(frame.metrics?.chaosScore || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${(frame.metrics?.chaosScore || 0) > 0.6 ? 'bg-red-500' : (frame.metrics?.chaosScore || 0) > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${(frame.metrics?.chaosScore || 0) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-between text-sm mt-2">
                                <span className="text-gray-600">人脸数量</span>
                                <span className="font-medium">{frame.metrics?.faceCount || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-600">帧分类</span>
                                <Tag color={frame.class === 'normal' ? 'green' : frame.class === 'suggestive' ? 'orange' : frame.class === 'violent' ? 'purple' : 'red'}>
                                  {frame.class === 'normal' ? '正常' : frame.class === 'suggestive' ? '暗示性' : frame.class === 'violent' ? '暴力' : '色情'}
                                </Tag>
                              </div>
                                  {frame.reasoning && frame.reasoning.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <p className="text-xs text-gray-500">判定理由：</p>
                                      {frame.reasoning.map((reason, rIdx) => renderReasoningItem(reason, rIdx))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {selectedReview.imageClassifications?.length === 0 && (
                            <p className="text-gray-500 text-sm">暂无图像分析数据</p>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    label: <span className="flex items-center gap-2"><InfoCircleOutlined /> 文本分析判定</span>,
                    children: (
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">文本风险分数</span>
                            <span className={`font-bold ${selectedReview.textRiskScore > 50 ? 'text-red-600' : selectedReview.textRiskScore > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                              {selectedReview.textRiskScore}
                            </span>
                          </div>
                          {renderMetricBar('文本风险', selectedReview.textRiskScore || 0)}
                          
                          <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-2">检测到的敏感词：</p>
                            {selectedReview.sensitiveKeywords && selectedReview.sensitiveKeywords.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedReview.sensitiveKeywords.map((kw, idx) => (
                                  <Tag key={idx} color="red">{kw}</Tag>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">未检测到敏感词</p>
                            )}
                          </div>

                          {selectedReview.transcription && (
                            <div className="mt-4">
                              <p className="text-sm text-gray-600 mb-2">语音转写内容：</p>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {selectedReview.transcription}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: '3',
                    label: '综合评估',
                    children: (
                      <div className="bg-white rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{selectedReview.textRiskScore}</p>
                            <p className="text-sm text-gray-500">文本分数</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{selectedReview.imageRiskScore}</p>
                            <p className="text-sm text-gray-500">图像分数</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-2xl font-bold ${selectedReview.riskLevel === 'pass' ? 'text-green-600' : selectedReview.riskLevel === 'suspicious' ? 'text-orange-600' : 'text-red-600'}`}>
                              {selectedReview.overallRiskScore}
                            </p>
                            <p className="text-sm text-gray-500">综合分数</p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-600">评分公式：</p>
                          <p className="text-sm font-mono text-gray-700 mt-1">
                            综合分数 = 文本分数 × 0.4 + 图像分数 × 0.6
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            风险等级判定：&lt;30=通过，30-70=可疑，&gt;=70=违规
                          </p>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>

            <Form
              form={reviewForm}
              layout="vertical"
              onFinish={handleSubmitReview}
            >
              <Form.Item
                label="最终决定"
                name="decision"
                rules={[{ required: true, message: '请选择最终决定' }]}
              >
                <Select placeholder="请选择">
                  <Select.Option value="pass">通过</Select.Option>
                  <Select.Option value="violation">违规</Select.Option>
                  <Select.Option value="appeal_pending">待申诉</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="审核意见（必填）"
                name="comment"
                rules={[
                  { required: true, message: '请输入审核意见' },
                  { min: 10, message: '审核意见至少 10 个字符' },
                ]}
              >
                <Input.TextArea rows={4} placeholder="请详细说明审核理由..." />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  提交复审
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;