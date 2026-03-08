import { request } from '../request';

/**
 * 获取商品评论列表
 * GET /api/v1/review/product/{productId}
 */
export function fetchComments(params: any) {
  const { pageNum = 1, pageSize = 10, queryParameter = {} } = params || {};
  const { spuId, commentLevel, hasImage } = queryParameter;

  const query: Record<string, any> = { page: pageNum, page_size: pageSize };

  // 评分等级映射：1=差评, 2=中评, 3=好评
  if (commentLevel === 1) {
    query.rating_level = 'bad';
  } else if (commentLevel === 2) {
    query.rating_level = 'medium';
  } else if (commentLevel === 3) {
    query.rating_level = 'good';
  }

  if (hasImage) {
    query.has_images = 1;
  }

  return request({
    url: `/api/v1/review/product/${spuId}`,
    method: 'GET',
    data: query,
  }).then((data: any) => {
    const { total = 0, list = [], page = 1, pageSize: ps = 10 } = data || {};

    const pageList = list.map((item: any) => ({
      spuId: String(spuId),
      skuId: '0',
      specInfo: '',
      commentContent: item.content || '',
      commentResources: (item.images || []).map((src: string) => ({ src, type: 'image' })),
      commentScore: item.rating || 5,
      uid: String(item.id || ''),
      userName: item.nickname || '匿名用户',
      userHeadUrl: item.avatar || '',
      isAnonymity: item.isAnonymous || false,
      commentTime: item.createdAt
        ? String(new Date(item.createdAt).getTime())
        : String(Date.now()),
      isAutoComment: false,
      sellerReply: item.adminReply || '',
      goodsDetailInfo: '',
    }));

    return {
      pageNum: page,
      pageSize: ps,
      totalCount: String(total),
      pageList,
    };
  });
}
