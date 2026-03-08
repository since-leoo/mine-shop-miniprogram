import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useRef, useState } from 'react';
import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import './index.scss';

interface UserInfo {
  avatarUrl: string;
  nickName: string;
  phoneNumber: string;
  inviteCode?: string;
  gender?: number;
  balance?: number;
}

interface OrderTagInfo {
  title: string;
  icon: string;
  orderNum: number;
  tabType: number;
  status: number;
}

interface CountsData {
  num: number;
  name: string;
  type: string;
}

interface MenuItem {
  title: string;
  icon: string;
  note: string;
  type: string;
}

interface WalletItem {
  num: string;
  label: string;
  type: string;
}

const defaultOrderTags: OrderTagInfo[] = [
  { title: '待付款', icon: '💳', orderNum: 0, tabType: 5, status: 1 },
  { title: '待发货', icon: '📦', orderNum: 0, tabType: 10, status: 1 },
  { title: '待收货', icon: '🚚', orderNum: 0, tabType: 40, status: 1 },
  { title: '待评价', icon: '☆', orderNum: 0, tabType: 60, status: 1 },
  { title: '退换/售后', icon: '⇄', orderNum: 0, tabType: 0, status: 1 },
];

const defaultMenuGroups: MenuItem[][] = [
  [
    { title: '收货地址', icon: '📍', note: '', type: 'address' },
    { title: '优惠券', icon: '🎟', note: '', type: 'coupon' },
    { title: '我的钱包', icon: '💰', note: '', type: 'wallet' },
  ],
  [
    { title: '联系客服', icon: '💬', note: '', type: 'help' },
    { title: '设置', icon: '⚙', note: '', type: 'settings' },
  ],
];

