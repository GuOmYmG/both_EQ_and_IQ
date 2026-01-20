/**
 * Hunyuan3D-2 模型生成服务
 * 通过Fay后端代理调用Hunyuan3D-2 API，支持图生3D和文字生3D两种模式
 */

import { getFayApiUrl } from './apiConfig';

// Fay API 地址，使用动态配置（支持运行时修改）
const getFAY_API_URL = (): string => {
  return getFayApiUrl();
};

/**
 * 生成选项接口
 */
export interface GenerateOptions {
  /** 随机种子 */
  seed?: number;
  /** 八叉树分辨率（64/128/256） */
  octree_resolution?: number;
  /** 推理步数（3-10） */
  num_inference_steps?: number;
  /** 引导比例（3.0-7.0） */
  guidance_scale?: number;
  /** 是否生成纹理 */
  texture?: boolean;
  /** 输出格式 */
  type?: 'glb' | 'obj';
  /** 文字生图的随机种子（仅文字生3D） */
  text_seed?: number;
  /** 面数限制（仅在texture=true时生效） */
  face_count?: number;
}

/**
 * 生成结果接口
 */
export interface GenerateResult {
  /** 是否成功 */
  success: boolean;
  /** 模型URL（Blob URL用于前端预览） */
  modelUrl?: string;
  /** 服务器URL（用于保存到数据库） */
  serverUrl?: string;
  /** Base64编码的模型文件（用于前端直接使用） */
  blobBase64?: string;
  /** 文件名 */
  filename?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 将文件转换为base64字符串
 * @param file 文件对象
 * @returns Promise<string> base64编码的字符串
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // 移除 data:image/png;base64, 前缀
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * 从Base64创建Blob URL
 * @param base64 Base64编码的字符串
 * @param mimeType MIME类型
 * @returns Blob URL
 */
function base64ToBlobUrl(base64: string, mimeType: string = 'model/gltf-binary'): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * 图生3D：根据图片生成3D模型
 * @param imageFile 图片文件
 * @param options 生成选项
 * @returns Promise<GenerateResult> 生成结果
 */
export async function generateModelFromImage(
  imageFile: File,
  options?: GenerateOptions
): Promise<GenerateResult> {
  try {
    // 将图片转换为base64
    const imageBase64 = await fileToBase64(imageFile);
    
    // 构建请求参数
    const requestData = {
      image: imageBase64,
      seed: options?.seed ?? 1234,
      octree_resolution: options?.octree_resolution ?? 128,
      num_inference_steps: options?.num_inference_steps ?? 5,
      guidance_scale: options?.guidance_scale ?? 5.0,
      texture: options?.texture ?? false,
      type: options?.type ?? 'glb',
      ...(options?.face_count && { face_count: options.face_count }),
    };
    
    console.log('[Hunyuan3D] 开始图生3D，图片:', imageFile.name);
    
    // 调用Fay后端API
    const FAY_API_URL = getFAY_API_URL();
    const response = await fetch(`${FAY_API_URL}/api/hunyuan3d/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    const result: GenerateResult = await response.json();
    
    if (result.success && result.modelUrl && result.blobBase64) {
      // 创建Blob URL用于前端直接预览
      const blobUrl = base64ToBlobUrl(result.blobBase64);
      console.log('[Hunyuan3D] 图生3D成功:', result.modelUrl);
      
      // 构建服务器URL（后端返回的modelUrl是相对路径，需要拼接API base URL）
      const FAY_API_URL = getFAY_API_URL();
      const serverUrl = result.modelUrl.startsWith('/') 
        ? `${FAY_API_URL}${result.modelUrl}` 
        : result.modelUrl;
      
      return {
        ...result,
        modelUrl: blobUrl, // Blob URL用于前端预览
        serverUrl: serverUrl, // 服务器URL用于保存到数据库
      };
    } else {
      console.error('[Hunyuan3D] 图生3D失败:', result.error);
      return result;
    }
  } catch (error) {
    console.error('[Hunyuan3D] 图生3D异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 文字生3D：根据文字描述生成3D模型
 * @param text 文字描述
 * @param options 生成选项
 * @returns Promise<GenerateResult> 生成结果
 */
export async function generateModelFromText(
  text: string,
  options?: GenerateOptions
): Promise<GenerateResult> {
  try {
    // 为了提高生成结果的可控性，这里对用户输入的文本进行增强：
    // - 强调需要生成的是一个完整的人物形象
    // - 显式要求生成现代风格，而不是古代人物
    // - 明确避免与孔子、LABUBU 等无关形象
    const enhancedText = `${text}。请生成一个完整的、现代风格的三维人物形象，符合真实人类比例和外观。` +
      `避免生成古代人物、历史人物（例如孔子）、卡通IP形象（例如LABUBU）、动物或玩偶，只生成与描述相符的真实人物。`;

    // 构建请求参数
    const requestData = {
      // 使用增强后的提示词，提高符合预期的概率
      text: enhancedText,
      seed: options?.seed ?? 1234,
      text_seed: options?.text_seed ?? options?.seed ?? 1234,
      octree_resolution: options?.octree_resolution ?? 128,
      num_inference_steps: options?.num_inference_steps ?? 5,
      guidance_scale: options?.guidance_scale ?? 5.0,
      texture: options?.texture ?? false,
      type: options?.type ?? 'glb',
      ...(options?.face_count && { face_count: options.face_count }),
    };
    
    console.log('[Hunyuan3D] 开始文字生3D，描述:', text);
    
    // 调用Fay后端API
    const FAY_API_URL = getFAY_API_URL();
    const response = await fetch(`${FAY_API_URL}/api/hunyuan3d/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    const result: GenerateResult = await response.json();
    
    if (result.success && result.modelUrl && result.blobBase64) {
      // 创建Blob URL用于前端直接预览
      const blobUrl = base64ToBlobUrl(result.blobBase64);
      console.log('[Hunyuan3D] 文字生3D成功:', result.modelUrl);
      
      // 构建服务器URL（后端返回的modelUrl是相对路径，需要拼接API base URL）
      const FAY_API_URL = getFAY_API_URL();
      const serverUrl = result.modelUrl.startsWith('/') 
        ? `${FAY_API_URL}${result.modelUrl}` 
        : result.modelUrl;
      
      return {
        ...result,
        modelUrl: blobUrl, // Blob URL用于前端预览
        serverUrl: serverUrl, // 服务器URL用于保存到数据库
      };
    } else {
      console.error('[Hunyuan3D] 文字生3D失败:', result.error);
      return result;
    }
  } catch (error) {
    console.error('[Hunyuan3D] 文字生3D异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

