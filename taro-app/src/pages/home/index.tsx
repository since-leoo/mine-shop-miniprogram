import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Swiper as NutSwiper, SwiperItem } from '@nutui/nutui-react-taro';
import { SearchBar } from '@nutui/nutui-react-taro';
import { fetchHome } from '../../services/home/home';
import { fetchGoodsList, fetchHotGoods } from '../../services/good/fetchGoods';
import { ensureMiniProgramLogin } from '../../common/auth';
import GoodsList from '../../components/GoodsList';
import LoadMore from '../../components/LoadMore';
import './index.scss';

const quickEntries = [
  { key: 'seckill', name: '限时特惠', icon: '🏷️', bg: '#FFF1E8' },
  { key: 'new', name: '新品上架', icon: '🌿', bg: '#E8F5E9' },
  { key: 'coupon', name: '优惠券', icon: '🎁', bg: '#FFF3E0' },
  { key: 'hot', name: '热卖榜', icon: '🔥', bg: '#FCE4EC' },
  { key: 'category', name: '全部分类', icon: '✨', bg: '#F3E5F5' },
];

const PAGE_SIZE = 20;

interface CountdownState {
  hours: string;
  minutes: string;
  seconds: string;
}

function formatCountdown(ms: number): CountdownState {
  if (ms <= 0) return { hours: '00', minutes: '00', seconds: '00' };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
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
        setSeckillCountdown({ hours: '00', minutes: '00', seconds: '00' });
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
      const [homeData, hotData] = await Promise.all([
        fetchHome(),
        fetchHotGoods(6),
      ]);

      // swiper banners
      if (homeData.swiper && homeData.swiper.length > 0) {
        setImgSrcs(homeData.swiper.map((item: any) => (typeof item === 'string' ? item : item.imgUrl || item.image || '')));
      }

      // seckill
      if (homeData.seckillList && homeData.seckillList.length > 0) {
        setSeckillList(homeData.seckillList);
        if (homeData.seckillTitle) setSeckillTitle(homeData.seckillTitle);
        if (homeData.seckillEndTime) {
          const end = typeof homeData.seckillEndTime === 'number'
            ? homeData.seckillEndTime
            : new Date(homeData.seckillEndTime).getTime();
          startCountdown(end);
        }
      }

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

  const handleQuickEntryTap = useCallback((key: string) => {
    switch (key) {
      case 'seckill':
        Taro.navigateTo({ url: '/pages/promotion/detail/index' });
        break;
      case 'new':
        Taro.navigateTo({ url: '/pages/goods/list/index?type=new' });
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
  }, []);

  const handleGoodsClick = useCallback((goods: any) => {
    const id = goods.spuId || goods.id || '';
    Taro.navigateTo({ url: `/pages/goods/detail/index?id=${id}` });
  }, []);

  const handleSeckillItemTap = useCallback((item: any) => {
    const id = item.spuId || item.id || '';
    Taro.navigateTo({ url: `/pages/goods/detail/index?id=${id}` });
  }, []);

  const handleHotItemTap = useCallback((item: any) => {
    const id = item.spuId || item.id || '';
    Taro.navigateTo({ url: `/pages/goods/detail/index?id=${id}` });
  }, []);

  const handleRetryLoadMore = useCallback(() => {
    loadGoodsList(pageIndexRef.current, true);
  }, [loadGoodsList]);

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
          <SearchBar
            placeholder="搜索商品"
            disabled
            className="home-search__bar"
          />
        </View>

        {/* Banner swiper */}
        {imgSrcs.length > 0 && (
          <View className="home-swiper">
            <NutSwiper
              autoPlay
              loop
              indicator
              className="home-swiper__nut"
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
            </NutSwiper>
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

      {/* Seckill section */}
      {seckillList.length > 0 && (
        <View className="home-seckill">
          <View className="home-seckill__header">
            <View className="home-seckill__title-row">
              <View className="home-seckill__title-left">
                <View className="home-seckill__title-bar" />
                <Text className="home-seckill__title">{seckillTitle}</Text>
              </View>
              {seckillCountdown && (
                <View className="home-seckill__countdown">
                  <Text className="home-seckill__countdown-block">{seckillCountdown.hours}</Text>
                  <Text className="home-seckill__countdown-sep">:</Text>
                  <Text className="home-seckill__countdown-block">{seckillCountdown.minutes}</Text>
                  <Text className="home-seckill__countdown-sep">:</Text>
                  <Text className="home-seckill__countdown-block">{seckillCountdown.seconds}</Text>
                </View>
              )}
            </View>
          </View>
          <ScrollView scrollX className="home-seckill__scroll" enhanced showScrollbar={false}>
            <View className="home-seckill__list">
              {seckillList.map((item, idx) => (
                <View
                  key={item.spuId || item.id || idx}
                  className="home-seckill__card"
                  onClick={() => handleSeckillItemTap(item)}
                >
                  <Image
                    className="home-seckill__card-img"
                    src={item.thumb || item.primaryImage || ''}
                    mode="aspectFill"
                    lazyLoad
                  />
                  <Text className="home-seckill__card-title" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View className="home-seckill__card-price-row">
                    <Text className="home-seckill__card-price">
                      ¥{item.seckillPrice ?? item.price ?? '--'}
                    </Text>
                    {item.originPrice != null && (
                      <Text className="home-seckill__card-origin-price">
                        ¥{item.originPrice}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

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
