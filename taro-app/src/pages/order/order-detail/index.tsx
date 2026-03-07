import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter, usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { fetchOrderDetail } from '../../../services/order/orderDetail';
import { cancelOrder, confirmReceipt } from '../../../services/order/orderList';
import Price from '../../../components/Price';
import './index.scss';

interface OrderGoods {
  id: string;
  thumb: string;
  title: string;
  specs: string[];
  price: number | string;
  num: number;
  skuId: string;
  spuId: string;
}

interface OrderData {
  id: string;
  orderNo: string;
  status: string;
  statusDesc: string;
  totalAmount: number;
  payAmount: number;
  shippingFee: number;
  discountAmount: number;
  couponAmount: number;
  remark: string;
  createdAt: string;
  paidAt: string;
  address: {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    fullAddress: string;
  };
  items: any[];
  buttonVOs: any[];
}

const STATUS_DESC_MAP: Record<string, string> = {
  pending: '待付款',
  paid: '待发货',
  shipped: '待收货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

export default function OrderDetail() {
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [goodsList, setGoodsList] = useState<OrderGoods[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback((orderNo: string) => {
    setLoading(true);
    fetchOrderDetail({ orderNo })
      .then((res: any) => {
        const data = res?.data || res;
        if (!data || !data.orderNo) {
          setLoading(false);
          return;
        }
        setOrder(data);
        const list: OrderGoods[] = (data.items || []).map((item: any) => ({
          id: item.id,
          thumb: item.productImage,
          title: item.productName,
          skuId: item.skuId,
          spuId: item.productId,
          specs: item.skuName ? [item.skuName] : [],
          price: item.unitPrice,
          num: item.quantity,
        }));
        setGoodsList(list);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      });
  }, []);

  useEffect(() => {
    const orderNo = router.params.orderNo || '';
    if (orderNo) loadDetail(orderNo);
  }, [router.params, loadDetail]);

  usePullDownRefresh(() => {
    const orderNo = router.params.orderNo || '';
    if (orderNo) loadDetail(orderNo);
    Taro.stopPullDownRefresh();
  });

  const handleCopyOrderNo = useCallback(() => {
    if (order) {
      Taro.setClipboardData({ data: order.orderNo });
    }
  }, [order]);

  const handlePayOrder = useCallback(() => {
    if (order) {
      Taro.navigateTo({
        url: `/pages/order/cashier/index?tradeNo=${order.orderNo}&mode=repay`,
      });
    }
  }, [order]);

  const handleCancelOrder = useCallback(() => {
    if (!order) return;
    Taro.showModal({ title: '提示', content: '确认取消该订单吗？' }).then((res) => {
      if (res.confirm) {
        cancelOrder(order.orderNo).then(() => {
          Taro.showToast({ title: '订单已取消', icon: 'none' });
          loadDetail(order.orderNo);
        });
      }
    });
  }, [order, loadDetail]);

  const handleConfirmReceipt = useCallback(() => {
    if (!order) return;
    Taro.showModal({ title: '提示', content: '确认收货？' }).then((res) => {
      if (res.confirm) {
        confirmReceipt(order.orderNo).then(() => {
          Taro.showToast({ title: '已确认收货', icon: 'none' });
          loadDetail(order.orderNo);
        });
      }
    });
  }, [order, loadDetail]);

  const handleGoodsTap = useCallback((goods: OrderGoods) => {
    Taro.navigateTo({ url: `/pages/goods/details/index?spuId=${goods.spuId}` });
  }, []);

  const handleApplyService = useCallback(() => {
    if (order) {
      Taro.navigateTo({ url: `/pages/order/apply-service/index?orderNo=${order.orderNo}` });
    }
  }, [order]);

  const handleViewDelivery = useCallback(() => {
    if (order) {
      Taro.navigateTo({ url: `/pages/order/delivery-detail/index?orderNo=${order.orderNo}` });
    }
  }, [order]);

  if (loading) {
    return (
      <View className="order-detail order-detail--loading">
        <Text className="order-detail__loading-text">加载中...</Text>
      </View>
    );
  }

  if (!order) return null;

  const addr = order.address || {} as any;
  const receiverAddress = addr.fullAddress || [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('');
  const statusDesc = order.statusDesc || STATUS_DESC_MAP[order.status] || order.status;
  const isPaid = !!order.paidAt;

  return (
    <View className="order-detail">
      {/* Status header */}
      <View className="order-detail__header">
        <Text className="order-detail__status">{statusDesc}</Text>
      </View>

      {/* Delivery tracking entry */}
      {(order.status === 'shipped' || order.status === 'completed') && (
        <View className="order-detail__logistics" onClick={handleViewDelivery}>
          <Text className="order-detail__logistics-icon">🚚</Text>
          <Text className="order-detail__logistics-text">查看物流</Text>
          <Text className="order-detail__logistics-arrow">›</Text>
        </View>
      )}

      {/* Address */}
      <View className="order-detail__address">
        <Text className="order-detail__address-icon">📍</Text>
        <View className="order-detail__address-info">
          <View className="order-detail__address-user">
            <Text className="order-detail__address-name">{addr.name || ''}</Text>
            <Text className="order-detail__address-phone">{addr.phone || ''}</Text>
          </View>
          <Text className="order-detail__address-detail">{receiverAddress}</Text>
        </View>
      </View>

      {/* Goods */}
      <View className="order-detail__goods-card">
        {goodsList.map((goods) => (
          <View className="order-detail__goods" key={goods.id} onClick={() => handleGoodsTap(goods)}>
            <Image className="order-detail__goods-img" src={goods.thumb} mode="aspectFill" />
            <View className="order-detail__goods-info">
              <Text className="order-detail__goods-title">{goods.title}</Text>
              {goods.specs.length > 0 && (
                <Text className="order-detail__goods-specs">{goods.specs.join(' ')}</Text>
              )}
            </View>
            <View className="order-detail__goods-right">
              <Price price={goods.price} className="order-detail__goods-price" />
              <Text className="order-detail__goods-num">x{goods.num}</Text>
            </View>
          </View>
        ))}

        {/* Price breakdown */}
        <View className="order-detail__price-section">
          <View className="order-detail__price-row">
            <Text className="order-detail__price-label">商品总额</Text>
            <Price price={order.totalAmount || 0} className="order-detail__price-value" fill />
          </View>
          <View className="order-detail__price-row">
            <Text className="order-detail__price-label">运费</Text>
            {order.shippingFee > 0 ? (
              <View className="order-detail__price-value-row">
                <Text>+</Text>
                <Price price={order.shippingFee} className="order-detail__price-value" fill />
              </View>
            ) : (
              <Text className="order-detail__price-value order-detail__price-value--free">免运费</Text>
            )}
          </View>
          <View className="order-detail__price-row">
            <Text className="order-detail__price-label">活动优惠</Text>
            <View className="order-detail__price-value-row">
              <Text className="order-detail__price-discount">-</Text>
              <Price price={order.discountAmount || 0} className="order-detail__price-value order-detail__price-value--discount" fill />
            </View>
          </View>
          <View className="order-detail__price-row">
            <Text className="order-detail__price-label">优惠券</Text>
            {(order.couponAmount || 0) > 0 ? (
              <View className="order-detail__price-value-row">
                <Text className="order-detail__price-discount">-</Text>
                <Price price={order.couponAmount} className="order-detail__price-value order-detail__price-value--discount" fill />
              </View>
            ) : (
              <Text className="order-detail__price-value">无可用</Text>
            )}
          </View>
          <View className="order-detail__price-row order-detail__price-row--total">
            <Text className="order-detail__price-label">{isPaid ? '实付' : '应付'}</Text>
            <Price price={order.payAmount || 0} className="order-detail__price-total" fill />
          </View>
        </View>
      </View>

      {/* Order info */}
      <View className="order-detail__info-card">
        <View className="order-detail__info-row">
          <Text className="order-detail__info-label">订单编号</Text>
          <View className="order-detail__info-value-row" onClick={handleCopyOrderNo}>
            <Text className="order-detail__info-value">{order.orderNo}</Text>
            <Text className="order-detail__info-copy">复制</Text>
          </View>
        </View>
        <View className="order-detail__info-row">
          <Text className="order-detail__info-label">下单时间</Text>
          <Text className="order-detail__info-value">{order.createdAt || ''}</Text>
        </View>
        <View className="order-detail__info-row">
          <Text className="order-detail__info-label">备注</Text>
          <Text className="order-detail__info-value">{order.remark || '-'}</Text>
        </View>
      </View>

      {/* Bottom bar spacer */}
      <View className="order-detail__bottom-spacer" />

      {/* Bottom actions */}
      <View className="order-detail__bottom-bar">
        {order.status === 'completed' && (
          <View className="order-detail__btn order-detail__btn--outline" onClick={handleApplyService}>
            <Text className="order-detail__btn-text order-detail__btn-text--outline">申请售后</Text>
          </View>
        )}
        {order.status === 'pending' && (
          <>
            <View className="order-detail__btn order-detail__btn--outline" onClick={handleCancelOrder}>
              <Text className="order-detail__btn-text order-detail__btn-text--outline">取消订单</Text>
            </View>
            <View className="order-detail__btn order-detail__btn--primary" onClick={handlePayOrder}>
              <Text className="order-detail__btn-text order-detail__btn-text--primary">立即支付</Text>
            </View>
          </>
        )}
        {order.status === 'shipped' && (
          <View className="order-detail__btn order-detail__btn--primary" onClick={handleConfirmReceipt}>
            <Text className="order-detail__btn-text order-detail__btn-text--primary">确认收货</Text>
          </View>
        )}
      </View>
    </View>
  );
}
