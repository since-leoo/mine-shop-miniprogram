import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { Checkbox, InputNumber, Empty, Swipe } from '@nutui/nutui-react-taro';
import { fetchCartGroupData, updateCartItem, deleteCartItem } from '../../services/cart/cart';
import Price from '../../components/Price';
import './index.scss';

/** A single goods item inside a promotion group */
interface CartGoods {
  spuId: string;
  skuId: string;
  title: string;
  thumb: string;
  price: string;
  originPrice?: string;
  quantity: number;
  stockQuantity: number;
  specInfo?: string;
  isSelected?: boolean | number;
}

/** Promotion-level grouping */
interface PromotionGroup {
  promotionId?: string;
  goodsPromotionList: CartGoods[];
}

/** Store-level grouping */
interface StoreGroup {
  storeId: string;
  storeName?: string;
  isSelected?: boolean;
  promotionGoodsList: PromotionGroup[];
  shortageGoodsList?: CartGoods[];
  storeStockShortage?: boolean;
}

/** Root cart data returned by the API */
interface CartGroupData {
  storeGoods: StoreGroup[];
  invalidGoodItems?: CartGoods[];
  isNotEmpty?: boolean;
  isAllSelected?: boolean;
  totalAmount?: string;
  selectedGoodsCount?: number;
  totalDiscountAmount?: string;
}

/** Flatten all valid goods from the nested cart structure */
function flattenGoods(data: CartGroupData | null): CartGoods[] {
  if (!data) return [];
  const list: CartGoods[] = [];
  for (const store of data.storeGoods || []) {
    for (const promo of store.promotionGoodsList || []) {
      for (const g of promo.goodsPromotionList || []) {
        list.push(g);
      }
    }
  }
  return list;
}

