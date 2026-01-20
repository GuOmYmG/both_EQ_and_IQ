/**
 * API 配置服务
 * 用于在运行时动态配置和管理 API 地址
 * 特别适用于移动设备，可以动态切换本地/云端 API
 */

/**
 * API 配置类
 */
export class APIConfig {
  private static apiUrl: string = '';
  private static readonly STORAGE_KEY = 'fay_api_url';

  /**
   * 初始化 API 地址
   * 优先级：运行时配置 > 本地存储 > 环境变量 > 默认值
   */
  static init(baseUrl?: string): void {
    if (baseUrl) {
      this.apiUrl = baseUrl;
      this.saveToStorage(baseUrl);
      return;
    }

    // 尝试从本地存储读取（运行时配置）
    const stored = this.loadFromStorage();
    if (stored) {
      this.apiUrl = stored;
      return;
    }

    // 从环境变量获取（构建时配置）
    this.apiUrl = import.meta.env.VITE_FAY_API_URL || '';

    // 如果仍然为空，使用默认值
    if (!this.apiUrl) {
      if (this.isMobileDevice()) {
        // 移动设备（移动浏览器或原生应用）：尝试从本地存储读取，否则使用默认值
        // 注意：在移动设备上 127.0.0.1 可能无法工作，需要用户配置局域网 IP
        // 但为了兼容性，至少提供一个默认值
        const stored = this.loadFromStorage();
        this.apiUrl = stored || 'http://127.0.0.1:5000';
      } else {
        // 桌面/浏览器：使用 localhost（确保网页端正常工作）
        this.apiUrl = 'http://127.0.0.1:5000';
      }
    }
  }

  /**
   * 获取当前 API 地址
   */
  static getApiUrl(): string {
    if (!this.apiUrl) {
      this.init();
    }
    return this.apiUrl;
  }

  /**
   * 设置 API 地址（运行时配置）
   * @param url API 地址，如 'http://192.168.1.100:5000'
   */
  static setApiUrl(url: string): void {
    // 验证 URL 格式
    try {
      new URL(url);
      this.apiUrl = url;
      this.saveToStorage(url);
    } catch (error) {
      console.error('Invalid API URL:', url, error);
      throw new Error(`无效的 API 地址: ${url}`);
    }
  }

  /**
   * 测试 API 连接
   * @param url 可选，要测试的 URL。如果不提供，使用当前配置的 URL
   * @param timeout 超时时间（毫秒），默认 3 秒
   * @returns Promise<boolean> 连接是否成功
   */
  static async testConnection(url?: string, timeout: number = 3000): Promise<boolean> {
    const testUrl = url || this.getApiUrl();
    if (!testUrl) {
      return false;
    }

    try {
      // 尝试访问健康检查端点（如果后端提供）
      const healthUrl = `${testUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      }).catch(() => null);

      clearTimeout(timeoutId);

      // 如果没有健康检查端点，尝试访问根路径
      if (!response || !response.ok) {
        const rootResponse = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(timeout),
          headers: {
            'Accept': 'application/json'
          }
        }).catch(() => null);

        return rootResponse !== null;
      }

      return response.ok;
    } catch (error) {
      console.warn('API 连接测试失败:', testUrl, error);
      return false;
    }
  }

  /**
   * 检测是否在移动设备上
   */
  private static isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * 获取移动设备默认 API 地址
   * 注意：此方法已不再使用，逻辑已合并到 init() 中
   * 保留此方法以保持向后兼容
   * @deprecated 使用 init() 方法中的逻辑
   */
  private static getDefaultMobileUrl(): string {
    const stored = this.loadFromStorage();
    return stored || 'http://127.0.0.1:5000';
  }

  /**
   * 从本地存储加载 API 地址
   */
  private static loadFromStorage(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * 保存 API 地址到本地存储
   */
  private static saveToStorage(url: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, url);
    } catch (error) {
      console.warn('保存 API 地址到本地存储失败:', error);
    }
  }

  /**
   * 清除保存的 API 地址配置
   */
  static clearStoredUrl(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {
        // 忽略错误
      }
    }
    this.apiUrl = '';
  }

  /**
   * 获取所有配置信息（用于调试）
   */
  static getConfigInfo(): {
    currentUrl: string;
    fromStorage: boolean;
    fromEnv: boolean;
    isMobile: boolean;
    storedUrl: string | null;
  } {
    const stored = this.loadFromStorage();
    const envUrl = import.meta.env.VITE_FAY_API_URL;

    return {
      currentUrl: this.getApiUrl(),
      fromStorage: stored === this.apiUrl,
      fromEnv: envUrl === this.apiUrl,
      isMobile: this.isMobileDevice(),
      storedUrl: stored
    };
  }
}

/**
 * 获取 API 基础地址的辅助函数
 * 用于在服务中使用
 */
export function getFayApiUrl(): string {
  return APIConfig.getApiUrl();
}

/**
 * 自动检测并设置 API 地址（实验性功能）
 * 尝试扫描常见的局域网地址
 */
export async function autoDetectApiUrl(): Promise<string | null> {
  const commonPorts = [5000, 8000, 3000];
  const commonIps = ['192.168.1.1', '192.168.0.1', '10.0.2.2']; // Android 模拟器

  // 获取当前设备的 IP 地址段（需要更多实现）
  // 这里只是示例，实际实现需要更复杂的逻辑

  for (const ip of commonIps) {
    for (const port of commonPorts) {
      const url = `http://${ip}:${port}`;
      const isConnected = await APIConfig.testConnection(url, 1000);
      if (isConnected) {
        APIConfig.setApiUrl(url);
        return url;
      }
    }
  }

  return null;
}
