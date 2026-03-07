import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter, useReachBottom, usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from '@nutui/nutui-react-taro';
import { fetchOrders, fetchOrdersCount, cancelOrder, confirmReceipt } from '../../../services/order/orderList';
import Price from '../../../components/Price';
import LoadMore from '../../../components/LoadMore';
import './index.scss';

const OrderStatus = {
  PENDING_PAYMENT: 5,
  PENDING_DELIVERY: 10,
  PENDING_RECEIPT: 40,
  COMPLETE: 50,
};

const TABS = [
  { key: -1, text: '全部' },
  { key: OrderStatus.PENDING_PAYMENT, text: '待付款' },
  { key: OrderStatus.PENDING_DELIVERY, text: '待发货' },
  { key: OrderStatus.PENDING_RECEIPT, text: '待收货' },
  { key: OrderStatus.COMPLETE, text: '已完成' },
];

const STATUS_DESC_MAP: Record<number, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待付款',
  [OrderStatus.PENDING_DELIVERY]: '待发货',
  [OrderStatus.PENDING_RECEIPT]: '待收货',
  [OrderStatus.COMPLETE]: '已完成',
};

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

interface Order {
  id: string;
  orderNo: string;
  status: number;
  statusDesc: string;
  amount: number;
  totalAmount: number;
  freightFee: number;
  goodsList: OrderGoods[];
  buttons: any[];
  createTime: string;
}

const PAGE_SIZE = 5;

