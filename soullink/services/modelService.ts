/**
 * 模型管理服务
 * 与后端模型管理API对接
 */

import { getFayApiUrl } from './apiConfig';
import { Companion, CharacterAttributes } from '../types';

// Fay API 地址
const getFAY_API_URL = (): string => {
  return getFayApiUrl();
};

/**
 * 后端模型数据结构
 */
interface BackendModel {
  model_id: string;
  name: string;
  description?: string;
  attributes?: CharacterAttributes;
  creator_username?: string;
  is_global?: boolean;
  created_at?: number;
  created_at_str?: string;  // 格式化后的创建时间字符串
  updated_at?: number;
  updated_at_str?: string;  // 格式化后的更新时间字符串
  is_active?: boolean;
  model3d_url?: string;
  idle_model_url?: string;
  talking_model_url?: string;
}

/**
 * API响应格式
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 模型管理服务类
 */
class ModelService {
  /**
   * 获取模型列表
   * @param username 用户名，可选
   * @param includeGlobal 是否包含全局模型
   * @returns Promise<BackendModel[]>
   */
  async getModels(username?: string, includeGlobal: boolean = true): Promise<BackendModel[]> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username || 'User',
          include_global: includeGlobal,
        }),
      });

      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status}`);
      }

      const result: ApiResponse<BackendModel[]> = await response.json();
      if (result.code === 200 && result.data) {
        return result.data;
      } else {
        throw new Error(result.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取模型详情
   * @param modelId 模型ID
   * @returns Promise<BackendModel>
   */
  async getModelDetail(modelId: string): Promise<BackendModel> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/detail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: modelId,
        }),
      });

      if (!response.ok) {
        throw new Error(`获取模型详情失败: ${response.status}`);
      }

      const result: ApiResponse<BackendModel> = await response.json();
      if (result.code === 200 && result.data) {
        return result.data;
      } else {
        throw new Error(result.message || '获取模型详情失败');
      }
    } catch (error) {
      console.error('获取模型详情失败:', error);
      throw error;
    }
  }

  /**
   * 上传3D模型文件
   * @param file 模型文件
   * @returns Promise<string> 返回模型URL
   */
  async uploadModel(file: File): Promise<string> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${FAY_API_URL}/api/models/upload-model`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`上传模型失败: ${response.status}`);
      }

      const result: ApiResponse<{ model_url: string; filename: string; size: number }> = await response.json();
      if (result.code === 200 && result.data) {
        // 返回完整的URL，确保能够访问
        return result.data.model_url;
      } else {
        throw new Error(result.message || '上传模型失败');
      }
    } catch (error) {
      console.error('上传模型失败:', error);
      throw error;
    }
  }

  /**
   * 创建模型
   * @param data 模型数据
   * @returns Promise<string> 返回模型ID
   */
  async createModel(data: {
    name: string;
    description?: string;
    character_description?: string;
    attribute_json?: CharacterAttributes;
    username?: string;
    is_global?: number;
    model3d_url?: string;
    idle_model_url?: string;
    talking_model_url?: string;
  }): Promise<string> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`创建模型失败: ${response.status}`);
      }

      const result: ApiResponse<{ model_id: string }> = await response.json();
      if (result.code === 200 && result.data) {
        return result.data.model_id;
      } else {
        throw new Error(result.message || '创建模型失败');
      }
    } catch (error) {
      console.error('创建模型失败:', error);
      throw error;
    }
  }

  /**
   * 更新模型
   * @param modelId 模型ID
   * @param data 更新的数据
   * @returns Promise<boolean>
   */
  async updateModel(
    modelId: string,
    data: {
      name?: string;
      description?: string;
      attribute_json?: CharacterAttributes;
      model3d_url?: string;
      idle_model_url?: string;
      talking_model_url?: string;
    }
  ): Promise<boolean> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: modelId,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error(`更新模型失败: ${response.status}`);
      }

      const result: ApiResponse<any> = await response.json();
      return result.code === 200;
    } catch (error) {
      console.error('更新模型失败:', error);
      throw error;
    }
  }

  /**
   * 删除模型
   * @param modelId 模型ID
   * @returns Promise<boolean>
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: modelId,
        }),
      });

      if (!response.ok) {
        throw new Error(`删除模型失败: ${response.status}`);
      }

      const result: ApiResponse<any> = await response.json();
      return result.code === 200;
    } catch (error) {
      console.error('删除模型失败:', error);
      throw error;
    }
  }

  /**
   * 选择模型
   * @param modelId 模型ID
   * @param username 用户名
   * @returns Promise<boolean>
   */
  async selectModel(modelId: string, username: string = 'User'): Promise<boolean> {
    try {
      const FAY_API_URL = getFAY_API_URL();
      const response = await fetch(`${FAY_API_URL}/api/models/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: modelId,
          username: username,
        }),
      });

      if (!response.ok) {
        throw new Error(`选择模型失败: ${response.status}`);
      }

      const result: ApiResponse<any> = await response.json();
      return result.code === 200;
    } catch (error) {
      console.error('选择模型失败:', error);
      throw error;
    }
  }

  /**
   * 将后端模型转换为前端Companion格式
   * @param model 后端模型
   * @returns Companion
   */
  modelToCompanion(model: BackendModel): Companion {
    // 构建完整的模型URL（如果存在相对路径，需要加上API base URL）
    const FAY_API_URL = getFAY_API_URL();
    
    const buildFullUrl = (url?: string): string => {
      if (!url) return '';
      // 如果已经是完整URL，直接使用；否则拼接base URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      } else if (url.startsWith('/')) {
        // 相对路径，需要拼接base URL
        return `${FAY_API_URL}${url}`;
      } else {
        return `${FAY_API_URL}/models/${url}`;
      }
    };
    
    return {
      id: model.model_id,
      model_id: model.model_id,
      name: model.name,
      role: model.description || '虚拟伙伴',
      personality: model.attributes?.additional || model.description || '',
      avatarUrl: 'https://via.placeholder.com/150',
      isBound: true,
      createdAt: model.created_at || Date.now(),
      createdAtStr: model.created_at_str || (model.created_at ? new Date(model.created_at * 1000).toLocaleString('zh-CN') : ''),
      model3dUrl: buildFullUrl(model.model3d_url),
      idleModelUrl: buildFullUrl(model.idle_model_url),
      talkingModelUrl: buildFullUrl(model.talking_model_url),
      characterAttributes: model.attributes,
      characterDescription: model.description,
      is_global: model.is_global,
    };
  }

  /**
   * 将前端Companion转换为后端模型格式
   * @param companion 前端Companion
   * @returns 后端模型数据
   */
  companionToModelData(companion: Companion): {
    name: string;
    description?: string;
    character_description?: string;
    attribute_json?: CharacterAttributes;
    is_global?: number;
    model3d_url?: string;
    idle_model_url?: string;
    talking_model_url?: string;
  } {
    // 将URL转换为相对路径存储的辅助函数
    const convertToRelativeUrl = (url?: string): string | undefined => {
      if (!url) return undefined;
      const FAY_API_URL = getFAY_API_URL();
      // 如果是完整URL，提取相对路径
      if (url.startsWith(FAY_API_URL)) {
        return url.replace(FAY_API_URL, '');
      } else if (url.startsWith('/models/') || url.startsWith('/')) {
        // 已经是相对路径
        return url;
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // 可能是文件名，添加/models/前缀
        return `/models/${url}`;
      } else {
        // 完整URL但不是我们的API，保持原样（可能是外部URL）
        return url;
      }
    };
    
    return {
      name: companion.name,
      description: companion.role || companion.characterDescription,
      character_description: companion.characterDescription,
      attribute_json: companion.characterAttributes,
      is_global: companion.is_global ? 1 : 0,
      model3d_url: convertToRelativeUrl(companion.model3dUrl),
      idle_model_url: convertToRelativeUrl(companion.idleModelUrl),
      talking_model_url: convertToRelativeUrl(companion.talkingModelUrl),
    };
  }
}

// 导出单例
export const modelService = new ModelService();

