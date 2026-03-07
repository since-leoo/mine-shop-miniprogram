import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter, usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchPromotion } from '../../../services/promotion/detail';
import GoodsList from '../../../components/GoodsList';
import './index.scss';

interface CountdownState {
  d: number;
  h: string;
  m: string;
  s: string;
}

function calcCountdown(ms: number): CountdownState | null {
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return { d, h, m, s };
}

export default function PromotionDetail() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [banner, setBanner] = useState('');
  const [statusTag, setStatusTag] = useState('');
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  const [loading, setLoading] = useState(true);

  const endTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    const tick = () => {
      const remaining = endTimeRef.current - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        clearTimer();
        return;
      }
      setCountdown(calcCountdown(remaining));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, [clearTimer]);

  const loadData = useCallback(() => {
    const promotionId = parseInt(router.params.promotion_id || '0');
    if (!promotionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPromotion(promotionId)
      .then(({ list: goodsList, banner: bannerUrl, time, showBannerDesc, statusTag: tag }) => {
        const goods = (goodsList || []).map((item: any) => ({
          ...item,
          tags: (item.tags || []).map((v: any) => v.title || v),
        }));
        setList(goods);
        setBanner(bannerUrl || '');
        setStatusTag(tag || '');
        if (time > 0) {
          endTimeRef.current = Date.now() + time;
          startTimer();
        }
      })
      .catch(() => {
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [router.params.promotion_id, startTimer]);

  useEffect(() => {
    loadData();
    return () => clearTimer();
  }, [loadData, clearTimer]);

  usePullDownRefresh(() => {
    loadData();
    Taro.stopPullDownRefresh();
  });

  const handleGoodsClick = useCallback((goods: any) => {
    const spuId = goods.spuId || goods.id || '';
    Taro.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
  }, []);

  const handleRulesClick = useCallback(() => {
    Taro.showToast({ title: '规则详情', icon: 'none' });
  }, []);

  return (
    <View className="promotion-detail">
      {/* Banner */}
      {banner && (
        <View className="promotion-detail__banner-wrap">
          <Image className="promotion-detail__banner-img" src={banner} mode="aspectFill" />
          <View className="promotion-detail__countdown-bar">
            {statusTag === 'finish' ? (
              <View className="promotion-detail__status-row">
                <View className="promotion-detail__status-badge promotion-detail__status-badge--finish">
                  <Text className="promotion-detail__status-badge-text">已结束</Text>
                </View>
                <Text className="promotion-detail__cd-label">活动已结束</Text>
              </View>
            ) : (
              <View className="promotion-detail__status-row">
                {statusTag === 'before' && (
                  <View className="promotion-detail__status-badge promotion-detail__status-badge--before">
                    <Text className="promotion-detail__status-badge-text">未开始</Text>
                  </View>
                )}
                {countdown && (
                  <>
                    <Text className="promotion-detail__cd-label">距结束仅剩</Text>
                    <View className="promotion-detail__cd-blocks">
                      {countdown.d > 0 && (
                        <Text className="promotion-detail__cd-day">{countdown.d}天</Text>
                      )}
                      <Text className="promotion-detail__cd-block">{countdown.h}</Text>
                      <Text className="promotion-detail__cd-sep">:</Text>
                      <Text className="promotion-detail__cd-block">{countdown.m}</Text>
                      <Text className="promotion-detail__cd-sep">:</Text>
                      <Text className="promotion-detail__cd-block">{countdown.s}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
            <View className="promotion-detail__rules-entry" onClick={handleRulesClick}>
              <Text className="promotion-detail__rules-label">规则详情</Text>
              <Text className="promotion-detail__rules-arrow">&rsaquo;</Text>
            </View>
          </View>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View className="promotion-detail__state">
          <Text className="promotion-detail__state-text">加载中...</Text>
        </View>
      )}

      {/* Empty */}
      {!loading && list.length === 0 && (
        <View className="promotion-detail__state">
          <Text className="promotion-detail__state-text">暂无活动商品</Text>
        </View>
      )}

      {/* Goods list */}
      {list.length > 0 && (
        <View className="promotion-detail__goods">
          <GoodsList
            goodsList={list.map((item) => ({
              id: item.spuId || item.id,
              thumb: item.thumb || item.primaryImage,
              title: item.title,
              price: item.price ?? item.minSalePrice,
              originPrice: item.originPrice ?? item.maxLinePrice,
              tags: item.tags || [],
            }))}
            onClickGoods={handleGoodsClick}
          />
        </View>
      )}
    </View>
  );
}
