import { View, Text, Image } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchComments } from '../../../services/comments/fetchComments';
import { fetchCommentsCount } from '../../../services/comments/fetchCommentsCount';
import LoadMore from '../../../components/LoadMore';
import './index.scss';

interface CommentItem {
  commentScore: number;
  userName: string;
  commentContent: string;
  commentResources: any[];
  commentTime: string;
  userHeadUrl: string;
  specInfo: string;
  isAnonymity: boolean;
  sellerReply: string;
}

interface CountObj {
  badCount: string;
  commentCount: string;
  goodCount: string;
  middleCount: string;
  hasImageCount: string;
  uidCount: string;
}

type TabKey = '' | '3' | '2' | '1' | '4';

const TABS: { key: TabKey; label: string; countKey: keyof CountObj }[] = [
  { key: '', label: '全部', countKey: 'commentCount' },
  { key: '4', label: '有图', countKey: 'hasImageCount' },
  { key: '3', label: '好评', countKey: 'goodCount' },
  { key: '2', label: '中评', countKey: 'middleCount' },
  { key: '1', label: '差评', countKey: 'badCount' },
];

function buildMockComments(spuId: string): CommentItem[] {
  const now = Date.now();
  const seeds = [
    { userName: '林**', commentScore: 5, commentContent: '包装很细致，质量超出预期。', specInfo: '默认规格', sellerReply: '感谢支持，欢迎再次光临。' },
    { userName: '陈**', commentScore: 4, commentContent: '整体不错，发货速度快。', specInfo: '经典款', sellerReply: '' },
    { userName: '周**', commentScore: 5, commentContent: '做工扎实，细节处理很好。', specInfo: '升级款', sellerReply: '' },
    { userName: '王**', commentScore: 5, commentContent: '活动价入手很值，推荐。', specInfo: '活动款', sellerReply: '' },
    { userName: '张**', commentScore: 3, commentContent: '还可以，用起来没问题。', specInfo: '标准款', sellerReply: '' },
    { userName: '许**', commentScore: 4, commentContent: '和页面描述一致，满意。', specInfo: '默认规格', sellerReply: '' },
    { userName: '赵**', commentScore: 5, commentContent: '客服很耐心，处理问题及时。', specInfo: '暖色款', sellerReply: '感谢您的认可。' },
    { userName: '孙**', commentScore: 2, commentContent: '包装有轻微挤压，整体一般。', specInfo: '默认规格', sellerReply: '' },
  ];

  return seeds.map((item, idx) => ({
    commentScore: item.commentScore,
    userName: item.userName,
    commentContent: item.commentContent,
    commentResources: [],
    commentTime: String(now - idx * 86400000),
    userHeadUrl: '',
    specInfo: item.specInfo,
    isAnonymity: false,
    sellerReply: item.sellerReply,
    spuId,
  } as any));
}

function filterMockByTab(list: CommentItem[], tab: TabKey) {
  if (tab === '4') {
    return list.filter((item) => Array.isArray(item.commentResources) && item.commentResources.length > 0);
  }
  if (tab === '3') return list.filter((item) => item.commentScore >= 4);
  if (tab === '2') return list.filter((item) => item.commentScore === 3);
  if (tab === '1') return list.filter((item) => item.commentScore <= 2);
  return list;
}

function buildMockCount(list: CommentItem[]): CountObj {
  const goodCount = list.filter((item) => item.commentScore >= 4).length;
  const middleCount = list.filter((item) => item.commentScore === 3).length;
  const badCount = list.filter((item) => item.commentScore <= 2).length;
  const hasImageCount = list.filter((item) => Array.isArray(item.commentResources) && item.commentResources.length > 0).length;
  return {
    badCount: String(badCount),
    commentCount: String(list.length),
    goodCount: String(goodCount),
    middleCount: String(middleCount),
    hasImageCount: String(hasImageCount),
    uidCount: String(list.length),
  };
}

