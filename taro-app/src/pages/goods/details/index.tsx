import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Popup, InputNumber } from '@nutui/nutui-react-taro';
import { fetchGood } from '../../../services/good/fetchGood';
import { addCartItem } from '../../../services/cart/cart';
import {
  getGoodsDetailsCommentList,
  getGoodsDetailsCommentsCount,
} from '../../../services/good/fetchGoodsDetailsComments';
import Price from '../../../components/Price';
import './index.scss';

interface SkuItem {
  skuId: string;
  quantity: number;
  specInfo: any[];
  price: number;
  skuImage: string;
}

interface CommentsStatistics {
  badCount: number;
  commentCount: number;
  goodCount: number;
  goodRate: number;
  hasImageCount: number;
  middleCount: number;
}

export default function GoodsDetails() {
  const [details, setDetails] = useState<any>({});
  const [skuArray, setSkuArray] = useState<SkuItem[]>([]);
  const [primaryImage, setPrimaryImage] = useState('');
  const [specImg, setSpecImg] = useState('');
  const [minSalePrice, setMinSalePrice] = useState(0);
  const [maxSalePrice, setMaxSalePrice] = useState(0);
  const [maxLinePrice, setMaxLinePrice] = useState(0);
  const [soldNum, setSoldNum] = useState(0);
  const [isStock, setIsStock] = useState(true);
  const [soldout, setSoldout] = useState(false);
  const [swiperCurrent, setSwiperCurrent] = useState(0);

  // Spec popup
  const [showSpecPopup, setShowSpecPopup] = useState(false);
  const [selectedSku, setSelectedSku] = useState<Record<string, string>>({});
  const [isAllSelectedSku, setIsAllSelectedSku] = useState(false);
  const [selectedAttrStr, setSelectedAttrStr] = useState('');
  const [selectSkuSellsPrice, setSelectSkuSellsPrice] = useState(0);
  const [buyNum, setBuyNum] = useState(1);
  const [buyType, setBuyType] = useState(0); // 0=none, 1=buy, 2=cart

  // Comments
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentsStatistics, setCommentsStatistics] = useState<CommentsStatistics>({
    badCount: 0, commentCount: 0, goodCount: 0, goodRate: 0, hasImageCount: 0, middleCount: 0,
  });

  const [spuId, setSpuId] = useState('');
  const selectItemRef = useRef<SkuItem | null>(null);

  // --- Load detail ---
  const getDetail = useCallback(async (id: string) => {
    try {
      const data = await fetchGood(id);
      const skus: SkuItem[] = (data.skuList || []).map((item: any) => ({
        skuId: item.skuId,
        quantity: item.stockInfo ? item.stockInfo.stockQuantity : 0,
        specInfo: item.specInfo,
        price: item.priceInfo?.[0]?.price || item.price || 0,
        skuImage: item.skuImage || '',
      }));

      setDetails(data);
      setSkuArray(skus);
      setPrimaryImage(data.primaryImage || '');
      setIsStock((data.spuStockQuantity || 0) > 0);
      setSoldout(data.isPutOnSale === 0);
      setSoldNum(data.soldNum || 0);
      setMinSalePrice(data.minSalePrice ? parseInt(data.minSalePrice) : 0);
      setMaxSalePrice(data.maxSalePrice ? parseInt(data.maxSalePrice) : 0);
      setMaxLinePrice(data.maxLinePrice ? parseInt(data.maxLinePrice) : 0);
    } catch (err) {
      console.error('getDetail error:', err);
      Taro.showToast({ title: '商品加载失败', icon: 'none' });
    }
  }, []);

  const getCommentsList = useCallback(async (id: string) => {
    try {
      const data = await getGoodsDetailsCommentList(id);
      const list = (data.homePageComments || []).map((item: any) => ({
        goodsSpu: item.spuId,
        userName: item.userName || '',
        commentScore: item.commentScore,
        commentContent: item.commentContent || '用户未填写评价',
        userHeadUrl: item.userHeadUrl || '',
      }));
      setCommentsList(list);
    } catch (error) {
      console.error('comments error:', error);
    }
  }, []);

  const getCommentsStatistics = useCallback(async (id: string) => {
    try {
      const data = await getGoodsDetailsCommentsCount(id);
      setCommentsStatistics({
        badCount: parseInt(`${data.badCount}`),
        commentCount: parseInt(`${data.commentCount}`),
        goodCount: parseInt(`${data.goodCount}`),
        goodRate: Math.floor(data.goodRate * 10) / 10,
        hasImageCount: parseInt(`${data.hasImageCount}`),
        middleCount: parseInt(`${data.middleCount}`),
      });
    } catch (error) {
      console.error('comments statistics error:', error);
    }
  }, []);

  useEffect(() => {
    const instance = Taro.getCurrentInstance();
    const id = instance.router?.params?.spuId || '';
    setSpuId(id);
    if (id) {
      getDetail(id);
      getCommentsList(id);
      getCommentsStatistics(id);
    }
  }, [getDetail, getCommentsList, getCommentsStatistics]);

  // --- Spec selection ---
  const getSelectedSkuValues = useCallback((specList: any[], selected: Record<string, string>) => {
    const normalizedTree: Record<string, any[]> = {};
    (specList || []).forEach((treeItem: any) => {
      normalizedTree[treeItem.specId] = treeItem.specValueList;
    });
    return Object.keys(selected).reduce((acc: any[], skuKeyStr) => {
      const skuValues = normalizedTree[skuKeyStr];
      const skuValueId = selected[skuKeyStr];
      if (skuValueId && skuValues) {
        const skuValue = skuValues.find((v: any) => v.specValueId === skuValueId);
        if (skuValue) acc.push(skuValue);
      }
      return acc;
    }, []);
  }, []);

  const handleSpecSelect = useCallback((specId: string, specValueId: string) => {
    setSelectedSku((prev) => {
      const next = { ...prev };
      if (next[specId] === specValueId) {
        delete next[specId];
      } else {
        next[specId] = specValueId;
      }

      // Check if all specs selected
      const specList = details.specList || [];
      const allSelected = specList.length > 0 && specList.every((spec: any) => !!next[spec.specId]);
      setIsAllSelectedSku(allSelected);

      // Find matching sku
      const selectedValues = getSelectedSkuValues(specList, next);
      let attrStr = '';
      if (selectedValues.length > 0) {
        attrStr = selectedValues.map((v: any) => v.specValue).join(', ');
      }
      setSelectedAttrStr(attrStr);

      const matchedSku = skuArray.find((sku) => {
        return (sku.specInfo || []).every((si: any) =>
          next[si.specId] && next[si.specId] === si.specValueId
        );
      });

      if (matchedSku) {
        selectItemRef.current = matchedSku;
        setSelectSkuSellsPrice(matchedSku.price || 0);
        setSpecImg(matchedSku.skuImage || primaryImage);
      } else {
        selectItemRef.current = null;
        setSelectSkuSellsPrice(0);
        setSpecImg(primaryImage);
      }

      return next;
    });
  }, [details, skuArray, primaryImage, getSelectedSkuValues]);

  const showSkuSelectPopup = useCallback((type: number) => {
    setBuyType(type);
    setShowSpecPopup(true);
  }, []);

  const handleAddCart = useCallback(async () => {
    if (!isAllSelectedSku) {
      Taro.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    const skuId = selectItemRef.current?.skuId;
    if (!skuId) {
      Taro.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    try {
      await addCartItem({ skuId: Number(skuId), quantity: buyNum });
      Taro.showToast({ title: '已加入购物车', icon: 'success' });
      setShowSpecPopup(false);
    } catch (err: any) {
      Taro.showToast({ title: err.msg || '加入购物车失败', icon: 'none' });
    }
  }, [isAllSelectedSku, buyNum]);

  const handleBuyNow = useCallback(() => {
    if (!isAllSelectedSku) {
      Taro.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    setShowSpecPopup(false);

    const skuId = selectItemRef.current?.skuId || (details.skuList && details.skuList[0]?.skuId);
    const query = {
      quantity: buyNum,
      storeId: '1',
      spuId: details.spuId,
      goodsName: details.title,
      skuId: skuId,
      available: details.available,
      price: selectSkuSellsPrice || details.minSalePrice,
      specInfo: selectItemRef.current?.specInfo || [],
      primaryImage: details.primaryImage,
      thumb: details.primaryImage,
      title: details.title,
    };

    const urlQueryStr = `goodsRequestList=${encodeURIComponent(JSON.stringify([query]))}`;
    Taro.navigateTo({ url: `/pages/order/order-confirm/index?${urlQueryStr}` });
  }, [isAllSelectedSku, buyNum, details, selectSkuSellsPrice]);

  const handleSpecConfirm = useCallback(() => {
    if (buyType === 1) {
      handleBuyNow();
    } else {
      handleAddCart();
    }
  }, [buyType, handleBuyNow, handleAddCart]);

  const navToComments = useCallback(() => {
    Taro.navigateTo({ url: `/pages/goods/comments/index?spuId=${spuId}` });
  }, [spuId]);

  const handlePreviewImage = useCallback((index: number) => {
    const images = details.images || [];
    if (images.length > 0) {
      Taro.previewImage({ current: images[index], urls: images });
    }
  }, [details.images]);

  // --- Render helpers ---
  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} className={`star ${i < score ? 'star--active' : ''}`}>
        {i < score ? '\u2605' : '\u2606'}
      </Text>
    ));
  };

  const images = details.images || [];
  const specList = details.specList || [];
  const descImages = details.desc || [];

  return (
    <View className="goods-detail-page">
      {/* Image Swiper */}
      {images.length > 0 && (
        <View className="goods-swiper">
          <Swiper
            className="goods-swiper__inner"
            indicatorDots
            autoplay
            circular
            indicatorActiveColor="#E8836B"
            current={swiperCurrent}
            onChange={(e) => setSwiperCurrent(e.detail.current)}
          >
            {images.map((img: string, idx: number) => (
              <SwiperItem key={idx} onClick={() => handlePreviewImage(idx)}>
                <Image className="goods-swiper__img" src={img} mode="aspectFill" />
              </SwiperItem>
            ))}
          </Swiper>
          <View className="goods-swiper__counter">
            <Text className="goods-swiper__counter-text">{swiperCurrent + 1}/{images.length}</Text>
          </View>
        </View>
      )}

      {/* Price & Info */}
      <View className="goods-info">
        <View className="goods-info__price-row">
          <View className="goods-info__price-left">
            <Text className="goods-info__currency">¥</Text>
            <Text className="goods-info__price">
              {((selectSkuSellsPrice || minSalePrice) / 100).toFixed(2)}
            </Text>
            <Text className="goods-info__price-up">起</Text>
            {maxLinePrice > 0 && (
              <Text className="goods-info__origin-price">
                ¥{(maxLinePrice / 100).toFixed(2)}
              </Text>
            )}
          </View>
          <Text className="goods-info__sold">已售{soldNum}</Text>
        </View>

        <View className="goods-info__title-row">
          <Text className="goods-info__title">{details.title}</Text>
        </View>

        {details.intro && (
          <Text className="goods-info__intro">{details.intro}</Text>
        )}
      </View>

      {/* Spec Selector */}
      <View className="goods-spec-select" onClick={() => showSkuSelectPopup(0)}>
        <Text className="goods-spec-select__label">已选</Text>
        <View className="goods-spec-select__content">
          <Text className={`goods-spec-select__value ${!selectedAttrStr ? 'goods-spec-select__value--hint' : ''}`}>
            {selectedAttrStr ? `${buyNum} 件, ${selectedAttrStr}` : '请选择规格'}
          </Text>
          <Text className="goods-spec-select__arrow">{'\u203A'}</Text>
        </View>
      </View>

      {/* Comments Preview */}
      {commentsStatistics.commentCount > 0 && (
        <View className="goods-comments">
          <View className="goods-comments__header" onClick={navToComments}>
            <View className="goods-comments__title-wrap">
              <Text className="goods-comments__title">商品评价</Text>
              <Text className="goods-comments__count"> ({commentsStatistics.commentCount})</Text>
            </View>
            <View className="goods-comments__rate-wrap">
              <Text className="goods-comments__good-rate">{commentsStatistics.goodRate}% 好评</Text>
              <Text className="goods-comments__arrow">{'\u203A'}</Text>
            </View>
          </View>
          {commentsList.map((item, idx) => (
            <View key={idx} className="goods-comments__item">
              <View className="goods-comments__item-header">
                <Image className="goods-comments__avatar" src={item.userHeadUrl} />
                <View className="goods-comments__item-right">
                  <Text className="goods-comments__username">{item.userName}</Text>
                  <View className="goods-comments__stars">{renderStars(item.commentScore)}</View>
                </View>
              </View>
              <Text className="goods-comments__content">{item.commentContent}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Detail Description Images */}
      {descImages.length > 0 && (
        <View className="goods-desc">
          <View className="goods-desc__title-row">
            <View className="goods-desc__line" />
            <Text className="goods-desc__title-text">详情介绍</Text>
            <View className="goods-desc__line" />
          </View>
          {descImages.map((img: string, idx: number) => (
            <Image key={idx} className="goods-desc__img" src={img} mode="widthFix" />
          ))}
        </View>
      )}

      {/* Bottom placeholder for fixed bar */}
      <View className="goods-bottom-placeholder" />

      {/* Bottom Buy Bar */}
      <View className="goods-bottom-bar">
        <View className="goods-bottom-bar__icons">
          <View
            className="goods-bottom-bar__icon-item"
            onClick={() => Taro.switchTab({ url: '/pages/home/index' })}
          >
            <Text className="goods-bottom-bar__icon-emoji">{'\u{1F3E0}'}</Text>
            <Text className="goods-bottom-bar__icon-text">首页</Text>
          </View>
          <View
            className="goods-bottom-bar__icon-item"
            onClick={() => Taro.switchTab({ url: '/pages/cart/index' })}
          >
            <Text className="goods-bottom-bar__icon-emoji">{'\u{1F6D2}'}</Text>
            <Text className="goods-bottom-bar__icon-text">购物车</Text>
          </View>
        </View>
        <View className="goods-bottom-bar__btns">
          <View
            className="goods-bottom-bar__btn goods-bottom-bar__btn--cart"
            onClick={() => showSkuSelectPopup(2)}
          >
            <Text className="goods-bottom-bar__btn-text">加入购物车</Text>
          </View>
          <View
            className="goods-bottom-bar__btn goods-bottom-bar__btn--buy"
            onClick={() => showSkuSelectPopup(1)}
          >
            <Text className="goods-bottom-bar__btn-text">立即购买</Text>
          </View>
        </View>
      </View>

      {/* Spec Popup */}
      <Popup
        visible={showSpecPopup}
        position="bottom"
        round
        closeable
        onClose={() => setShowSpecPopup(false)}
        style={{ maxHeight: '80vh' }}
      >
        <View className="spec-popup">
          <View className="spec-popup__header">
            <Image
              className="spec-popup__img"
              src={specImg || primaryImage}
              mode="aspectFill"
            />
            <View className="spec-popup__header-info">
              <Text className="spec-popup__price">
                ¥{((selectSkuSellsPrice || minSalePrice) / 100).toFixed(2)}
              </Text>
              {selectedAttrStr ? (
                <Text className="spec-popup__selected-specs">{selectedAttrStr}</Text>
              ) : (
                <Text className="spec-popup__hint">请选择规格</Text>
              )}
            </View>
          </View>

          <View className="spec-popup__specs">
            {specList.map((spec: any) => (
              <View key={spec.specId} className="spec-popup__spec-group">
                <Text className="spec-popup__spec-title">{spec.title}</Text>
                <View className="spec-popup__spec-values">
                  {(spec.specValueList || []).map((val: any) => (
                    <View
                      key={val.specValueId}
                      className={`spec-popup__spec-tag ${selectedSku[spec.specId] === val.specValueId ? 'spec-popup__spec-tag--active' : ''}`}
                      onClick={() => handleSpecSelect(spec.specId, val.specValueId)}
                    >
                      <Text className="spec-popup__spec-tag-text">{val.specValue}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View className="spec-popup__quantity">
            <Text className="spec-popup__quantity-label">购买数量</Text>
            <InputNumber
              value={buyNum}
              min={1}
              max={99}
              onChange={(val) => setBuyNum(Number(val))}
            />
          </View>

          <View className="spec-popup__footer">
            <View className="spec-popup__confirm-btn" onClick={handleSpecConfirm}>
              <Text className="spec-popup__confirm-text">
                {buyType === 1 ? '立即购买' : '加入购物车'}
              </Text>
            </View>
          </View>
        </View>
      </Popup>
    </View>
  );
}
