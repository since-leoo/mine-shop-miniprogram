import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { requestOrderPayment, fetchOrderPayInfo } from '../../../services/order/orderConfirm';
import Price from '../../../components/Price';
import './index.scss';

interface PayMethod {
  channel: string;
  channelName?: string;
  name?: string;
  code?: string;
  value?: string;
  enabled?: boolean;
}

function normalizePayMethods(input: any): PayMethod[] {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item: any) => {
      const channel = String(item?.channel || item?.code || item?.value || item?.payMethod || '');
      if (!channel) return null;
      return {
        channel,
        channelName: item?.channelName || item?.name || item?.title || item?.label || channel,
        name: item?.name || item?.channelName || item?.title || item?.label || '',
        code: item?.code || channel,
        value: item?.value || channel,
        enabled: item?.enabled !== false && item?.disable !== true,
      };
    })
    .filter(Boolean) as PayMethod[];
}

export default function Cashier() {
  const router = useRouter();
  const [tradeNo, setTradeNo] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [payMethod, setPayMethod] = useState('');
  const [creating, setCreating] = useState(true);
  const [paying, setPaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');

  useEffect(() => {
    const params = router.params;
    const no = params.tradeNo || '';
    setTradeNo(no);

    if (!no) {
      setCreating(false);
      setFailed(true);
      setFailReason('订单号缺失');
      return;
    }

    setCreating(true);
    setFailed(false);
    fetchOrderPayInfo(no)
      .then((res: any) => {
        const data = res?.data || res || {};
        setPayAmount(Number(data.payAmount || data.totalAmount || params.payAmount || 0));
        const methods = normalizePayMethods(data.payMethods);
        const finalMethods = methods.length > 0
          ? methods
          : [{ channel: 'wechat', channelName: '微信支付', name: '微信支付', enabled: true }];
        setPayMethods(finalMethods);
        const firstEnabled = finalMethods.find((m: PayMethod) => m.enabled !== false);
        setPayMethod(firstEnabled?.channel || finalMethods[0]?.channel || 'wechat');
        setCreating(false);
      })
      .catch((err: any) => {
        setCreating(false);
        setFailed(true);
        setFailReason(err?.msg || '获取支付信息失败');
      });
  }, [router.params]);

  const handlePay = useCallback(() => {
    if (paying || !tradeNo) return;
    if (!payMethod) {
      Taro.showToast({ title: '请选择支付方式', icon: 'none' });
      return;
    }
    setPaying(true);

    requestOrderPayment({ orderNo: tradeNo, payMethod })
      .then((res: any) => {
        const data = res?.data || res;
        const payInfo = data?.payParams || data?.payInfo;
        if (payMethod === 'wechat' && payInfo) {
          const parsedPayInfo = typeof payInfo === 'string' ? JSON.parse(payInfo) : payInfo;
          Taro.requestPayment({
            ...parsedPayInfo,
            success: () => {
              Taro.redirectTo({
                url: `/pages/order/pay-result/index?totalPaid=${payAmount}&orderNo=${tradeNo}`,
              });
            },
            fail: (err) => {
              Taro.showToast({ title: err?.errMsg?.includes('cancel') ? '支付取消' : '支付失败', icon: 'none' });
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
    Taro.redirectTo({ url: '/pages/order/order-list/index' });
  }, []);

  return (
    <View className="cashier warm-page-enter">
      <View className="cashier__amount-card">
        <Text className="cashier__amount-label">支付金额</Text>
        <View className="cashier__amount-value">
          <Price price={payAmount} className="cashier__price" fill />
        </View>
      </View>

      <View className="cashier__methods">
        <Text className="cashier__methods-title">支付方式</Text>
        {creating && <Text className="cashier__loading-text">支付信息加载中...</Text>}
        {!creating && failed && <Text className="cashier__loading-text">{failReason || '加载失败'}</Text>}
        {!creating && !failed && payMethods.map((method) => {
          const active = payMethod === method.channel;
          const disabled = method.enabled === false;
          return (
            <View
              key={method.channel}
              className={`cashier__method ${active ? 'cashier__method--active' : ''} ${disabled ? 'cashier__method--disabled' : ''}`}
              onClick={() => !disabled && setPayMethod(method.channel)}
            >
              <View className="cashier__method-left">
                <View className="cashier__method-icon">💬</View>
                <Text className="cashier__method-name">
                  {method.name || method.channelName || (method.channel === 'wechat' ? '微信支付' : method.channel)}
                </Text>
              </View>
              <View className={`cashier__radio ${active ? 'cashier__radio--checked' : ''}`} />
            </View>
          );
        })}
      </View>

      <View className="cashier__footer">
        <View
          className={`cashier__pay-btn ${paying || creating || failed ? 'cashier__pay-btn--disabled' : ''}`}
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
