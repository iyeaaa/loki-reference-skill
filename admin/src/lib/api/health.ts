import { publicApi } from './public';

export const healthApi = {
  check: async () => {
    try {
      const response = await publicApi.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};