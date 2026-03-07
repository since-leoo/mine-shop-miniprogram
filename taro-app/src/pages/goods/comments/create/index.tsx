import { View, Text, Image, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Rate, Checkbox } from '@nutui/nutui-react-taro';
import './index.scss';

export default function CreateCommentPage() {
  const [goodRateValue, setGoodRateValue] = useState(5);
  const [conveyRateValue, setConveyRateValue] = useState(5);
  const [serviceRateValue, setServiceRateValue] = useState(5);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [imgUrl, setImgUrl] = useState('');
  const [title, setTitle] = useState('');
  const [goodsDetail, setGoodsDetail] = useState('');

  const orderIdRef = useRef<number | null>(null);
  const orderItemIdRef = useRef<number | null>(null);

  useEffect(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params || {};
    orderIdRef.current = params.orderId ? Number(params.orderId) : null;
    orderItemIdRef.current = params.orderItemId ? Number(params.orderItemId) : null;
    setImgUrl(params.productImage || params.imgUrl || '');
    setTitle(params.productName || params.title || '');
    setGoodsDetail(params.skuName || params.specs || '');
  }, []);

  const handleChooseImage = useCallback(() => {
    const remaining = 9 - uploadFiles.length;
    if (remaining <= 0) {
      Taro.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }
    Taro.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setUploadFiles((prev) => [...prev, ...res.tempFilePaths]);
      },
    });
  }, [uploadFiles.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isAllowedSubmit = goodRateValue > 0 && commentText.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!isAllowedSubmit || submitting) return;

    setSubmitting(true);
    try {
      // Import request dynamically to match the original pattern
      const { request } = require('../../../../services/request');
      await request({
        url: '/api/v1/review',
        method: 'POST',
        data: {
          rating: goodRateValue,
          content: commentText,
          images: uploadFiles,
          isAnonymous,
          orderId: orderIdRef.current,
          orderItemId: orderItemIdRef.current,
        },
        needAuth: true,
      });
      Taro.showToast({ title: '评价提交成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (err: any) {
      Taro.showToast({ title: err.msg || '评价提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [isAllowedSubmit, submitting, goodRateValue, commentText, uploadFiles, isAnonymous]);

  return (
    <View className="create-comment-page">
      {/* Goods Info */}
      <View className="comment-form-card">
        <View className="goods-info-row">
          {imgUrl && (
            <Image className="goods-info-row__img" src={imgUrl} mode="aspectFill" />
          )}
          <View className="goods-info-row__text">
            <Text className="goods-info-row__title">{title}</Text>
            {goodsDetail && (
              <Text className="goods-info-row__detail">{goodsDetail}</Text>
            )}
          </View>
        </View>

        {/* Rating */}
        <View className="rate-row">
          <Text className="rate-row__label">商品评价</Text>
          <Rate
            value={goodRateValue}
            onChange={(val) => setGoodRateValue(val)}
            count={5}
          />
        </View>

        {/* Text Area */}
        <View className="textarea-wrap">
          <Textarea
            className="textarea-input"
            placeholder="对商品满意吗？评论一下"
            maxlength={500}
            value={commentText}
            onInput={(e) => setCommentText(e.detail.value)}
          />
          <Text className="textarea-counter">{commentText.length}/500</Text>
        </View>

        {/* Image Upload */}
        <View className="upload-area">
          <View className="upload-area__grid">
            {uploadFiles.map((file, idx) => (
              <View key={idx} className="upload-area__item">
                <Image className="upload-area__img" src={file} mode="aspectFill" />
                <View
                  className="upload-area__remove"
                  onClick={() => handleRemoveImage(idx)}
                >
                  <Text className="upload-area__remove-icon">{'\u00D7'}</Text>
                </View>
              </View>
            ))}
            {uploadFiles.length < 9 && (
              <View className="upload-area__add" onClick={handleChooseImage}>
                <Text className="upload-area__add-icon">+</Text>
                <Text className="upload-area__add-text">添加图片</Text>
              </View>
            )}
          </View>
        </View>

        {/* Anonymous */}
        <View className="anonymous-row">
          <Checkbox
            checked={isAnonymous}
            onChange={(val) => setIsAnonymous(val)}
          />
          <Text className="anonymous-row__text">匿名评价</Text>
        </View>
      </View>

      {/* Service Ratings */}
      <View className="comment-form-card comment-form-card--service">
        <Text className="service-title">物流服务评价</Text>
        <View className="rate-row">
          <Text className="rate-row__label">物流评价</Text>
          <Rate
            value={conveyRateValue}
            onChange={(val) => setConveyRateValue(val)}
            count={5}
          />
        </View>
        <View className="rate-row">
          <Text className="rate-row__label">服务评价</Text>
          <Rate
            value={serviceRateValue}
            onChange={(val) => setServiceRateValue(val)}
            count={5}
          />
        </View>
      </View>

      {/* Submit placeholder */}
      <View className="submit-placeholder" />

      {/* Submit Button */}
      <View className="submit-bar">
        <View
          className={`submit-btn ${isAllowedSubmit ? '' : 'submit-btn--disabled'}`}
          onClick={handleSubmit}
        >
          <Text className="submit-btn__text">
            {submitting ? '提交中...' : '提交'}
          </Text>
        </View>
      </View>
    </View>
  );
}
