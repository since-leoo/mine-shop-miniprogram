import { View, Text, ScrollView, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHome } from '../../services/home/home';
import { fetchGoodsList, fetchHotGoods } from '../../services/good/fetchGoods';
import { fetchGroupBuyList } from '../../services/promotion/groupBuy';
import { ensureMiniProgramLogin } from '../../common/auth';
import GoodsList from '../../components/GoodsList';
import LoadMore from '../../components/LoadMore';
import './index.scss';

const quickEntries = [
  { key: 'seckill', name: '限时特惠', icon: '🏷', bg: '#FFF1E8' },
  { key: 'groupbuy', name: '拼团活动', icon: '👥', bg: '#E8F5E9' },
  { key: 'coupon', name: '优惠券', icon: '🎟', bg: '#FFF3E0' },
  { key: 'hot', name: '热卖榜', icon: '🔥', bg: '#FCE4EC' },
  { key: 'category', name: '全部分类', icon: '◈', bg: '#F3E5F5' },
];

const PAGE_SIZE = 20;

interface CountdownState {
  days: number;
  hours: string;
  minutes: string;
  seconds: string;
}

function parseDateStringToMs(input: string): number {
  const raw = input.trim();
  if (!raw) return 0;

  const candidates: string[] = [raw];

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    candidates.push(raw.replace(/-/g, '/'));
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    candidates.push(raw.replace(' ', 'T'));
    candidates.push(raw.replace(/-/g, '/'));
  }

  for (const text of candidates) {
    const ms = new Date(text).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }

  return 0;
}

function pickArray(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.data?.records)) return res.data.records;
  return [];
}

function normalizeGroupItems(list: any[]): any[] {
  return (list || [])
    .filter(Boolean)
    .map((item: any) => ({
      ...item,
      spuId: item.spuId || item.id || item.goodsId || item.productId || '',
      activityId: item.activityId || item.groupBuyId || item.promotionId || item.activity_id || '',
      title: item.title || item.goodsName || item.name || item.spuName || '',
      thumb: item.thumb || item.primaryImage || item.image || item.pic || '',
      price: item.price ?? item.groupPrice ?? item.minSalePrice ?? 0,
      originPrice: item.originPrice ?? item.maxLinePrice ?? item.linePrice ?? 0,
    }))
    .filter((item: any) => !!item.spuId);
}

function resolveEndTime(input: any): number {
  if (input == null || input === '') return 0;

  let raw = Number(input);
  if (!Number.isFinite(raw)) {
    raw = parseDateStringToMs(String(input));
  }
  if (!raw || raw <= 0) return 0;

  // 13位毫秒时间戳
  if (raw >= 1e12) return raw;
  // 10位秒时间戳
  if (raw >= 1e9) return raw * 1000;

  // 其余按“剩余时长”处理：大值按毫秒，小值按秒
  const durationMs = raw >= 1e6 ? raw : raw * 1000;
  return Date.now() + durationMs;
}

function formatCountdown(ms: number): CountdownState {
  if (ms <= 0) return { days: 0, hours: '00', minutes: '00', seconds: '00' };
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    days: d,
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
}

