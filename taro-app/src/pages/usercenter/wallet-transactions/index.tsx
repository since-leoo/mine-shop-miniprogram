import { View, Text } from '@tarojs/components';
import Taro, { useRouter, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs } from '@nutui/nutui-react-taro';
import { fetchWalletTransactions } from '../../../services/usercenter/fetchWalletTransactions';
import './index.scss';

const TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  recharge: '充值',
  withdraw: '提现',
  refund: '退款',
  reward: '奖励',
  deduct: '扣除',
  adjust: '调整',
};

interface TransactionItem {
  id: string;
  typeLabel: string;
  amount: number;
  amountText: string;
  source: string;
  createdAt: string;
}

function formatAmount(amount: number, type: string): string {
  if (type === 'balance') {
    const yuan = (Math.abs(amount) / 100).toFixed(2);
    return amount >= 0 ? '+' + yuan : '-' + yuan;
  }
  return amount > 0 ? '+' + amount : '' + amount;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const str = String(timeStr).replace('T', ' ').replace(/\.\d+Z?$/, '');
  return str.substring(0, 16);
}

export default function WalletTransactions() {
  const router = useRouter();
  const initialType = router.params.type === 'points' ? 'points' : 'balance';

  const [walletType, setWalletType] = useState(initialType);
  const [list, setList] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const title = walletType === 'points' ? '积分明细' : '余额明细';
    Taro.setNavigationBarTitle({ title });
  }, [walletType]);

  const fetchList = useCallback(
    (reset = false) => {
      if (loading) return;
      setLoading(true);

      const page = reset ? 1 : pageRef.current;

      fetchWalletTransactions({ walletType, page, pageSize: PAGE_SIZE })
        .then((res: any) => {
          const records = (res.list || []).map((item: any) => ({
            id: item.id,
            typeLabel: TYPE_LABELS[item.type] || item.type || '其他',
            amount: item.amount,
            amountText: formatAmount(item.amount, walletType),
            source: item.description || item.source || '',
            createdAt: formatTime(item.createdAt),
          }));

          const newList = reset ? records : [...list, ...records];
          const total = res.total || 0;

          setList(newList);
          setHasMore(newList.length < total);
          pageRef.current = (reset ? 1 : pageRef.current) + 1;
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [walletType, loading, list],
  );

  useEffect(() => {
    fetchList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletType]);

  usePullDownRefresh(() => {
    setList([]);
    setHasMore(true);
    pageRef.current = 1;
    fetchList(true);
    Taro.stopPullDownRefresh();
  });

  useReachBottom(() => {
    if (hasMore && !loading) {
      fetchList();
    }
  });

  const handleTabChange = useCallback((value: string | number) => {
    const type = value === 1 ? 'points' : 'balance';
    setWalletType(type);
    setList([]);
    setHasMore(true);
    pageRef.current = 1;
  }, []);

  return (
    <View className="wallet-page">
      {/* Tabs */}
      <View className="wallet-page__tabs">
        <Tabs
          value={walletType === 'points' ? 1 : 0}
          onChange={handleTabChange}
          activeType="simple"
          className="wallet-tabs"
        >
          <Tabs.TabPane title="余额" value={0} />
          <Tabs.TabPane title="积分" value={1} />
        </Tabs>
      </View>

      {/* Transaction list */}
      {list.length > 0 && (
        <View className="wallet-page__list">
          {list.map((item) => (
            <View key={item.id} className="wallet-page__item">
              <View className="wallet-page__item-info">
                <View className="wallet-page__item-header">
                  <Text className="wallet-page__type-label">{item.typeLabel}</Text>
                  {item.source && (
                    <Text className="wallet-page__source">{item.source}</Text>
                  )}
                </View>
                <Text className="wallet-page__time">{item.createdAt}</Text>
              </View>
              <Text
                className={`wallet-page__amount ${
                  item.amount >= 0 ? 'wallet-page__amount--positive' : 'wallet-page__amount--negative'
                }`}
              >
                {item.amountText}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty */}
      {!loading && list.length === 0 && (
        <View className="wallet-page__state">
          <Text className="wallet-page__state-text">暂无记录</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View className="wallet-page__state">
          <Text className="wallet-page__state-text">加载中...</Text>
        </View>
      )}

      {/* No more */}
      {!hasMore && list.length > 0 && (
        <View className="wallet-page__no-more">
          <Text className="wallet-page__no-more-text">没有更多了</Text>
        </View>
      )}
    </View>
  );
}
