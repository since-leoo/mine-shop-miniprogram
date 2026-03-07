import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { Avatar, Badge } from '@nutui/nutui-react-taro';
import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import './index.scss';

interface UserInfo {
  avatarUrl: string;
  nickName: string;
  phoneNumber: string;
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
  { title: '待评价', icon: '⭐', orderNum: 0, tabType: 60, status: 1 },
  { title: '退换/售后', icon: '🔄', orderNum: 0, tabType: 0, status: 1 },
];

const defaultMenuGroups: MenuItem[][] = [
  [
    { title: '收货地址', icon: '📍', note: '', type: 'address' },
    { title: '优惠券', icon: '🎟️', note: '', type: 'coupon' },
    { title: '我的钱包', icon: '💰', note: '', type: 'wallet' },
  ],
  [
    { title: '联系客服', icon: '💬', note: '', type: 'help' },
    { title: '设置', icon: '⚙️', note: '', type: 'settings' },
  ],
];

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const fetchData = () => {
    fetchUserCenter()
      .then((res: any) => {
        const { userInfo: info, countsData, orderTagInfos } = res;

        if (info) {
          setUserInfo(info);
          setIsLoggedIn(true);
        }

        if (orderTagInfos) {
          const merged = defaultOrderTags.map((tag, index) => ({
            ...tag,
            orderNum: orderTagInfos[index]?.orderNum ?? tag.orderNum,
          }));
          setOrderTags(merged);
        }

        if (countsData) {
          const updated = defaultMenuGroups.map((group) =>
            group.map((item) => {
              const found = (countsData as CountsData[]).find((c) => c.type === item.type);
              return found ? { ...item, note: String(found.num) } : { ...item };
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
    if (isLoggedIn) {
      Taro.navigateTo({ url: '/pages/user/person-info/index' });
    }
  };

  return (
    <View className="usercenter">
      {/* Header with gradient background */}
      <View className="usercenter__header">
        <View className="usercenter__header-bg">
          <View className="usercenter__header-circle" />
        </View>
        <View className="usercenter__header-content" onClick={handleAvatarClick}>
          <View className="usercenter__avatar-wrap">
            {userInfo.avatarUrl ? (
              <Avatar
                size="large"
                src={userInfo.avatarUrl}
                className="usercenter__avatar"
              />
            ) : (
              <Text className="usercenter__avatar-emoji">👩</Text>
            )}
          </View>
          <View className="usercenter__info">
            <Text className="usercenter__nickname">{userInfo.nickName}</Text>
            {userInfo.phoneNumber ? (
              <Text className="usercenter__phone">{maskPhone(userInfo.phoneNumber)}</Text>
            ) : null}
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
                {tag.orderNum > 0 ? (
                  <Badge value={tag.orderNum > 99 ? '99+' : tag.orderNum}>
                    <Text className="usercenter__order-tag-icon">{tag.icon}</Text>
                  </Badge>
                ) : (
                  <Text className="usercenter__order-tag-icon">{tag.icon}</Text>
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
        <Text className="usercenter__version-text">当前版本 v1.0.0</Text>
      </View>
    </View>
  );
}
