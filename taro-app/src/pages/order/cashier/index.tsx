import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { requestOrderPayment, fetchOrderPayInfo } from '../../../services/order/orderConfirm';
import Price from '../../../components/Price';
import './index.scss';

export default function Cashier() {
  const router = useRouter();
  const [tradeNo, setTradeNo] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('wechat');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const params = router.params;
    const no = params.tradeNo || '';
    setTradeNo(no);

    if (params.payAmount) {
      setPayAmount(Number(params.payAmount) || 0);
    }

    if (params.mode === 'repay' && no) {
      fetchOrderPayInfo(no)
        .then((res: any) => {
          const data = res?.data || res;
          if (data?.payAmount) setPayAmount(data.payAmount);
        })
        .catch(() => {});
    }
  }, [router.params]);

  const handlePay = useCallback(() => {
    if (paying || !tradeNo) return;
    setPaying(true);

    requestOrderPayment({ tradeNo, payMethod })
      .then((res: any) => {
        const data = res?.data || res;
        if (data?.payParams) {
          Taro.requestPayment({
            ...data.payParams,
            success: () => {
              Taro.redirectTo({
                url: `/pages/order/pay-result/index?totalPaid=${payAmount}&orderNo=${tradeNo}`,
              });
            },
            fail: () => {
              Taro.showToast({ title: '支付取消', icon: 'none' });
              setPaying(false);
            },
          });
        } else {
          Taro.redirectTo({
            url: `/pages/order/pay-result/index?totalPaid=${payAmount}&orderNo=${tradeNo}`,
          });
        }
      })
      .catch((err: any) => {
        setPaying(false);
        Taro.showToast({ title: err?.msg || '支付失败', icon: 'none' });
      });
  }, [paying, tradeNo, payMethod, payAmount]);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return (
    <View className="cashier">
      <View className="cashier__amount-card">
        <Text className="cashier__amount-label">支付金额</Text>
        <View className="cashier__amount-value">
          <Price price={payAmount} className="cashier__price" fill />
        </View>
      </View>

      <View className="cashier__methods">
        <Text className="cashier__methods-title">支付方式</Text>
        <View
          className={`cashier__method ${payMethod === 'wechat' ? 'cashier__method--active' : ''}`}
          onClick={() => setPayMethod('wechat')}
        >
          <View className="cashier__method-left">
            <Text className="cashier__method-icon">💬</Text>
            <Text className="cashier__method-name">微信支付</Text>
          </View>
          <View className={`cashier__radio ${payMethod === 'wechat' ? 'cashier__radio--checked' : ''}`} />
        </View>
      </View>

      <View className="cashier__footer">
        <View
          className={`cashier__pay-btn ${paying ? 'cashier__pay-btn--disabled' : ''}`}
          onClick={handlePay}
        >
          <Text className="cashier__pay-btn-text">
            {paying ? '支付中...' : '确认支付'}
          </Text>
        </View>
        <View className="cashier__cancel-btn" onClick={handleBack}>
          <Text className="cashier__cancel-text">取消支付</Text>
        </View>
      </View>
    </View>
  );
}