export default function UserCenter() {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    avatarUrl: '',
    nickName: '正在登录...',
    phoneNumber: '',
  });
  const [orderTags, setOrderTags] = useState<OrderTagInfo[]>(defaultOrderTags);
  const [menuGroups, setMenuGroups] = useState<MenuItem[][]>(defaultMenuGroups);
  const [walletItems, setWalletItems] = useState<WalletItem[]>([
    { num: '0', label: '优惠券', type: 'coupon' },
    { num: '0', label: '积分', type: 'points' },
    { num: '¥0', label: '余额', type: 'balance' },
    { num: '0', label: '收藏', type: 'collect' },
  ]);
  const [versionNo, setVersionNo] = useState('');
  const profileNavigatingRef = useRef(false);

  const fetchData = () => {
    fetchUserCenter()
      .then((res: any) => {
        const { userInfo: info, countsData, orderTagInfos } = res;

        if (info) {
          setUserInfo(info);
          const balanceYuan = `¥${((info.balance || 0) / 100).toFixed(0)}`;
          setWalletItems((prev) =>
            prev.map((item) => (item.type === 'balance' ? { ...item, num: balanceYuan } : item))
          );
        }

        if (orderTagInfos) {
          const merged = defaultOrderTags.map((tag, index) => ({
            ...tag,
            orderNum: orderTagInfos[index]?.orderNum ?? tag.orderNum,
          }));
          setOrderTags(merged);
        }

        if (countsData) {
          const countMap = new Map((countsData as CountsData[]).map((item) => [item.type, item.num]));
          setWalletItems((prev) =>
            prev.map((item) => {
              if (item.type === 'coupon') return { ...item, num: String(countMap.get('coupon') ?? item.num) };
              if (item.type === 'points') return { ...item, num: String(countMap.get('point') ?? countMap.get('points') ?? item.num) };
              if (item.type === 'collect') return { ...item, num: String(countMap.get('collect') ?? item.num) };
              return item;
            })
          );

          const updated = defaultMenuGroups.map((group) =>
            group.map((item) => {
              const found = (countsData as CountsData[]).find((c) => c.type === item.type);
              if (!found) return { ...item, note: '' };
              if (item.type === 'coupon') return { ...item, note: `${found.num || 0}张可用` };
              return { ...item, note: '' };
            })
          );
          setMenuGroups(updated);
        }

        Taro.stopPullDownRefresh();
      })
      .catch(() => {
        Taro.stopPullDownRefresh();
      });
  };

  useDidShow(() => {
    fetchData();
    try {
      const accountInfo = Taro.getAccountInfoSync();
      const miniProgram = accountInfo?.miniProgram || ({} as any);
      const envVersion = miniProgram.envVersion || '';
      setVersionNo(envVersion === 'release' ? miniProgram.version || '' : envVersion || '');
    } catch (err) {
      console.warn('getAccountInfoSync failed', err);
    }
  });

  const handleOrderTagClick = (tag: OrderTagInfo) => {
    if (tag.tabType === 0) {
      Taro.navigateTo({ url: '/pages/order/after-service-list/index' });
    } else {
      Taro.navigateTo({ url: `/pages/order/order-list/index?status=${tag.tabType}` });
    }
  };

  const handleAllOrders = () => {
    Taro.navigateTo({ url: '/pages/order/order-list/index' });
  };

  const handleMenuClick = (type: string) => {
    switch (type) {
      case 'address':
        Taro.navigateTo({ url: '/pages/user/address/list/index' });
        break;
      case 'coupon':
        Taro.navigateTo({ url: '/pages/coupon/coupon-list/index' });
        break;
      case 'wallet':
        Taro.navigateTo({ url: '/pages/usercenter/wallet-transactions/index' });
        break;
      case 'help':
        Taro.showToast({ title: '联系客服', icon: 'none' });
        break;
      case 'settings':
        Taro.navigateTo({ url: '/pages/user/person-info/index' });
        break;
      default:
        break;
    }
  };

  const handleAvatarClick = () => {
    if (profileNavigatingRef.current) return;
    profileNavigatingRef.current = true;
    Taro.navigateTo({
      url: '/pages/user/person-info/index',
      complete: () => {
        setTimeout(() => {
          profileNavigatingRef.current = false;
        }, 300);
      },
    });
  };

  return (
    <View className="usercenter">
      {/* Header with gradient background */}
      <View className="usercenter__header">
        <View className="usercenter__header-bg">
          <View className="usercenter__header-circle" />
          <View className="usercenter__header-content" onClick={handleAvatarClick}>
            <View className="usercenter__avatar-wrap">
              {userInfo.avatarUrl ? (
                <Image className="usercenter__avatar" src={userInfo.avatarUrl} mode="aspectFill" />
              ) : (
                <Text className="usercenter__avatar-emoji">👤</Text>
              )}
            </View>
            <View className="usercenter__info">
              <Text className="usercenter__nickname">{userInfo.nickName}</Text>
              <Text className="usercenter__phone">
                邀请码: {userInfo.inviteCode || 'WARM2026'}
              </Text>
            </View>
            <View
              className="usercenter__qrcode"
              onClick={(e) => {
                e.stopPropagation();
                handleAvatarClick();
              }}
            >
              <Text className="usercenter__qrcode-icon">›</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Wallet card (floating) */}
      <View className="usercenter__wallet-card">
        {walletItems.map((item) => (
          <View key={item.type} className="usercenter__wallet-item">
            <Text className="usercenter__wallet-num">{item.num}</Text>
            <Text className="usercenter__wallet-label">{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Order section */}
      <View className="usercenter__orders-card">
        <View className="usercenter__orders-header" onClick={handleAllOrders}>
          <Text className="usercenter__orders-title">我的订单</Text>
          <View className="usercenter__orders-all">
            <Text className="usercenter__orders-all-text">全部订单 ›</Text>
          </View>
        </View>
        <View className="usercenter__orders-tags">
          {orderTags.map((tag) => (
            <View
              key={tag.tabType}
              className="usercenter__order-tag"
              onClick={() => handleOrderTagClick(tag)}
            >
              <View className="usercenter__order-tag-icon-wrap">
                <Text className="usercenter__order-tag-icon">{tag.icon}</Text>
                {tag.orderNum > 0 && (
                  <View className="usercenter__order-tag-badge">
                    <Text className="usercenter__order-tag-badge-text">
                      {tag.orderNum > 99 ? '99+' : tag.orderNum}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="usercenter__order-tag-text">{tag.title}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Menu sections */}
      {menuGroups.map((group, groupIdx) => (
        <View key={groupIdx} className="usercenter__menu-card">
          {group.map((item) => (
            <View
              key={item.type}
              className="usercenter__menu-item"
              onClick={() => handleMenuClick(item.type)}
            >
              <Text className="usercenter__menu-icon">{item.icon}</Text>
              <Text className="usercenter__menu-text">{item.title}</Text>
              {item.note ? (
                <Text className="usercenter__menu-note">{item.note}</Text>
              ) : null}
              <Text className="usercenter__menu-arrow">›</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Version */}
      <View className="usercenter__version">
        <Text className="usercenter__version-text">当前版本 {versionNo ? `v${versionNo}` : 'v1.0.0'}</Text>
      </View>
    </View>
  );
}
