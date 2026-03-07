import Taro from '@tarojs/taro';
import { config } from '../config/index';
import { miniProgramLogin } from '../services/auth/login';

const TOKEN_STORAGE_KEY = config.tokenStorageKey || 'accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';
const MEMBER_PROFILE_KEY = 'memberProfile';

let sharedLoginPromise: Promise<any> | null = null;

const persistAuthResponse = (response: any = {}) => {
  const { token, refreshToken, member } = response || {};
  if (token) {
    Taro.setStorageSync(TOKEN_STORAGE_KEY, token);
  }
  if (refreshToken) {
    Taro.setStorageSync(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
  if (member) {
    Taro.setStorageSync(MEMBER_PROFILE_KEY, member);
  }
};

const runLoginRequest = ({ encryptedData = '', iv = '', openid = '' } = {}): Promise<any> => {
  return new Promise((resolve, reject) => {
    Taro.login({
      timeout: 10000,
      success(loginRes) {
        const { code } = loginRes || {};
        if (!code) {
          reject(new Error('未获取到登录凭证 code'));
          return;
        }
        miniProgramLogin({ code, encryptedData, iv, openid })
          .then((response) => {
            persistAuthResponse(response);
            resolve(response);
          })
          .catch(reject);
      },
      fail(error) {
        reject(error);
      },
    });
  });
};

export const getStoredToken = (): string => Taro.getStorageSync(TOKEN_STORAGE_KEY) || '';

export const clearAuthStorage = () => {
  Taro.removeStorageSync(TOKEN_STORAGE_KEY);
  Taro.removeStorageSync(REFRESH_TOKEN_STORAGE_KEY);
  Taro.removeStorageSync(MEMBER_PROFILE_KEY);
};

export const getStoredMemberProfile = () => Taro.getStorageSync(MEMBER_PROFILE_KEY) || null;

export const ensureMiniProgramLogin = (options: any = {}): Promise<any> => {
  const { force = false, encryptedData = '', iv = '', openid = '' } = options || {};
  if (!force) {
    const cachedToken = getStoredToken();
    if (cachedToken) {
      return Promise.resolve({ token: cachedToken });
    }
    if (!sharedLoginPromise) {
      sharedLoginPromise = runLoginRequest({ encryptedData, iv, openid }).finally(() => {
        sharedLoginPromise = null;
      });
    }
    return sharedLoginPromise;
  }
  return runLoginRequest({ encryptedData, iv, openid });
};
