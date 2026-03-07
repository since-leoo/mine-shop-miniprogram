import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import Price from '../../../components/Price';
import './index.scss';

export default function PayResult() {
  const router = useRouter();
  const [totalPaid, setTotalPaid] = useState(0);
  const [orderNo, setOrderNo] = useState('');

  useEffect(() => {
    const { totalPaid: paid = '0', orderNo: no = '' } = router.params;
    setTotalPaid(Number(paid) || 0);
    setOrderNo(no);
  }, [router.params]);

  const handleViewOrder = useCallback(() => {
    if (orderNo) {
      Taro.navigateTo({
        url: `/pages/order/order-detail/index?orderNo=${orderNo}`,
      });
    } else {
      Taro.navigateTo({
        url: '/pages/order/order-list/index',
      });
    }
  }, [orderNo]);

  const handleGoHome = useCallback(() => {
    Taro.switchTab({ url: '/pages/home/index' });
  }, []);

  return (
    <View className="pay-result">
      <View className="pay-result__icon-wrap">
        <View className="pay-result__icon">✓</View>
      </View>
      <Text className="pay-result__title">支付成功</Text>
      <View className="pay-result__amount">
        <Text className="pay-result__amount-label">微信支付：</Text>
        <Price price={totalPaid} className="pay-result__price" fill />
      </View>

      <View className="pay-result__buttons">
        <View className="pay-result__btn pay-result__btn--primary" onClick={handleViewOrder}>
          <Text className="pay-result__btn-text pay-result__btn-text--primary">查看订单</Text>
        </View>
        <View className="pay-result__btn pay-result__btn--secondary" onClick={handleGoHome}>
          <Text className="pay-result__btn-text pay-result__btn-text--secondary">返回首页</Text>
        </View>
      </View>
    </View>
  );
}
