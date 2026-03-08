import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { Picker, TextArea } from '@nutui/nutui-react-taro';
import { fetchApplyReasonList, dispatchApplyService } from '../../../services/order/applyService';
import './index.scss';

const SERVICE_TYPES = [
  { value: 'refund', text: '仅退款' },
  { value: 'return_refund', text: '退货退款' },
];

export default function ApplyService() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState('');
  const [serviceType, setServiceType] = useState('refund');
  const [reasonList, setReasonList] = useState<string[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const no = router.params.orderNo || '';
    setOrderNo(no);

    fetchApplyReasonList({ orderNo: no })
      .then((res: any) => {
        const list = res?.data || res || [];
        const reasons = Array.isArray(list) ? list.map((r: any) => (typeof r === 'string' ? r : r.reason || r.text || '')) : [];
        setReasonList(reasons);
        if (reasons.length > 0) setSelectedReason(reasons[0]);
      })
      .catch(() => {});
  }, [router.params]);

  const handleSubmit = useCallback(() => {
    if (!selectedReason) {
      Taro.showToast({ title: '请选择售后原因', icon: 'none' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    dispatchApplyService({
      orderNo,
      serviceType,
      reason: selectedReason,
      description,
    })
      .then(() => {
        Taro.showToast({ title: '申请已提交', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 1500);
      })
      .catch((err: any) => {
        Taro.showToast({ title: err?.msg || '提交失败', icon: 'none' });
      })
      .finally(() => setSubmitting(false));
  }, [orderNo, serviceType, selectedReason, description, submitting]);

  return (
    <View className="apply-service">
      <View className="apply-service__card">
        <Text className="apply-service__section-title">售后类型</Text>
        <View className="apply-service__type-row">
          {SERVICE_TYPES.map((type) => (
            <View
              key={type.value}
              className={`apply-service__type-btn ${serviceType === type.value ? 'apply-service__type-btn--active' : ''}`}
              onClick={() => setServiceType(type.value)}
            >
              <Text className="apply-service__type-text">{type.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="apply-service__card">
        <Text className="apply-service__section-title">售后原因</Text>
        <View className="apply-service__reason-picker" onClick={() => setPickerVisible(true)}>
          <Text className={`apply-service__reason-text ${selectedReason ? '' : 'apply-service__reason-text--placeholder'}`}>
            {selectedReason || '请选择原因'}
          </Text>
          <Text className="apply-service__reason-arrow">›</Text>
        </View>
        <Picker
          visible={pickerVisible}
          options={reasonList.map((r) => ({ value: r, text: r }))}
          onConfirm={(_opt, values) => {
            if (values && values.length > 0) setSelectedReason(values[0] as string);
            setPickerVisible(false);
          }}
          onClose={() => setPickerVisible(false)}
        />
      </View>

      <View className="apply-service__card">
        <Text className="apply-service__section-title">问题描述</Text>
        <TextArea
          value={description}
          placeholder="请描述您遇到的问题（选填）"
          maxLength={200}
          onChange={(val) => setDescription(val)}
          className="apply-service__textarea"
        />
      </View>

      <View className="apply-service__footer">
        <View
          className={`apply-service__submit-btn ${submitting ? 'apply-service__submit-btn--disabled' : ''}`}
          onClick={handleSubmit}
        >
          <Text className="apply-service__submit-text">
            {submitting ? '提交中...' : '提交申请'}
          </Text>
        </View>
      </View>
    </View>
  );
}
