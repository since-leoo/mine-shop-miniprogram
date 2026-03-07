import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './index.scss';

interface TimelineNode {
  title: string;
  time: string;
  desc: string;
  active?: boolean;
}

export default function AfterServiceDetail() {
  const router = useRouter();
  const [serviceId, setServiceId] = useState('');
  const [serviceInfo, setServiceInfo] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = router.params.id || '';
    const orderNo = router.params.orderNo || '';
    setServiceId(id);
    setLoading(true);

    // Mock data - replace with real API when available
    setTimeout(() => {
      setServiceInfo({
        id,
        orderNo,
        serviceType: 'refund',
        status: 'processing',
        statusDesc: '处理中',
        reason: '商品质量问题',
        description: '',
        createdAt: '2024-01-01 12:00:00',
      });
      setTimeline([
        { title: '售后申请已提交', time: '2024-01-01 12:00:00', desc: '您的售后申请已提交，等待商家审核', active: true },
        { title: '商家审核中', time: '', desc: '商家正在审核您的申请', active: false },
        { title: '退款处理', time: '', desc: '等待退款', active: false },
      ]);
      setLoading(false);
    }, 500);
  }, [router.params]);

  if (loading) {
    return (
      <View className="after-service-detail after-service-detail--loading">
        <Text className="after-service-detail__loading-text">加载中...</Text>
      </View>
    );
  }

  if (!serviceInfo) return null;

  return (
    <View className="after-service-detail">
      {/* Status header */}
      <View className="after-service-detail__header">
        <Text className="after-service-detail__status">{serviceInfo.statusDesc}</Text>
        <Text className="after-service-detail__type">
          {serviceInfo.serviceType === 'refund' ? '仅退款' : '退货退款'}
        </Text>
      </View>

      {/* Timeline */}
      <View className="after-service-detail__card">
        <Text className="after-service-detail__card-title">处理进度</Text>
        <View className="after-service-detail__timeline">
          {timeline.map((node, index) => (
            <View
              className={`timeline-item ${node.active ? 'timeline-item--active' : ''}`}
              key={index}
            >
              <View className="timeline-item__dot-col">
                <View className={`timeline-item__dot ${node.active ? 'timeline-item__dot--active' : ''}`} />
                {index < timeline.length - 1 && <View className="timeline-item__line" />}
              </View>
              <View className="timeline-item__content">
                <Text className="timeline-item__title">{node.title}</Text>
                <Text className="timeline-item__desc">{node.desc}</Text>
                {node.time && <Text className="timeline-item__time">{node.time}</Text>}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Service info */}
      <View className="after-service-detail__card">
        <Text className="after-service-detail__card-title">售后信息</Text>
        <View className="after-service-detail__info-row">
          <Text className="after-service-detail__info-label">售后编号</Text>
          <Text className="after-service-detail__info-value">{serviceInfo.id || '-'}</Text>
        </View>
        <View className="after-service-detail__info-row">
          <Text className="after-service-detail__info-label">关联订单</Text>
          <Text className="after-service-detail__info-value">{serviceInfo.orderNo || '-'}</Text>
        </View>
        <View className="after-service-detail__info-row">
          <Text className="after-service-detail__info-label">售后原因</Text>
          <Text className="after-service-detail__info-value">{serviceInfo.reason || '-'}</Text>
        </View>
        <View className="after-service-detail__info-row">
          <Text className="after-service-detail__info-label">申请时间</Text>
          <Text className="after-service-detail__info-value">{serviceInfo.createdAt || '-'}</Text>
        </View>
      </View>
    </View>
  );
}
