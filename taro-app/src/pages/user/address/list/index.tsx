import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { Swipe } from '@nutui/nutui-react-taro';
import { fetchDeliveryAddressList, deleteAddress } from '../../../../services/address/fetchAddress';
import './index.scss';

interface AddressItem {
  id: string;
  name: string;
  phone: string;
  provinceName: string;
  cityName: string;
  districtName: string;
  detailAddress: string;
  isDefault: boolean;
}

export default function AddressList() {
  const [list, setList] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchDeliveryAddressList()
      .then((res: any) => {
        const addresses = (res || []).map((item: any) => ({
          id: item.id || item.addressId || '',
          name: item.name || item.receiverName || '',
          phone: item.phone || item.receiverPhone || '',
          provinceName: item.provinceName || '',
          cityName: item.cityName || '',
          districtName: item.districtName || '',
          detailAddress: item.detailAddress || item.address || '',
          isDefault: !!item.isDefault,
        }));
        setList(addresses);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useDidShow(() => {
    loadData();
  });

  const handleEdit = useCallback((addr: AddressItem) => {
    Taro.navigateTo({
      url: `/pages/user/address/edit/index?id=${addr.id}`,
    });
  }, []);

  const handleDelete = useCallback(
    (addr: AddressItem) => {
      Taro.showModal({
        title: '提示',
        content: '确认删除该地址吗？',
      }).then((res) => {
        if (res.confirm) {
          deleteAddress(addr.id)
            .then(() => {
              Taro.showToast({ title: '已删除', icon: 'success' });
              loadData();
            })
            .catch(() => {
              Taro.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      });
    },
    [loadData],
  );

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/pages/user/address/edit/index' });
  }, []);

  const buildFullAddress = (addr: AddressItem) => {
    return [addr.provinceName, addr.cityName, addr.districtName, addr.detailAddress]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <View className="address-list">
      {/* Loading */}
      {loading && (
        <View className="address-list__state">
          <Text className="address-list__state-text">加载中...</Text>
        </View>
      )}

      {/* Empty */}
      {!loading && list.length === 0 && (
        <View className="address-list__state">
          <Text className="address-list__state-text">暂无收货地址</Text>
        </View>
      )}

      {/* List */}
      <View className="address-list__items">
        {list.map((addr) => (
          <Swipe
            key={addr.id}
            rightAction={
              <View className="address-list__swipe-actions">
                <View
                  className="address-list__swipe-btn address-list__swipe-btn--edit"
                  onClick={() => handleEdit(addr)}
                >
                  <Text className="address-list__swipe-btn-text">编辑</Text>
                </View>
                <View
                  className="address-list__swipe-btn address-list__swipe-btn--delete"
                  onClick={() => handleDelete(addr)}
                >
                  <Text className="address-list__swipe-btn-text">删除</Text>
                </View>
              </View>
            }
          >
            <View className="address-list__card" onClick={() => handleEdit(addr)}>
              <View className="address-list__card-header">
                <Text className="address-list__name">{addr.name}</Text>
                <Text className="address-list__phone">{addr.phone}</Text>
                {addr.isDefault && (
                  <View className="address-list__default-badge">
                    <Text className="address-list__default-badge-text">默认</Text>
                  </View>
                )}
              </View>
              <Text className="address-list__address">{buildFullAddress(addr)}</Text>
            </View>
          </Swipe>
        ))}
      </View>

      {/* Add button */}
      <View className="address-list__add-wrap">
        <View className="address-list__add-btn" onClick={handleAdd}>
          <Text className="address-list__add-btn-text">+ 新增地址</Text>
        </View>
      </View>
    </View>
  );
}