export default function Home() {
  const [imgSrcs, setImgSrcs] = useState<string[]>([]);
  const [goodsList, setGoodsList] = useState<any[]>([]);
  const [goodsListLoadStatus, setGoodsListLoadStatus] = useState<0 | 1 | 2 | 3>(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [seckillList, setSeckillList] = useState<any[]>([]);
  const [seckillTitle, setSeckillTitle] = useState('限时秒杀');
  const [seckillCountdown, setSeckillCountdown] = useState<CountdownState | null>(null);
  const [seckillActivityId, setSeckillActivityId] = useState('');
  const [seckillSessionId, setSeckillSessionId] = useState('');
  const [groupBuyList, setGroupBuyList] = useState<any[]>([]);
  const [hotGoodsList, setHotGoodsList] = useState<any[]>([]);

  const pageIndexRef = useRef(1);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seckillEndTimeRef = useRef<number>(0);

  // --- countdown ---
  const startCountdown = useCallback((endTime: number) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    seckillEndTimeRef.current = endTime;
    const tick = () => {
      const remaining = seckillEndTimeRef.current - Date.now();
      if (remaining <= 0) {
        setSeckillCountdown({ days: 0, hours: '00', minutes: '00', seconds: '00' });
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        return;
      }
      setSeckillCountdown(formatCountdown(remaining));
    };
    tick();
    countdownTimerRef.current = setInterval(tick, 1000);
  }, []);

  // --- data loading ---
  const loadGoodsList = useCallback(async (page: number, isLoadMore = false) => {
    setGoodsListLoadStatus(1);
    try {
      const list = await fetchGoodsList(page, PAGE_SIZE);
      if (!isLoadMore) {
        setGoodsList(list);
      } else {
        setGoodsList((prev) => [...prev, ...list]);
      }
      if (!list || list.length < PAGE_SIZE) {
        setGoodsListLoadStatus(2);
      } else {
        setGoodsListLoadStatus(0);
        pageIndexRef.current = page + 1;
      }
    } catch {
      setGoodsListLoadStatus(3);
    }
  }, []);

  const loadHomePage = useCallback(async () => {
    setPageLoading(true);
    try {
      const [homeData, hotData, groupRes] = await Promise.all([
        fetchHome(),
        fetchHotGoods(6),
        fetchGroupBuyList(8).catch(() => []),
      ]);

      // swiper banners
      if (homeData.swiper && homeData.swiper.length > 0) {
        setImgSrcs(homeData.swiper.map((item: any) => (typeof item === 'string' ? item : item.imgUrl || item.image || '')));
      }

      // seckill
      const seckillItems = Array.isArray(homeData.seckillList)
        ? homeData.seckillList
        : (Array.isArray(homeData.seckillList?.list) ? homeData.seckillList.list : []);
      if (seckillItems.length > 0) {
        setSeckillList(seckillItems);
        if (homeData.seckillTitle) setSeckillTitle(homeData.seckillTitle);
        setSeckillActivityId(String(homeData.seckillActivityId || seckillItems[0]?.activityId || seckillItems[0]?.promotionId || ''));
        setSeckillSessionId(String(homeData.seckillSessionId || seckillItems[0]?.sessionId || seckillItems[0]?.timeSlotId || ''));
        const end = resolveEndTime(
          homeData.seckillEndTime ?? homeData.seckillRemainTime ?? homeData.seckillRemainingTime,
        );
        if (end > 0) {
          startCountdown(end);
        } else {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setSeckillCountdown(null);
        }
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setSeckillList([]);
        setSeckillCountdown(null);
        setSeckillActivityId('');
        setSeckillSessionId('');
      }

      const groupCandidates = [
        homeData.groupBuyList,
        homeData.groupbuyList,
        homeData.groupList,
        homeData.groupGoodsList,
        homeData.groupBuyingList,
        homeData.activityGroupBuyList,
        homeData.activityList,
        homeData.activities,
        homeData.modules?.groupBuyList,
        homeData.modules?.groupList,
      ];
      let homeGroupItems: any[] = [];
      groupCandidates.some((candidate) => {
        const arr = pickArray(candidate);
        if (arr.length > 0) {
          homeGroupItems = arr;
          return true;
        }
        return false;
      });
      if (homeGroupItems === homeData.activityList || homeGroupItems === homeData.activities) {
        homeGroupItems = homeGroupItems.filter((item: any) => {
          const type = String(item.activityType || item.type || '').toLowerCase();
          const tag = String(item.tag || item.title || '').toLowerCase();
          return type.includes('group') || type.includes('group_buy') || tag.includes('拼团');
        });
      }
      const groupApiItems = pickArray(groupRes);
      const normalizedHomeGroups = normalizeGroupItems(homeGroupItems);
      const normalizedApiGroups = normalizeGroupItems(groupApiItems);
      setGroupBuyList(normalizedHomeGroups.length > 0 ? normalizedHomeGroups : normalizedApiGroups);

      // hot goods
      if (hotData && hotData.length > 0) {
        setHotGoodsList(hotData);
      }

      // goods list
      pageIndexRef.current = 1;
      await loadGoodsList(1);
    } catch (err) {
      console.error('loadHomePage error', err);
    } finally {
      setPageLoading(false);
    }
  }, [loadGoodsList, startCountdown]);

  // --- lifecycle ---
  useEffect(() => {
    ensureMiniProgramLogin().then(() => {
      loadHomePage();
    }).catch((err) => {
      console.warn('login failed, loading page anyway', err);
      loadHomePage();
    });
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [loadHomePage]);

  usePullDownRefresh(() => {
    loadHomePage().finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  useReachBottom(() => {
    if (goodsListLoadStatus === 0) {
      loadGoodsList(pageIndexRef.current, true);
    }
  });

  // --- navigation ---
  const handleSearchClick = useCallback(() => {
    Taro.navigateTo({ url: '/pages/goods/search/index' });
  }, []);

  const getSeckillPromotionUrl = useCallback(() => {
    const query = [
      seckillActivityId ? `activityId=${seckillActivityId}` : '',
      seckillSessionId ? `sessionId=${seckillSessionId}` : '',
    ].filter(Boolean).join('&');
    return `/pages/promotion/detail/index${query ? `?${query}` : ''}`;
  }, [seckillActivityId, seckillSessionId]);

  const handleQuickEntryTap = useCallback((key: string) => {
    switch (key) {
      case 'seckill':
        Taro.navigateTo({ url: getSeckillPromotionUrl() });
        break;
      case 'new':
        Taro.navigateTo({ url: '/pages/goods/list/index?type=new' });
        break;
      case 'groupbuy':
        Taro.navigateTo({ url: '/pages/promotion/group-buy/index' });
        break;
      case 'coupon':
        Taro.navigateTo({ url: '/pages/coupon/coupon-center/index' });
        break;
      case 'hot':
        Taro.navigateTo({ url: '/pages/goods/list/index?type=hot' });
        break;
      case 'category':
        Taro.switchTab({ url: '/pages/category/index' });
        break;
      default:
        break;
    }
  }, [getSeckillPromotionUrl]);

  const handleGoodsClick = useCallback((goods: any) => {
    const id = goods.spuId || goods.id || '';
    Taro.navigateTo({ url: `/pages/goods/details/index?spuId=${id}` });
  }, []);

  const handleHotItemTap = useCallback((item: any) => {
    const id = item.spuId || item.id || '';
    Taro.navigateTo({ url: `/pages/goods/details/index?spuId=${id}` });
  }, []);

  const handleRetryLoadMore = useCallback(() => {
    loadGoodsList(pageIndexRef.current, true);
  }, [loadGoodsList]);

  const showPromoHub = seckillList.length > 0 || groupBuyList.length > 0;

  // --- render ---
  if (pageLoading && goodsList.length === 0 && imgSrcs.length === 0) {
    return (
      <View className="home home--loading">
        <Text className="home__loading-text">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="home">
      {/* Top gradient area */}
      <View className="home-top-bg">
        {/* Search bar */}
        <View className="home-search" onClick={handleSearchClick}>
          <Text className="home-search__icon">🔍</Text>
          <Text className="home-search__placeholder">搜索你需要的商品</Text>
        </View>

        {/* Banner swiper */}
        {imgSrcs.length > 0 && (
          <View className="home-swiper">
            <Swiper
              className="home-swiper__inner"
              circular
              autoplay
              indicatorDots
              interval={3000}
              duration={400}
            >
              {imgSrcs.map((src, idx) => (
                <SwiperItem key={idx}>
                  <Image
                    className="home-swiper__img"
                    src={src}
                    mode="aspectFill"
                  />
                </SwiperItem>
              ))}
            </Swiper>
          </View>
        )}
        {imgSrcs.length === 0 && (
          <View className="home-banner-fallback">
            <View className="home-banner-fallback__title">春日上新</View>
            <View className="home-banner-fallback__desc">精选好物 温暖每一天</View>
            <View className="home-banner-fallback__btn">立即查看</View>
          </View>
        )}

        {/* Quick entry grid */}
        <View className="home-quick-entries">
          {quickEntries.map((entry) => (
            <View
              key={entry.key}
              className="home-quick-entries__item"
              onClick={() => handleQuickEntryTap(entry.key)}
            >
              <View
                className="home-quick-entries__icon-wrap"
                style={{ backgroundColor: entry.bg }}
              >
                <Text className="home-quick-entries__icon">{entry.icon}</Text>
              </View>
              <Text className="home-quick-entries__name">{entry.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {showPromoHub && (
        <View className="home-promo-hub">
          <View className="home-promo-hub__head">
            <View className="home-promo-hub__head-left">
              <View className="home-promo-hub__bar" />
              <Text className="home-promo-hub__title">今日活动</Text>
            </View>
            <Text className="home-promo-hub__head-note">实时刷新</Text>
          </View>
          <View className={`home-promo-hub__ads ${seckillList.length === 0 || groupBuyList.length === 0 ? 'home-promo-hub__ads--single' : ''}`}>
            {seckillList.length > 0 && (
              <View
                className="home-promo-hub__ad-card home-promo-hub__ad-card--seckill"
                onClick={() => Taro.navigateTo({ url: getSeckillPromotionUrl() })}
              >
                <Text className="home-promo-hub__ad-title">{seckillTitle || '秒杀专场'}</Text>
                <Text className="home-promo-hub__ad-sub">点击进入专题页</Text>
                {seckillCountdown && (
                  <View className="home-promo-hub__ad-cd">
                    <Text className="home-promo-hub__ad-cd-label">距下一场</Text>
                    <View className="home-promo-hub__ad-cd-box">
                      <Text className="home-promo-hub__ad-cd-num">{seckillCountdown.days > 0 ? String(seckillCountdown.days).padStart(2, '0') : seckillCountdown.hours}</Text>
                    </View>
                    <Text className="home-promo-hub__ad-cd-sep">:</Text>
                    <View className="home-promo-hub__ad-cd-box">
                      <Text className="home-promo-hub__ad-cd-num">{seckillCountdown.days > 0 ? seckillCountdown.hours : seckillCountdown.minutes}</Text>
                    </View>
                    <Text className="home-promo-hub__ad-cd-sep">:</Text>
                    <View className="home-promo-hub__ad-cd-box">
                      <Text className="home-promo-hub__ad-cd-num">{seckillCountdown.days > 0 ? seckillCountdown.minutes : seckillCountdown.seconds}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
            {groupBuyList.length > 0 && (
              <View className="home-promo-hub__ad-card home-promo-hub__ad-card--group" onClick={() => Taro.navigateTo({ url: '/pages/promotion/group-buy/index' })}>
                <Text className="home-promo-hub__ad-title">拼团会场</Text>
                <Text className="home-promo-hub__ad-sub">精选团购每天上新</Text>
                <View className="home-promo-hub__ad-chip">
                  <Text className="home-promo-hub__ad-chip-text">3人团最低5折起</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <View className="home-mid-banner" onClick={() => Taro.navigateTo({ url: '/pages/coupon/coupon-center/index' })}>
        <View className="home-mid-banner__content">
          <View>
            <Text className="home-mid-banner__title">满199减40</Text>
            <Text className="home-mid-banner__desc">全场跨店可用 · 24小时限时</Text>
          </View>
          <View className="home-mid-banner__btn">
            <Text className="home-mid-banner__btn-text">立即领券</Text>
          </View>
        </View>
      </View>

      {/* Hot goods section */}
      {hotGoodsList.length > 0 && (
        <View className="home-hot">
          <View className="home-hot__header">
            <View className="home-hot__title-bar" />
            <Text className="home-hot__title">热门好物</Text>
          </View>
          <ScrollView scrollX className="home-hot__scroll" enhanced showScrollbar={false}>
            <View className="home-hot__list">
              {hotGoodsList.map((item, idx) => (
                <View
                  key={item.spuId || item.id || idx}
                  className="home-hot__card"
                  onClick={() => handleHotItemTap(item)}
                >
                  <Image
                    className="home-hot__card-img"
                    src={item.thumb || item.primaryImage || ''}
                    mode="aspectFill"
                    lazyLoad
                  />
                  <View className="home-hot__card-info">
                    <Text className="home-hot__card-title" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="home-hot__card-price">
                      ¥{item.price ?? '--'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Recommend section */}
      <View className="home-recommend">
        <View className="home-recommend__header">
          <View className="home-recommend__title-bar" />
          <Text className="home-recommend__title">人气推荐</Text>
        </View>

        <View className="home-recommend__list">
          <GoodsList
            goodsList={goodsList.map((item) => ({
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

        <LoadMore
          status={goodsListLoadStatus}
          listIsEmpty={goodsList.length === 0}
          onRetry={handleRetryLoadMore}
        />
      </View>
    </View>
  );
}
