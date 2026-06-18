import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Modal, Form, Input, message, Select, Collapse, Space, Tabs, Divider, Switch, InputNumber, Alert } from 'antd';
import { UploadOutlined, CheckOutlined, CloseOutlined, WarningOutlined, InfoCircleOutlined, BarChartOutlined, FileTextOutlined, SettingOutlined, LockOutlined, PieChartOutlined } from '@ant-design/icons';
import { videoAPI, reviewAPI } from '../services/api';
import { useAuthStore } from '../stores';
import { colorMap, riskLevelMap, categoryMap } from '../styles/constants';

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Dashboard = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [statistics, setStatistics] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [thresholdSettings, setThresholdSettings] = useState({
    localThreshold: 30,
    kimiThreshold: 50,
    passThreshold: 30,
    suspiciousThreshold: 70,
  });

  useEffect(() => {
    fetchPendingReviews();
    fetchAllVideos();
    if (isAdmin) {
      fetchStatistics();
    }
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/statistics/overall', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

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

  const userVideoColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '审核状态',
      key: 'status',
      render: (_, record) => {
        if (!record.auditResult) return <Tag color="gray">未审核</Tag>;
        return <Tag color={record.status === 'completed' ? 'green' : 'orange'}>{record.status === 'completed' ? '已审核' : '处理中'}</Tag>;
      },
    },
    {
      title: 'AI判定',
      key: 'riskLevel',
      render: (_, record) => {
        if (!record.auditResult) return <Tag color="gray">未审核</Tag>;
        return <Tag color={colorMap[record.auditResult.riskLevel]}>{riskLevelMap[record.auditResult.riskLevel]}</Tag>;
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
              查看结果
            </Button>
          );
        }
        return <Tag color="gray">等待审核</Tag>;
      },
    },
  ];

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
        const analysisMethod = record.auditResult?.analysisMethod;
        const localThreshold = record.auditResult?.localThreshold;
        
        if (!riskLevel) return <Tag color="gray">未审核</Tag>;
        
        const methodLabel = {
          'local_only': '本地',
          'kimi': 'AI',
          'local_fallback': '回退',
        };
        
        const methodColor = {
          'local_only': 'cyan',
          'kimi': 'purple',
          'local_fallback': 'orange',
        };
        
        return (
          <div className="space-y-1">
            <Tag color={colorMap[riskLevel]}>{riskLevelMap[riskLevel]}</Tag>
            {analysisMethod && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Tag color={methodColor[analysisMethod]} size="small">{methodLabel[analysisMethod]}</Tag>
                {localThreshold && <span>阈值:{localThreshold}</span>}
              </div>
            )}
          </div>
        );
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
    ...(isAdmin ? [
      {
        title: '本地评分',
        key: 'localScore',
        render: (_, record) => {
          const score = record.auditResult?.localRiskScore;
          return score !== null && score !== undefined ? score : '-';
        },
      },
      {
        title: '文本评分',
        key: 'textScore',
        render: (_, record) => {
          const score = record.auditResult?.textRiskScore;
          return score !== null && score !== undefined ? score : '-';
        },
      },
      {
        title: '综合评分',
        key: 'score',
        render: (_, record) => {
          const score = record.auditResult?.overallRiskScore;
          return score !== null && score !== undefined ? score : '-';
        },
      },
      {
        title: '阈值',
        key: 'threshold',
        render: (_, record) => record.auditResult?.localThreshold || '-',
      },
      {
        title: '分析方式',
        key: 'method',
        render: (_, record) => {
          const method = record.auditResult?.analysisMethod;
          const methodLabel = {
            'local_only': '本地',
            'kimi': 'AI',
            'local_fallback': '回退',
          };
          return methodLabel[method] || method || '-';
        },
      },
    ] : []),
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
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* 管理员欢迎横幅 */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 rounded-2xl p-6 mb-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <SettingOutlined />
                欢迎回来，管理员
              </h2>
              <p className="text-blue-100">您可以查看所有视频、配置审核阈值、进行复审操作</p>
            </div>
            <div className="bg-white/20 rounded-xl px-6 py-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{allVideos.length}</p>
                <p className="text-sm text-blue-100">总视频数</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-8 text-slate-800">
        {isAdmin ? '视频审核管理' : '我的视频审核结果'}
      </h1>

      <Row gutter={16} className="mb-8">
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-md border-cyan-200 bg-gradient-to-br from-white to-cyan-50">
            <Statistic
              title={<span className="text-gray-600">待复审数</span>}
              value={pendingReviews.length}
              prefix={<UploadOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-md border-blue-200 bg-gradient-to-br from-white to-blue-50">
            <Statistic
              title={<span className="text-gray-600">总视频数</span>}
              value={allVideos.length}
              prefix={<FileTextOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        {isAdmin && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card className="shadow-md border-green-200 bg-gradient-to-br from-white to-green-50">
                <Statistic
                  title={<span className="text-gray-600">通过数</span>}
                  value={allVideos.filter(v => v.reviews?.[0]?.finalDecision === 'pass').length}
                  prefix={<CheckOutlined className="text-green-500" />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="shadow-md border-red-200 bg-gradient-to-br from-white to-red-50">
                <Statistic
                  title={<span className="text-gray-600">违规数</span>}
                  value={allVideos.filter(v => v.reviews?.[0]?.finalDecision === 'violation').length}
                  prefix={<CloseOutlined className="text-red-500" />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* 管理员阈值设置面板 */}
      {isAdmin && (
        <Card className="mb-8 shadow-lg border-cyan-200" title={
          <span className="flex items-center gap-2 text-cyan-700">
            <SettingOutlined />
            评分阈值配置
          </span>
        }>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form layout="vertical">
                <Form.Item label="本地分析阈值" extra="超过此分数将调用AI进行深度分析">
                  <InputNumber
                    min={0}
                    max={100}
                    value={thresholdSettings.localThreshold}
                    onChange={(value) => setThresholdSettings({ ...thresholdSettings, localThreshold: value })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label="通过阈值" extra="低于此分数直接通过">
                  <InputNumber
                    min={0}
                    max={100}
                    value={thresholdSettings.passThreshold}
                    onChange={(value) => setThresholdSettings({ ...thresholdSettings, passThreshold: value })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Form>
            </Col>
            <Col xs={24} md={12}>
              <Form layout="vertical">
                <Form.Item label="AI分析阈值" extra="AI深度分析的敏感度">
                  <InputNumber
                    min={0}
                    max={100}
                    value={thresholdSettings.kimiThreshold}
                    onChange={(value) => setThresholdSettings({ ...thresholdSettings, kimiThreshold: value })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label="可疑阈值" extra="超过此分数标记为可疑需要人工复审">
                  <InputNumber
                    min={0}
                    max={100}
                    value={thresholdSettings.suspiciousThreshold}
                    onChange={(value) => setThresholdSettings({ ...thresholdSettings, suspiciousThreshold: value })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Form>
            </Col>
          </Row>
          <Divider />
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <InfoCircleOutlined />
              评分规则说明
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 本地评分：本地YOLO+肤色检测分析结果（决定是否调用AI）</li>
              <li>• 文本评分：语音转写敏感词检测结果</li>
              <li>• AI图像评分 = 本地评分（作为最终评分依据）</li>
              <li>• 综合评分 = 文本评分 × 0.4 + AI图像评分 × 0.6</li>
              <li>• 本地评分 &gt;= 30：调用Kimi AI进行深度分析</li>
              <li>• 分数 &lt; {thresholdSettings.passThreshold}：自动通过</li>
              <li>• 分数 {thresholdSettings.passThreshold}-{thresholdSettings.suspiciousThreshold}：可疑，需要人工复审</li>
              <li>• 分数 ≥ {thresholdSettings.suspiciousThreshold}：违规，需要人工复审</li>
            </ul>
          </div>
        </Card>
      )}

      {/* 非管理员用户提示 */}
      {!isAdmin && (
        <Alert
          message="提示"
          description="您上传的视频将自动进行AI审核。审核完成后，您可以在这里查看审核结果。"
          type="info"
          showIcon
          icon={<LockOutlined />}
          className="mb-8"
        />
      )}

      <Tabs
        defaultActiveKey={isAdmin ? "all" : "my"}
        className="mb-8"
        items={[
          ...(isAdmin ? [{
            key: 'all',
            label: '全部视频',
            children: (
              <Card title="视频总览" className="shadow-md">
                <Table
                  columns={allVideosColumns}
                  dataSource={allVideos}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={false}
                />
              </Card>
            ),
          }] : [{
            key: 'my',
            label: '我的视频',
            children: (
              <Card title="我的视频列表" className="shadow-md">
                <Table
                  columns={userVideoColumns}
                  dataSource={allVideos}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={false}
                />
              </Card>
            ),
          }]),
          ...(isAdmin ? [{
            key: 'pending',
            label: <span className="flex items-center gap-2">
              待复审
              {pendingReviews.length > 0 && (
                <Tag color="orange">{pendingReviews.length}</Tag>
              )}
            </span>,
            children: (
              <Card title="待复审列表" className="shadow-md">
                <Table
                  columns={columns}
                  dataSource={pendingReviews}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={false}
                />
              </Card>
            ),
          }] : []),
        ]}
      />

      <Modal
        title={
          <span className="flex items-center gap-2">
            <FileTextOutlined />
            审核详情
          </span>
        }
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
                  <div className="relative max-w-full max-h-80 rounded-lg shadow-lg overflow-hidden bg-gray-900">
                    <video
                      key={selectedReview.videoId}
                      controls
                      className="w-full h-full object-contain"
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
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gradient-to-br from-gray-800/50 to-transparent">
                      <svg className="w-24 h-24 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
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

            {/* 仅管理员可见的详细分析 */}
            {isAdmin && (
              <Card title="AI 判断依据" variant="outlined" className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <Collapse
                  defaultActiveKey={['0', '2']}
                  ghost
                  items={[
                    {
                      key: '0',
                      label: <span className="flex items-center gap-2"><PieChartOutlined /> 整体数据分析</span>,
                      children: (
                        <div className="space-y-4">
                          <div className="bg-white rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-700 mb-3">整体检测指标汇总：</p>
                            <div className="grid grid-cols-2 gap-4">
                              {renderMetricBar('图像风险', selectedReview.imageRiskScore || 0, 100, 30, 70)}
                              {renderMetricBar('文本风险', selectedReview.textRiskScore || 0, 100, 30, 70)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {renderMetricBar('综合风险', selectedReview.overallRiskScore || 0, 100, 30, 70)}
                              {renderMetricBar('本地评分', selectedReview.localRiskScore || 0, 100, 30, 70)}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-xs text-gray-500 mb-2">判定理由：</p>
                              {selectedReview.imageClassifications?.length > 0 && selectedReview.imageClassifications[0]?.reasoning && (
                                <div className="space-y-1">
                                  {selectedReview.imageClassifications[0].reasoning.map((reason, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                      <InfoCircleOutlined className="mt-0.5 text-blue-500" />
                                      <span className="text-gray-600">{reason}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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
            )}

            {/* 非管理员用户简化的审核结果 */}
            {!isAdmin && (
              <Card title="审核结果" variant="outlined">
                <div className="text-center py-4">
                  <Tag color={colorMap[selectedReview.riskLevel]} className="text-xl px-6 py-2">
                    {riskLevelMap[selectedReview.riskLevel]}
                  </Tag>
                  <p className="text-gray-500 mt-2">综合风险分数: {selectedReview.overallRiskScore}</p>
                  {selectedReview.summary && (
                    <div className="mt-4 text-left">
                      <p className="text-sm text-gray-600 mb-2">AI分析摘要：</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedReview.summary}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {isAdmin && (
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
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