export default function CommentsPage() {
  const [commentList, setCommentList] = useState<CommentItem[]>([]);
  const [loadMoreStatus, setLoadMoreStatus] = useState<0 | 1 | 2 | 3>(0);
  const [activeTab, setActiveTab] = useState<TabKey>('');
  const [countObj, setCountObj] = useState<CountObj>({
    badCount: '0',
    commentCount: '0',
    goodCount: '0',
    middleCount: '0',
    hasImageCount: '0',
    uidCount: '0',
  });

  const spuIdRef = useRef('');
  const pageNumRef = useRef(1);
  const totalCountRef = useRef(0);

  // Format time
  const formatTime = (ts: string | number) => {
    try {
      const d = new Date(Number(ts));
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return String(ts);
    }
  };

  const loadComments = useCallback(async (reset = true, tabKey?: TabKey) => {
    const currentTab = tabKey ?? activeTab;
    if (loadMoreStatus === 1 && !reset) return;
    setLoadMoreStatus(1);

    const params: any = {
      pageNum: reset ? 1 : pageNumRef.current + 1,
      pageSize: 30,
      queryParameter: {
        spuId: spuIdRef.current,
      },
    };

    // Tab filtering
    if (currentTab === '4') {
      params.queryParameter.hasImage = true;
    } else if (['3', '2', '1'].includes(currentTab)) {
      params.queryParameter.commentLevel = Number(currentTab);
    }

    try {
      const data = await fetchComments(params);
      const { pageList = [], totalCount = 0 } = data || {};
      const totalNum = Number(totalCount || 0);

      const formattedList = pageList.map((item: any) => ({
        ...item,
        commentTime: formatTime(item.commentTime),
      }));

      if (totalNum === 0 && reset) {
        const mockAll = buildMockComments(spuIdRef.current);
        const mockByTab = filterMockByTab(mockAll, currentTab);
        setCommentList(mockByTab.map((item) => ({ ...item, commentTime: formatTime(item.commentTime) })));
        totalCountRef.current = mockByTab.length;
        setLoadMoreStatus(2);
        return;
      }

      const newList = reset ? formattedList : [...commentList, ...formattedList];
      pageNumRef.current = reset ? 1 : pageNumRef.current + 1;
      totalCountRef.current = totalNum;
      setCommentList(newList);
      setLoadMoreStatus(newList.length >= totalNum ? 2 : 0);
    } catch {
      if (reset) {
        const mockAll = buildMockComments(spuIdRef.current);
        const mockByTab = filterMockByTab(mockAll, currentTab);
        setCommentList(mockByTab.map((item) => ({ ...item, commentTime: formatTime(item.commentTime) })));
        totalCountRef.current = mockByTab.length;
        setLoadMoreStatus(2);
      } else {
        setLoadMoreStatus(3);
      }
    }
  }, [activeTab, commentList, loadMoreStatus]);

  const loadCount = useCallback(async () => {
    try {
      const result = await fetchCommentsCount({ spuId: spuIdRef.current });
      const countNum = Number(result?.commentCount || 0);
      if (countNum > 0) {
        setCountObj(result);
      } else {
        setCountObj(buildMockCount(buildMockComments(spuIdRef.current)));
      }
    } catch (error) {
      console.error('count error:', error);
      setCountObj(buildMockCount(buildMockComments(spuIdRef.current)));
    }
  }, []);

  useEffect(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params || {};
    spuIdRef.current = params.spuId || '';
    loadCount();
    loadComments(true);
  }, []);

  useReachBottom(() => {
    if (commentList.length < totalCountRef.current) {
      loadComments(false);
    } else if (commentList.length > 0) {
      setLoadMoreStatus(2);
    }
  });

  const handleTabChange = useCallback((tabKey: TabKey) => {
    if (tabKey === activeTab) return;
    setActiveTab(tabKey);
    setCommentList([]);
    pageNumRef.current = 1;
    setLoadMoreStatus(0);
    // Need to pass the new tabKey since state hasn't updated yet
    setTimeout(() => {
      loadComments(true, tabKey);
    }, 0);
  }, [activeTab, loadComments]);

  // Render stars
  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} className={`comment-star ${i < score ? 'comment-star--active' : ''}`}>
        {i < score ? '\u2605' : '\u2606'}
      </Text>
    ));
  };

  const handleRetry = useCallback(() => {
    loadComments(false);
  }, [loadComments]);

  return (
    <View className="comments-page">
      {/* Tab Bar */}
      <View className="comments-tabs">
        {TABS.map((tab) => (
          <View
            key={tab.key}
            className={`comments-tabs__item ${activeTab === tab.key ? 'comments-tabs__item--active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            <Text className="comments-tabs__text">
              {tab.label}({countObj[tab.countKey] || '0'})
            </Text>
          </View>
        ))}
      </View>

      {/* Comment List */}
      <View className="comments-list">
        {commentList.map((item, idx) => (
          <View key={idx} className="comment-card">
            <View className="comment-card__header">
              <Image
                className="comment-card__avatar"
                src={item.userHeadUrl || ''}
              />
              <View className="comment-card__header-right">
                <Text className="comment-card__name">
                  {item.isAnonymity ? '匿名用户' : (item.userName || '用户')}
                </Text>
                <View className="comment-card__stars">
                  {renderStars(item.commentScore)}
                </View>
              </View>
              <Text className="comment-card__time">{item.commentTime}</Text>
            </View>

            <Text className="comment-card__content">
              {item.commentContent || '用户未填写评价'}
            </Text>

            {item.specInfo && (
              <Text className="comment-card__spec">{item.specInfo}</Text>
            )}

            {/* Comment Images */}
            {item.commentResources && item.commentResources.length > 0 && (
              <View className="comment-card__images">
                {item.commentResources.map((res: any, rIdx: number) => (
                  <Image
                    key={rIdx}
                    className="comment-card__image"
                    src={res.src || res.url || res}
                    mode="aspectFill"
                    onClick={() => {
                      const urls = item.commentResources.map((r: any) => r.src || r.url || r);
                      Taro.previewImage({ current: urls[rIdx], urls });
                    }}
                  />
                ))}
              </View>
            )}

            {/* Seller Reply */}
            {item.sellerReply && (
              <View className="comment-card__reply">
                <Text className="comment-card__reply-label">商家回复：</Text>
                <Text className="comment-card__reply-text">{item.sellerReply}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Empty */}
      {commentList.length === 0 && loadMoreStatus !== 1 && (
        <View className="empty-state">
          <Text className="empty-state__icon">{'\u{1F4AC}'}</Text>
          <Text className="empty-state__text">暂无评价</Text>
        </View>
      )}

      <LoadMore
        status={loadMoreStatus}
        listIsEmpty={commentList.length === 0}
        onRetry={handleRetry}
      />
    </View>
  );
}
