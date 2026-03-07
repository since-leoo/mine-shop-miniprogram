import { View, Text, Image, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, TextArea } from '@nutui/nutui-react-taro';
import { fetchSettleDetail, dispatchCommitPay } from '../../../services/order/orderConfirm';
import Price from '../../../components/Price';
import './index.scss';

interface GoodsItem {
  skuId: string;
  spuId: string;
  image: string;
  goodsName: string;
  specs: string[];
  price: number | string;
  quantity: number;
}

interface SettleData {
  settleType: number;
  totalSalePrice: number;
  totalDeliveryFee: number;
  totalPromotionAmount: number;
  totalCouponAmount: number;
  totalPayAmount: number;
  totalGoodsCount: number;
  invoiceSupport?: boolean;
  storeGoodsList: any[];
  userAddress?: any;
}

interface OrderCardItem {
  id: string;
  thumb: string;
  title: string;
  specs: string;
  price: number | string;
  num: number;
}

export default function OrderConfirm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settleData, setSettleData] = useState<SettleData | null>(null);
  const [orderCardList, setOrderCardList] = useState<OrderCardItem[]>([]);
  const [userAddress, setUserAddress] = useState<any>(null);
  const [remark, setRemark] = useState('');
  const [dialogShow, setDialogShow] = useState(false);
  const [tempRemark, setTempRemark] = useState('');
  const payLockRef = useRef(false);
  const goodsRequestListRef = useRef<any[]>([]);
  const orderTypeRef = useRef('normal');
  const activityIdRef = useRef<string | null>(null);

  const handleSettleData = useCallback((resData: any) => {
    const price = resData.price || {};
    let addr = resData.userAddress;
    if (addr) {
      addr = {
        ...addr,
        provinceName: addr.provinceName || addr.province || '',
        cityName: addr.cityName || addr.city || '',
        districtName: addr.districtName || addr.district || '',
        detailAddress: addr.detailAddress || addr.detail || addr.fullAddress || '',
      };
    }

    const mapped: SettleData = {
      settleType: resData.settleType,
      totalSalePrice: price.goodsAmount || 0,
      totalDeliveryFee: price.shippingFee || 0,
      totalPromotionAmount: price.discountAmount || 0,
      totalCouponAmount: resData.couponAmount || 0,
      totalPayAmount: price.payAmount || 0,
      totalGoodsCount: resData.goodsCount || 0,
      invoiceSupport: resData.invoiceSupport,
      storeGoodsList: resData.storeGoodsList || [],
      userAddress: addr,
    };

    if (addr) setUserAddress(addr);
    setSettleData(mapped);

    // Build card list from items
    const cards: OrderCardItem[] = (resData.items || []).map((item: any) => ({
      id: item.skuId,
      thumb: item.productImage,
      title: item.productName,
      specs: Array.isArray(item.specValues)
        ? item.specValues.map((sv: any) => (typeof sv === 'string' ? sv : sv.valueName || '')).join(' ')
        : '',
      price: item.unitPrice,
      num: item.quantity,
    }));
    setOrderCardList(cards);
  }, []);

  const loadSettleDetail = useCallback((goodsRequestList: any[], addressReq?: any) => {
    setLoading(true);
    const params: any = {
      goodsRequestList: goodsRequestList.map((g) => ({
        skuId: g.skuId,
        quantity: g.quantity,
      })),
      userAddress: addressReq || undefined,
      addressId: addressReq?.id || null,
      orderType: orderTypeRef.current,
      activityId: activityIdRef.current,
    };

    fetchSettleDetail(params)
      .then((res: any) => {
        setLoading(false);
        const resData = res?.data || res;
        handleSettleData(resData);
      })
      .catch((err: any) => {
        setLoading(false);
        const msg = err?.msg || '订单预览失败，请重试';
        Taro.showToast({ title: msg, icon: 'none', duration: 3000 });
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/home/index' });
        }, 3000);
      });
  }, [handleSettleData]);

  useEffect(() => {
    const params = router.params;
    let goodsRequestList: any[] = [];

    if (params.type === 'cart') {
      const json = Taro.getStorageSync('order.goodsRequestList');
      goodsRequestList = json ? JSON.parse(json) : [];
    } else if (params.goodsRequestList) {
      goodsRequestList = JSON.parse(params.goodsRequestList);
    }

    const firstGoods = goodsRequestList[0] || {};
    orderTypeRef.current = firstGoods.orderType || 'normal';
    activityIdRef.current = firstGoods.activityId || null;

    goodsRequestListRef.current = goodsRequestList;
    loadSettleDetail(goodsRequestList);
  }, [router.params, loadSettleDetail]);

  const handleGotoAddress = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/user/address/list/index?selectMode=1&isOrderSure=1`,
    });
  }, []);

  const handleOpenNotes = useCallback(() => {
    setTempRemark(remark);
    setDialogShow(true);
  }, [remark]);

  const handleNoteConfirm = useCallback(() => {
    setRemark(tempRemark);
    setDialogShow(false);
  }, [tempRemark]);

  const handleNoteCancel = useCallback(() => {
    setDialogShow(false);
  }, []);

  const handleSubmitOrder = useCallback(() => {
    if (!settleData) return;
    const address = settleData.userAddress || userAddress;

    if (!address) {
      Taro.showToast({ title: '请添加收货地址', icon: 'none' });
      return;
    }
    if (payLockRef.current || !settleData.settleType) return;
    payLockRef.current = true;

    const params: any = {
      goodsRequestList: goodsRequestListRef.current.map((g) => ({
        skuId: g.skuId,
        quantity: g.quantity,
      })),
      userAddress: address,
      addressId: address.id || null,
      userName: address.name || '',
      totalAmount: settleData.totalPayAmount,
      orderType: orderTypeRef.current,
      activityId: activityIdRef.current,
      storeInfoList: [{ storeId: '1', remark }],
    };

    dispatchCommitPay(params)
      .then((res: any) => {
        payLockRef.current = false;
        const tradeNo = res.tradeNo;
        if (!tradeNo) {
          Taro.showToast({ title: '订单提交失败', icon: 'none' });
          return;
        }
        const payAmount = settleData.totalPayAmount || 0;
        Taro.redirectTo({
          url: `/pages/order/cashier/index?tradeNo=${tradeNo}&payAmount=${payAmount}`,
        });
      })
      .catch((err: any) => {
        payLockRef.current = false;
        Taro.showToast({ title: err?.msg || '提交订单失败', icon: 'none' });
      });
  }, [settleData, userAddress, remark]);

  if (loading) {
    return (
      <View className="order-confirm order-confirm--loading">
        <Text className="order-confirm__loading-text">加载中...</Text>
      </View>
    );
  }

  if (!settleData) return null;

  const addressText = userAddress
    ? `${userAddress.provinceName || ''}${userAddress.cityName || ''}${userAddress.districtName || ''}${userAddress.detailAddress || ''}`
    : '';

  return (
    <View className="order-confirm">
      {/* Address card */}
      <View className="address-card" onClick={handleGotoAddress}>
        {userAddress ? (
          <View className="address-card__content">
            <View className="address-card__icon">📍</View>
            <View className="address-card__info">
              <View className="address-card__user">
                <Text className="address-card__name">{userAddress.name}</Text>
                <Text className="address-card__phone">{userAddress.phone}</Text>
              </View>
              <Text className="address-card__detail">{addressText}</Text>
            </View>
            <View className="address-card__arrow">›</View>
          </View>
        ) : (
          <View className="address-card__empty">
            <Text className="address-card__empty-text">+ 添加收货地址</Text>
          </View>
        )}
      </View>

      {/* Goods list */}
      <View className="goods-section">
        <View className="goods-section__header">
          <Text className="goods-section__store-icon">🏪</Text>
          <Text className="goods-section__store-name">商城</Text>
        </View>
        {orderCardList.map((goods) => (
          <View className="goods-item" key={goods.id}>
            <Image className="goods-item__img" src={goods.thumb} mode="aspectFill" />
            <View className="goods-item__info">
              <Text className="goods-item__title">{goods.title}</Text>
              {goods.specs && <Text className="goods-item__specs">{goods.specs}</Text>}
            </View>
            <View className="goods-item__right">
              <Price price={goods.price} className="goods-item__price" />
              <Text className="goods-item__num">x{goods.num}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Price breakdown */}
      <View className="price-detail">
        <View className="price-detail__item">
          <Text className="price-detail__label">商品总额</Text>
          <Price price={settleData.totalSalePrice || 0} className="price-detail__value" fill />
        </View>
        <View className="price-detail__item">
          <Text className="price-detail__label">运费</Text>
          {settleData.totalDeliveryFee > 0 ? (
            <View className="price-detail__value-row">
              <Text className="price-detail__plus">+</Text>
              <Price price={settleData.totalDeliveryFee} className="price-detail__value" fill />
            </View>
          ) : (
            <Text className="price-detail__value price-detail__value--free">免运费</Text>
          )}
        </View>
        <View className="price-detail__item">
          <Text className="price-detail__label">活动优惠</Text>
          <View className="price-detail__value-row">
            <Text className="price-detail__minus">-</Text>
            <Price price={settleData.totalPromotionAmount || 0} className="price-detail__value price-detail__value--discount" fill />
          </View>
        </View>
        <View className="price-detail__item">
          <Text className="price-detail__label">优惠券</Text>
          {settleData.totalCouponAmount > 0 ? (
            <View className="price-detail__value-row">
              <Text className="price-detail__minus">-</Text>
              <Price price={settleData.totalCouponAmount} className="price-detail__value price-detail__value--discount" fill />
            </View>
          ) : (
            <Text className="price-detail__value price-detail__value--hint">选择优惠券 ›</Text>
          )}
        </View>
        <View className="price-detail__item" onClick={handleOpenNotes}>
          <Text className="price-detail__label">订单备注</Text>
          <View className="price-detail__value-row">
            <Text className="price-detail__remark">
              {remark || '选填，建议先和商家沟通确认'}
            </Text>
            <Text className="price-detail__arrow">›</Text>
          </View>
        </View>
      </View>

      {/* Summary */}
      <View className="order-summary">
        <Text className="order-summary__count">共{settleData.totalGoodsCount}件</Text>
        <Text className="order-summary__label">小计</Text>
        <Price price={settleData.totalPayAmount} className="order-summary__price" />
      </View>

      {/* Bottom bar spacer */}
      <View className="bottom-spacer" />

      {/* Bottom bar */}
      <View className="bottom-bar">
        <View className="bottom-bar__price">
          <Price price={settleData.totalPayAmount || 0} className="bottom-bar__total" fill />
        </View>
        <View
          className={`bottom-bar__submit ${settleData.settleType !== 1 ? 'bottom-bar__submit--disabled' : ''}`}
          onClick={handleSubmitOrder}
        >
          <Text className="bottom-bar__submit-text">提交订单</Text>
        </View>
      </View>

      {/* Remark dialog */}
      <Dialog
        title="填写备注信息"
        visible={dialogShow}
        onConfirm={handleNoteConfirm}
        onCancel={handleNoteCancel}
      >
        <TextArea
          value={tempRemark}
          placeholder="备注信息"
          maxLength={50}
          onChange={(val) => setTempRemark(val)}
          className="remark-textarea"
        />
      </Dialog>
    </View>
  );
}
