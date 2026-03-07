import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { Cell, Avatar } from '@nutui/nutui-react-taro';
import { fetchPerson, updateProfile, uploadImage } from '../../../services/usercenter/fetchPerson';
import './index.scss';

interface PersonInfo {
  avatarUrl: string;
  nickName: string;
  phoneNumber: string;
  gender: number; // 0=unknown, 1=male, 2=female
}

const GENDER_MAP: Record<number, string> = {
  0: '未设置',
  1: '男',
  2: '女',
};

export default function PersonInfo() {
  const [info, setInfo] = useState<PersonInfo>({
    avatarUrl: '',
    nickName: '',
    phoneNumber: '',
    gender: 0,
  });

  const loadData = useCallback(() => {
    fetchPerson()
      .then((res: any) => {
        setInfo({
          avatarUrl: res.avatarUrl || '',
          nickName: res.nickName || res.nickname || '',
          phoneNumber: res.phoneNumber || res.phone || '',
          gender: res.gender ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  useDidShow(() => {
    loadData();
  });

  const handleChangeAvatar = useCallback(() => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
    }).then((res) => {
      const tempFilePath = res.tempFilePaths[0];
      if (!tempFilePath) return;

      uploadImage(tempFilePath)
        .then((url: string) => {
          return updateProfile({ avatarUrl: url });
        })
        .then(() => {
          Taro.showToast({ title: '头像已更新', icon: 'success' });
          loadData();
        })
        .catch(() => {
          Taro.showToast({ title: '上传失败', icon: 'none' });
        });
    }).catch(() => {});
  }, [loadData]);

  const handleEditNickname = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/user/name-edit/index?name=${encodeURIComponent(info.nickName)}`,
    });
  }, [info.nickName]);

  const handleChangeGender = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['男', '女'],
    }).then((res) => {
      const gender = res.tapIndex + 1; // 1=male, 2=female
      updateProfile({ gender })
        .then(() => {
          Taro.showToast({ title: '已更新', icon: 'success' });
          loadData();
        })
        .catch(() => {
          Taro.showToast({ title: '更新失败', icon: 'none' });
        });
    }).catch(() => {});
  }, [loadData]);

  return (
    <View className="person-info">
      {/* Avatar section */}
      <View className="person-info__avatar-section" onClick={handleChangeAvatar}>
        <View className="person-info__avatar-row">
          <Text className="person-info__label">头像</Text>
          <View className="person-info__avatar-wrap">
            <Avatar
              size="large"
              src={info.avatarUrl || ''}
              className="person-info__avatar"
            />
            <Text className="person-info__arrow">&rsaquo;</Text>
          </View>
        </View>
      </View>

      {/* Info cells */}
      <View className="person-info__cells">
        <Cell
          title="昵称"
          extra={info.nickName || '未设置'}
          onClick={handleEditNickname}
          className="person-info__cell"
        />
        <Cell
          title="手机号"
          extra={info.phoneNumber || '未绑定'}
          className="person-info__cell"
        />
        <Cell
          title="性别"
          extra={GENDER_MAP[info.gender] || '未设置'}
          onClick={handleChangeGender}
          className="person-info__cell"
        />
      </View>
    </View>
  );
}