export default function Cart() {
  const [cartData, setCartData] = useState<CartGroupData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  /** Load / reload cart from server */
  const refreshData = useCallback(() => {
    setLoading(true);
    fetchCartGroupData()
      .then((res) => {
        const data: CartGroupData = res.data;
        let isEmpty = true;

        for (const store of data.storeGoods || []) {
          if (!store.shortageGoodsList) store.shortageGoodsList = [];
          for (const promo of store.promotionGoodsList || []) {
            promo.goodsPromotionList = (promo.goodsPromotionList || []).filter((goods) => {
              goods.originPrice = undefined;
              if (goods.stockQuantity > 0) return true;
              store.shortageGoodsList!.push(goods);
              return false;
            });
            if (promo.goodsPromotionList.length > 0) isEmpty = false;
          }
          if (store.shortageGoodsList.length > 0) isEmpty = false;
        }

        (data.invalidGoodItems || []).forEach((g) => {
          g.originPrice = undefined;
        });
        data.isNotEmpty = !isEmpty;

        // Initialise selection: keep previously-selected items, or default to server flag
        const newSelected = new Set<string>();
        flattenGoods(data).forEach((g) => {
          const key = `${g.spuId}_${g.skuId}`;
          if (selectedIds.has(key) || g.isSelected) {
            newSelected.add(key);
          }
        });

        setSelectedIds(newSelected);
        setCartData(data);
      })
      .catch(() => {
        Taro.showToast({ title: '加载购物车失败', icon: 'none' });
      })
      .finally(() => setLoading(false));
  }, [selectedIds]);

  useDidShow(() => {
    refreshData();
  });

  // -------- derived --------
  const allGoods = flattenGoods(cartData);
  const isAllSelected = allGoods.length > 0 && allGoods.every((g) => selectedIds.has(`${g.spuId}_${g.skuId}`));
  const selectedGoods = allGoods.filter((g) => selectedIds.has(`${g.spuId}_${g.skuId}`));
  const totalAmount = selectedGoods.reduce((sum, g) => {
    return sum + (parseInt(g.price || '0', 10) || 0) * (g.quantity || 0);
  }, 0);
  const selectedCount = selectedGoods.reduce((sum, g) => sum + (g.quantity || 0), 0);

  // -------- handlers --------
  const handleToggleItem = useCallback(
    (spuId: string, skuId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const key = `${spuId}_${skuId}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [],
  );

  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const all = new Set<string>();
      allGoods.forEach((g) => all.add(`${g.spuId}_${g.skuId}`));
      setSelectedIds(all);
    }
  }, [isAllSelected, allGoods]);

  const handleQuantityChange = useCallback(
    (goods: CartGoods, value: number | string) => {
      const quantity = Number(value);
      if (isNaN(quantity) || quantity < 1) return;
      const stockQuantity = Math.max(0, goods.stockQuantity || 0);

      if (quantity > stockQuantity) {
        Taro.showToast({ title: '当前商品库存不足', icon: 'none' });
        return;
      }

      updateCartItem(goods.skuId, { quantity }).then(() => refreshData());
    },
    [refreshData],
  );

  const handleDelete = useCallback(
    (goods: CartGoods) => {
      Taro.showModal({
        title: '提示',
        content: '确认删除该商品吗？',
        confirmText: '确定',
        cancelText: '取消',
      }).then((res) => {
        if (res.confirm) {
          deleteCartItem(goods.skuId).then(() => {
            Taro.showToast({ title: '商品删除成功', icon: 'none' });
            refreshData();
          });
        }
      });
    },
    [refreshData],
  );

  const handleGoDetail = useCallback((spuId: string) => {
    Taro.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
  }, []);

  const handleSettle = useCallback(() => {
    if (selectedGoods.length === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    Taro.setStorageSync('order.goodsRequestList', JSON.stringify(selectedGoods));
    Taro.navigateTo({ url: '/pages/order/order-confirm/index?type=cart' });
  }, [selectedGoods]);

  const handleGoHome = useCallback(() => {
    Taro.switchTab({ url: '/pages/home/index' });
  }, []);

  // -------- render empty --------
  if (!loading && (!cartData || !cartData.isNotEmpty)) {
    return (
      <View className="cart-page cart-page--empty">
        <View className="cart-empty">
          <Empty description="购物车还是空的" />
          <View className="cart-empty__btn" onClick={handleGoHome}>
            <Text className="cart-empty__btn-text">去逛逛</Text>
          </View>
        </View>
      </View>
    );
  }

  // -------- render list --------
  return (
    <View className="cart-page">
      <View className="cart-list">
        {allGoods.map((goods) => {
          const key = `${goods.spuId}_${goods.skuId}`;
          const checked = selectedIds.has(key);

          return (
            <Swipe
              key={key}
              rightAction={
                <View className="cart-item__delete" onClick={() => handleDelete(goods)}>
                  <Text className="cart-item__delete-text">删除</Text>
                </View>
              }
            >
              <View className="cart-item">
                <View className="cart-item__checkbox" onClick={() => handleToggleItem(goods.spuId, goods.skuId)}>
                  <Checkbox checked={checked} />
                </View>

                <View className="cart-item__thumb" onClick={() => handleGoDetail(goods.spuId)}>
                  <Image className="cart-item__img" src={goods.thumb} mode="aspectFill" />
                </View>

                <View className="cart-item__info">
                  <Text className="cart-item__title" onClick={() => handleGoDetail(goods.spuId)}>
                    {goods.title}
                  </Text>
                  {goods.specInfo && (
                    <Text className="cart-item__spec">{goods.specInfo}</Text>
                  )}
                  <View className="cart-item__bottom">
                    <Price price={goods.price} className="cart-item__price" />
                    <View className="cart-item__quantity">
                      <InputNumber
                        min={1}
                        max={goods.stockQuantity || 99}
                        value={goods.quantity}
                        onChangeFuc={(value) => handleQuantityChange(goods, value)}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Swipe>
          );
        })}
      </View>

      {/* spacer for bottom bar */}
      <View className="cart-bottom-spacer" />

      {/* sticky bottom bar */}
      <View className="cart-bar">
        <View className="cart-bar__left" onClick={handleToggleAll}>
          <Checkbox checked={isAllSelected} />
          <Text className="cart-bar__all-text">全选</Text>
        </View>

        <View className="cart-bar__right">
          <View className="cart-bar__total">
            <Text className="cart-bar__total-label">
              合计：
            </Text>
            <Price price={totalAmount} className="cart-bar__total-price" />
          </View>
          <View
            className={`cart-bar__settle ${selectedCount === 0 ? 'cart-bar__settle--disabled' : ''}`}
            onClick={handleSettle}
          >
            <Text className="cart-bar__settle-text">
              结算{selectedCount > 0 ? `(${selectedCount})` : ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
