import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import './index.scss';

interface AfterServiceItem {
  id: string;
  orderNo: string;
  serviceType: string;
  status: string;
  statusDesc: string;
  reason: string;
  createdAt: string;
  amount: number;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  rejected: 'rejected',
};

export default function AfterServiceList() {
  const [list, setList] = useState<AfterServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Mock data - replace with real API when available
    setTimeout(() => {
      setList([]);
      setLoading(false);
    }, 500);
  }, []);

  const handleItemTap = useCallback((item: AfterServiceItem) => {
    Taro.navigateTo({
      url: `/pages/order/after-service-detail/index?id=${item.id}&orderNo=${item.orderNo}`,
    });
  }, []);

  if (loading) {
    return (
      <View className="after-service-list after-service-list--loading">
        <Text className="after-service-list__loading-text">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="after-service-list">
      {list.length === 0 ? (
        <View className="after-service-list__empty">
          <Text className="after-service-list__empty-icon">📋</Text>
          <Text className="after-service-list__empty-text">暂无售后记录</Text>
        </View>
      ) : (
        list.map((item) => (
          <View
            className="after-service-list__card"
            key={item.id}
            onClick={() => handleItemTap(item)}
          >
            <View className="after-service-list__card-header">
              <Text className="after-service-list__card-no">订单 {item.orderNo}</Text>
              <Text className={`after-service-list__card-status after-service-list__card-status--${STATUS_STYLE[item.status] || 'pending'}`}>
                {item.statusDesc || item.status}
              </Text>
            </View>
            <View className="after-service-list__card-body">
              <Text className="after-service-list__card-type">
                {item.serviceType === 'refund' ? '仅退款' : '退货退款'}
              </Text>
              <Text className="after-service-list__card-reason">{item.reason}</Text>
            </View>
            <View className="after-service-list__card-footer">
              <Text className="after-service-list__card-time">{item.createdAt}</Text>
              <Text className="after-service-list__card-arrow">›</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