export default function OrderList() {
  const router = useRouter();
  const [curTab, setCurTab] = useState(-1);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [listLoading, setListLoading] = useState<0 | 1 | 2 | 3>(0);
  const [tabCounts, setTabCounts] = useState<Record<number, number>>({});
  const pageRef = useRef(1);

  const loadOrders = useCallback((status: number, page: number, reset = false) => {
    const params: any = {
      parameter: {
        pageSize: PAGE_SIZE,
        pageNum: page,
      },
    };
    if (status !== -1) params.parameter.orderStatus = status;
    setListLoading(1);

    return fetchOrders(params)
      .then((res: any) => {
        const orders: Order[] = res?.data?.orders || [];
        pageRef.current = page + 1;

        if (reset) {
          setOrderList(orders);
        } else {
          setOrderList((prev) => [...prev, ...orders]);
        }
        setListLoading(orders.length >= PAGE_SIZE ? 0 : 2);
      })
      .catch(() => {
        setListLoading(3);
      });
  }, []);

  const loadCounts = useCallback(() => {
    fetchOrdersCount()
      .then((res: any) => {
        const tabsCount = res?.data || [];
        const counts: Record<number, number> = {};
        tabsCount.forEach((item: any) => {
          counts[item.tabType] = item.orderNum;
        });
        setTabCounts(counts);
      })
      .catch(() => {});
  }, []);

  const refreshList = useCallback((status: number) => {
    pageRef.current = 1;
    setOrderList([]);
    loadOrders(status, 1, true);
    loadCounts();
  }, [loadOrders, loadCounts]);

  useEffect(() => {
    let status = parseInt(router.params.status || '-1');
    if (!TABS.some((t) => t.key === status)) status = -1;
    setCurTab(status);
    refreshList(status);
  }, [router.params, refreshList]);

  useReachBottom(() => {
    if (listLoading === 0) {
      loadOrders(curTab, pageRef.current);
    }
  });

  usePullDownRefresh(() => {
    refreshList(curTab);
    Taro.stopPullDownRefresh();
  });

  const handleTabChange = useCallback((value: string | number) => {
    const tabKey = Number(value);
    setCurTab(tabKey);
    refreshList(tabKey);
  }, [refreshList]);

  const handleOrderTap = useCallback((order: Order) => {
    Taro.navigateTo({
      url: `/pages/order/order-detail/index?orderNo=${order.orderNo}`,
    });
  }, []);

  const handlePayOrder = useCallback((order: Order) => {
    Taro.navigateTo({
      url: `/pages/order/cashier/index?tradeNo=${order.orderNo}&mode=repay`,
    });
  }, []);

  const handleCancelOrder = useCallback((order: Order) => {
    Taro.showModal({
      title: '提示',
      content: '确认取消该订单吗？',
    }).then((res) => {
      if (res.confirm) {
        cancelOrder(order.orderNo).then(() => {
          Taro.showToast({ title: '订单已取消', icon: 'none' });
          refreshList(curTab);
        });
      }
    });
  }, [curTab, refreshList]);

  const handleConfirmReceipt = useCallback((order: Order) => {
    Taro.showModal({
      title: '提示',
      content: '确认收货？',
    }).then((res) => {
      if (res.confirm) {
        confirmReceipt(order.orderNo).then(() => {
          Taro.showToast({ title: '已确认收货', icon: 'none' });
          refreshList(curTab);
        });
      }
    });
  }, [curTab, refreshList]);

  const handleRetry = useCallback(() => {
    loadOrders(curTab, pageRef.current);
  }, [curTab, loadOrders]);

  const tabIndex = TABS.findIndex((t) => t.key === curTab);

  return (
    <View className="order-list-page">
      <View className="order-list-page__tabs">
        <Tabs
          value={tabIndex >= 0 ? tabIndex : 0}
          onChange={(_val, index) => handleTabChange(TABS[index].key)}
          activeType="smile"
          className="order-tabs"
        >
          {TABS.map((tab) => (
            <Tabs.TabPane
              key={tab.key}
              title={tabCounts[tab.key] ? `${tab.text}(${tabCounts[tab.key]})` : tab.text}
            />
          ))}
        </Tabs>
      </View>

      <View className="order-list-page__content">
        {orderList.map((order) => (
          <View className="order-card" key={order.orderNo} onClick={() => handleOrderTap(order)}>
            <View className="order-card__header">
              <Text className="order-card__no">订单号 {order.orderNo}</Text>
              <Text className="order-card__status">
                {order.statusDesc || STATUS_DESC_MAP[order.status] || ''}
              </Text>
            </View>

            <View className="order-card__goods-list">
              {order.goodsList.slice(0, 3).map((goods) => (
                <View className="order-card__goods" key={goods.id}>
                  <Image className="order-card__goods-img" src={goods.thumb} mode="aspectFill" />
                  <View className="order-card__goods-info">
                    <Text className="order-card__goods-title">{goods.title}</Text>
                    {goods.specs && goods.specs.length > 0 && (
                      <Text className="order-card__goods-specs">{goods.specs.join(' ')}</Text>
                    )}
                  </View>
                  <View className="order-card__goods-right">
                    <Price price={goods.price} className="order-card__goods-price" />
                    <Text className="order-card__goods-num">x{goods.num}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View className="order-card__footer">
              <View className="order-card__total">
                <Text className="order-card__total-label">实付</Text>
                <Price price={order.amount} className="order-card__total-price" fill />
              </View>

              <View className="order-card__actions" onClick={(e) => e.stopPropagation()}>
                {order.status === OrderStatus.PENDING_PAYMENT && (
                  <>
                    <View
                      className="order-card__action-btn order-card__action-btn--outline"
                      onClick={(e) => { e.stopPropagation(); handleCancelOrder(order); }}
                    >
                      <Text className="order-card__action-text order-card__action-text--outline">取消</Text>
                    </View>
                    <View
                      className="order-card__action-btn order-card__action-btn--primary"
                      onClick={(e) => { e.stopPropagation(); handlePayOrder(order); }}
                    >
                      <Text className="order-card__action-text order-card__action-text--primary">付款</Text>
                    </View>
                  </>
                )}
                {order.status === OrderStatus.PENDING_RECEIPT && (
                  <View
                    className="order-card__action-btn order-card__action-btn--primary"
                    onClick={(e) => { e.stopPropagation(); handleConfirmReceipt(order); }}
                  >
                    <Text className="order-card__action-text order-card__action-text--primary">确认收货</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}

        <LoadMore
          status={listLoading}
          listIsEmpty={orderList.length === 0}
          onRetry={handleRetry}
          noMoreText="没有更多订单了"
        >
          <View className="order-list-page__empty">
            <Text className="order-list-page__empty-icon">📦</Text>
            <Text className="order-list-page__empty-text">暂无相关订单</Text>
          </View>
        </LoadMore>
      </View>
    </View>
  );
}
