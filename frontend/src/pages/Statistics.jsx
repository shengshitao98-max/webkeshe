import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { statisticsAPI } from '../services/api';

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const [daily, overall, category, keywords] = await Promise.all([
        statisticsAPI.getDailyStats(),
        statisticsAPI.getOverallStats(),
        statisticsAPI.getCategoryStats(),
        statisticsAPI.getKeywordStats(),
      ]);

      setStats({
        daily: daily.data,
        overall: overall.data,
        category: category.data,
        keywords: keywords.data,
      });
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div className="p-8">加载中...</div>;
  }

  const riskDistribution = [
    { name: '通过', value: stats.overall.riskLevelDistribution?.pass || 0 },
    { name: '可疑', value: stats.overall.riskLevelDistribution?.suspicious || 0 },
    { name: '违规', value: stats.overall.riskLevelDistribution?.violation || 0 },
  ];

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '风险分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {c}',
        },
        data: riskDistribution,
        color: ['#52c41a', '#faad14', '#f5222d'],
      },
    ],
  };

  const categoryData = Object.entries(stats.category || {}).map(([key, value]) => ({
    name: key,
    value,
  }));

  const categoryPieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '分类分布',
        type: 'pie',
        radius: '65%',
        data: categoryData.length > 0 ? categoryData : [{ name: '暂无数据', value: 1 }],
        label: { formatter: '{b}: {c}' },
      },
    ],
  };

  const keywordEntries = Object.entries(stats.keywords || {}).slice(0, 20);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">统计看板</h1>

      <Row gutter={16} className="mb-8">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总上传数"
              value={stats.overall.totalUploads || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已处理数"
              value={stats.overall.totalProcessed || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已复审数"
              value={stats.overall.totalReviews || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日通过率"
              value={stats.daily?.aiPassRate || 0}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="AI 风险分布" className="mb-8">
            <ReactECharts
              option={pieOption}
              style={{ height: 320 }}
              notMerge={true}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="视频分类分布" className="mb-8">
            <ReactECharts
              option={categoryPieOption}
              style={{ height: 320 }}
              notMerge={true}
            />
          </Card>
        </Col>
      </Row>

      <Card title="敏感词排名 TOP 20">
        <Table
          dataSource={keywordEntries.map(([keyword, count], idx) => ({
            key: idx,
            rank: idx + 1,
            keyword,
            count,
          }))}
          columns={[
            { title: '排名', dataIndex: 'rank', width: 100 },
            { title: '敏感词', dataIndex: 'keyword' },
            {
              title: '出现次数',
              dataIndex: 'count',
              render: (text) => <Tag color="red">{text}</Tag>,
            },
          ]}
          pagination={false}
          locale={{ emptyText: '暂无敏感词数据' }}
        />
      </Card>
    </div>
  );
};

export default Statistics;
