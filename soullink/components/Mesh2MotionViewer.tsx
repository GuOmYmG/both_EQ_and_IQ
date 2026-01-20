import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mesh2MotionEngine } from '@mesh2motion/Mesh2MotionEngine';
import { ProcessStep } from '@mesh2motion/lib/enums/ProcessStep';
import { Companion } from '../types';
import { Mesh2MotionControls } from './Mesh2MotionControls';
import { ModelCleanupUtility } from '@mesh2motion/lib/processes/load-model/ModelCleanupUtility';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * 使用 IndexedDB 静默存储导出的模型文件
 * @param filename 文件名
 * @param arrayBuffer 文件数据
 * @returns Promise<string> 返回 Blob URL
 */
const saveModelToIndexedDB = async (filename: string, arrayBuffer: ArrayBuffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('Mesh2MotionModels', 1);
    
    request.onerror = () => {
      console.error('[Mesh2MotionViewer] IndexedDB 打开失败:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['models'], 'readwrite');
      const store = transaction.objectStore('models');
      
      const modelData = {
        filename: filename,
        data: arrayBuffer,
        timestamp: Date.now()
      };
      
      const putRequest = store.put(modelData, filename);
      
      putRequest.onsuccess = () => {
        console.log('[Mesh2MotionViewer] ✅ 模型已静默保存到 IndexedDB:', filename);
        // 创建 Blob URL 供后续使用
        const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        resolve(url);
      };
      
      putRequest.onerror = () => {
        console.error('[Mesh2MotionViewer] IndexedDB 保存失败:', putRequest.error);
        reject(putRequest.error);
      };
    };
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models');
      }
    };
  });
};

interface Mesh2MotionViewerProps {
  companion: Companion | null;
  onBindingComplete?: (idleModelUrl?: string, talkingModelUrl?: string) => void;
  onStepChange?: (step: ProcessStep) => void;
  // 用于获取导出的模型 URL 的方法（通过 ref 暴露）
  getExportedModelUrls?: (getter: () => { idleModelUrl?: string; talkingModelUrl?: string }) => void;
}

/**
 * Mesh2MotionViewer 组件
 * 将 mesh2motion 引擎包装为 React 组件，用于骨骼绑定功能
 * 
 * @param companion - 当前选中的伴侣模型
 * @param onBindingComplete - 绑定完成时的回调函数
 * @param onStepChange - 步骤变化时的回调函数
 */
export const Mesh2MotionViewer: React.FC<Mesh2MotionViewerProps> = ({ 
  companion, 
  onBindingComplete,
  onStepChange,
  getExportedModelUrls
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Mesh2MotionEngine | null>(null);
  const currentCanvasRef = useRef<HTMLCanvasElement | null>(null); // 保存当前 canvas 引用
  const [currentStep, setCurrentStep] = useState<ProcessStep>(ProcessStep.LoadModel);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 保存导出的模型 URL，供外部组件访问
  const exportedIdleModelUrlRef = useRef<string | undefined>(undefined);
  const exportedTalkingModelUrlRef = useRef<string | undefined>(undefined);

  // 初始化 Mesh2MotionEngine
  const initializeEngine = useCallback(() => {
    if (!rendererContainerRef.current || engineRef.current) return;

    try {
      // 清理所有旧的 canvas 元素（防止多个场景），但保留当前组件的 canvas
      const existingCanvases = document.querySelectorAll('canvas[data-engine="three.js r182"]');
      console.log('Mesh2MotionViewer - Found existing canvases:', existingCanvases.length);
      existingCanvases.forEach(canvas => {
        // 只清理不在当前容器中的 canvas，或者不是当前组件的 canvas
        if (canvas !== currentCanvasRef.current && 
            (!rendererContainerRef.current || !rendererContainerRef.current.contains(canvas))) {
          console.log('Mesh2MotionViewer - Removing old canvas:', canvas);
          canvas.remove();
        }
      });

      // 清理容器中的旧内容（但保留当前 canvas）
      if (rendererContainerRef.current) {
        const children = Array.from(rendererContainerRef.current.children);
        children.forEach(child => {
          if (child !== currentCanvasRef.current) {
            rendererContainerRef.current?.removeChild(child);
          }
        });
      }

      // 拦截 document.body.appendChild 以捕获渲染器的添加
      const originalAppendChild = document.body.appendChild.bind(document.body);
      let rendererElement: HTMLElement | null = null;
      
      document.body.appendChild = function(node: Node) {
        // 如果是渲染器的 DOM 元素，保存引用但不添加到 body
        if (node instanceof HTMLElement && node.tagName === 'CANVAS') {
          console.log('Mesh2MotionViewer - Intercepted canvas append:', node);
          rendererElement = node as HTMLElement;
          return node; // 不添加到 body
        }
        return originalAppendChild(node);
      } as typeof document.body.appendChild;

      // 创建引擎实例（会在构造函数中将渲染器添加到 body，但被我们拦截了）
      const engine = new Mesh2MotionEngine();
      engineRef.current = engine;

      // 恢复原始的 appendChild
      document.body.appendChild = originalAppendChild;

      // 将渲染器移动到我们的容器
      if (rendererContainerRef.current && rendererElement) {
        // 保存当前 canvas 引用
        currentCanvasRef.current = rendererElement as HTMLCanvasElement;
        rendererContainerRef.current.appendChild(rendererElement);
        console.log('Mesh2MotionViewer - Canvas added to container');
        
        // 重新设置渲染器大小以匹配容器
        const rect = rendererContainerRef.current.getBoundingClientRect();
        engine.renderer.setSize(rect.width, rect.height);
        engine.renderer.setPixelRatio(window.devicePixelRatio);
      } else {
        console.error('Mesh2MotionViewer - Failed to capture renderer element');
      }

      // 监听步骤变化
      const checkStepChange = () => {
        if (engineRef.current) {
          const newStep = engineRef.current.process_step;
          if (newStep !== currentStep) {
            // 验证是否可以进入 EditSkeleton 步骤
            if (newStep === ProcessStep.EditSkeleton) {
              try {
                const skeleton = engineRef.current.edit_skeleton_step.skeleton();
                if (!skeleton || !skeleton.bones || skeleton.bones.length === 0) {
                  console.warn('No skeleton available, cannot enter EditSkeleton step');
                  setError('请先加载骨骼模板。在"加载骨骼"步骤中选择骨骼类型并点击"编辑骨骼"按钮。');
                  // 阻止进入 EditSkeleton 步骤，返回到 LoadSkeleton
                  engineRef.current.process_step = engineRef.current.process_step_changed(ProcessStep.LoadSkeleton);
                  return;
                }
              } catch (error) {
                console.error('Error checking skeleton:', error);
                setError('骨骼数据无效。请先完成骨骼加载步骤。');
                engineRef.current.process_step = engineRef.current.process_step_changed(ProcessStep.LoadSkeleton);
                return;
              }
            }
            
            setCurrentStep(newStep);
            onStepChange?.(newStep);
            setError(null); // 清除之前的错误
          }
        }
      };

      // 使用轮询方式监听步骤变化（因为 process_step 不是响应式的）
      const stepCheckInterval = setInterval(checkStepChange, 100);

      // 监听模型加载完成事件
      // 自动执行：切换到 LoadSkeleton -> 移动到地面 -> 加载 Human 骨骼 -> 自动绑定
      engine.load_model_step.addEventListener('modelLoaded', () => {
        console.log('Mesh2MotionViewer - modelLoaded event fired');
        setIsLoading(false);
        setError(null);
        
        // 延迟执行，确保模型数据已准备好
        setTimeout(() => {
          // 1. 自动切换到 LoadSkeleton 步骤
          console.log('Mesh2MotionViewer - Auto-switching to LoadSkeleton step');
          engine.process_step = engine.process_step_changed(ProcessStep.LoadSkeleton);
          
          // 2. 自动移动到地面
          setTimeout(() => {
            console.log('Mesh2MotionViewer - Auto-moving model to floor');
            const meshData = engine.load_model_step.model_meshes();
            if (meshData) {
              ModelCleanupUtility.move_model_to_floor(meshData);
            }
            
            // 3. 自动选择并加载 Human 骨骼
            setTimeout(() => {
              console.log('Mesh2MotionViewer - Auto-loading Human skeleton');
              const skeletonSelection = document.getElementById('skeleton-selection') as HTMLSelectElement;
              if (skeletonSelection) {
                // 设置选择为 Human
                skeletonSelection.value = 'human';
                // 触发 change 事件以确保 UI 更新
                skeletonSelection.dispatchEvent(new Event('change'));
                
                // 显示手部选项面板并设置默认值为 single-bone
                setTimeout(() => {
                  const handOptionsPanel = document.getElementById('hand-skeleton-options');
                  const handSelection = document.getElementById('hand-skeleton-selection') as HTMLSelectElement;
                  
                  if (handOptionsPanel) {
                    // 显示手部选项面板
                    handOptionsPanel.style.display = 'block';
                    console.log('Mesh2MotionViewer - Hand skeleton options panel displayed');
                  }
                  
                  if (handSelection) {
                    // 设置默认值为 single-bone
                    handSelection.value = 'single-bone';
                    // 触发 change 事件以确保引擎更新
                    handSelection.dispatchEvent(new Event('change'));
                    console.log('Mesh2MotionViewer - Hand skeleton selection set to single-bone');
                  }
                }, 50);
                
                // 加载骨骼文件
                setTimeout(() => {
                  // 使用 public 目录中的路径，Vite 会自动从 public/rigs/ 提供文件
                  const skeletonPath = '/rigs/rig-human.glb';
                  engine.load_skeleton_step.set_skeleton_type('rigs/rig-human.glb' as any);
                  engine.load_skeleton_step.load_skeleton_file(skeletonPath);
                }, 100);
              }
            }, 200);
          }, 200);
        }, 100);
        
        checkStepChange();
      });
      
      // 监听模型加载错误
      engine.load_model_step.addEventListener('error', (event: any) => {
        setIsLoading(false);
        const errorMsg = event.detail?.message || '模型加载失败';
        setError(errorMsg);
        console.error('Model loading error:', errorMsg);
      });

      // 监听骨骼加载完成事件 - 自动进入编辑骨骼步骤，让用户手动编辑骨骼点位
      engine.load_skeleton_step.addEventListener('skeletonLoaded', () => {
        console.log('Mesh2MotionViewer - Skeleton loaded successfully, auto-proceeding to EditSkeleton');
        setError(null);
        
        // 设置动画文件路径（使用 public 目录中的路径）
        engine.animations_listing_step.set_animations_file_path('/animations/');
        
        // 自动切换到 EditSkeleton 步骤，让用户手动编辑骨骼点位
        setTimeout(() => {
          engine.process_step = engine.process_step_changed(ProcessStep.EditSkeleton);
          console.log('Mesh2MotionViewer - Switched to EditSkeleton step, user can now edit bone positions');
          console.log('Mesh2MotionViewer - TransformControls enabled:', engine.transform_controls.enabled);
          console.log('Mesh2MotionViewer - TransformControls mode:', engine.transform_controls.getMode());
          console.log('Mesh2MotionViewer - Skeleton bones count:', engine.edit_skeleton_step.skeleton()?.bones?.length || 0);
          console.log('Mesh2MotionViewer - Renderer DOM element:', engine.renderer.domElement);
          
          // 输出 canvas 的位置和大小信息，用于调试鼠标坐标计算
          if (rendererContainerRef.current) {
            const rect = rendererContainerRef.current.getBoundingClientRect();
            console.log('Mesh2MotionViewer - Canvas container rect:', {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height
            });
            console.log('Mesh2MotionViewer - Window size:', {
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight
            });
          }
        }, 300);
        
        checkStepChange();
      });
      
      /**
       * 导出绑骨后的模型（包含指定动画）并下载到本地
       * 基于StepExportToFile的实现，直接将SkinnedMesh添加到Scene中导出
       * @param engine Mesh2Motion引擎实例
       * @param animationClip 要包含的动画片段（可选）
       * @param filename 下载的文件名（不含扩展名）
       * @returns 导出的模型Blob URL（用于后续使用）
       */
      const exportSkinnedModelWithAnimation = async (
        engine: Mesh2MotionEngine,
        animationClip?: THREE.AnimationClip,
        filename?: string
      ): Promise<string> => {
        const exporter = new GLTFExporter();
        const skinnedMeshes = engine.weight_skin_step.final_skinned_meshes();
        
        if (skinnedMeshes.length === 0) {
          throw new Error('没有找到绑骨后的模型');
        }
        
        console.log('[Mesh2MotionViewer] 开始导出绑骨模型，SkinnedMesh数量:', skinnedMeshes.length);
        if (animationClip) {
          console.log('[Mesh2MotionViewer] 包含动画:', animationClip.name);
        }
        
        // 创建导出场景
        const exportScene = new THREE.Scene();
        
        // 保存原始父节点
        const originalParents = new Map<THREE.SkinnedMesh, THREE.Object3D | null>();
        
        // 直接将SkinnedMesh添加到导出场景（不克隆）
        // 注意：SkinnedMesh只能属于一个场景，所以需要临时移动
        skinnedMeshes.forEach((mesh) => {
          originalParents.set(mesh, mesh.parent);
          exportScene.add(mesh);
        });
        
        return new Promise<string>(async (resolve, reject) => {
          const exportOptions: any = {
            binary: true,
            onlyVisible: false,
            embedImages: true
          };
          
          // 如果提供了动画，包含在导出选项中
          if (animationClip) {
            exportOptions.animations = [animationClip];
          }
          
          exporter.parse(
            exportScene,
            async (result) => {
              // 导出完成后，将SkinnedMesh移回原场景
              skinnedMeshes.forEach((mesh) => {
                exportScene.remove(mesh);
                const originalParent = originalParents.get(mesh);
                if (originalParent) {
                  originalParent.add(mesh);
                } else {
                  // 如果没有原始父节点，添加到引擎场景
                  engine.scene.add(mesh);
                }
              });
              
              if (result instanceof ArrayBuffer) {
                const fileSizeKB = (result.byteLength / 1024).toFixed(2);
                console.log('[Mesh2MotionViewer] ✅ 模型导出成功，文件大小:', fileSizeKB, 'KB');
                
                // 将ArrayBuffer转换为File并上传到服务器
                try {
                  const blob = new Blob([result], { type: 'model/gltf-binary' });
                  const finalFilename = filename ? `${filename}.glb` : `model_${Date.now()}.glb`;
                  const file = new File([blob], finalFilename, { type: 'model/gltf-binary' });
                  
                  console.log('[Mesh2MotionViewer] 📤 准备上传文件到服务器:', finalFilename, '大小:', fileSizeKB, 'KB');
                  
                  // 导入modelService
                  const { modelService } = await import('../services/modelService');
                  
                  console.log('[Mesh2MotionViewer] 开始上传动画模型到服务器...');
                  const serverUrl = await modelService.uploadModel(file);
                  console.log('[Mesh2MotionViewer] ✅✅✅ 动画模型已上传到服务器！');
                  console.log('[Mesh2MotionViewer] 📍 服务器URL:', serverUrl);
                  
                  resolve(serverUrl);
                } catch (uploadError) {
                  console.error('[Mesh2MotionViewer] ❌ 上传动画模型失败:', uploadError);
                  console.error('[Mesh2MotionViewer] 错误详情:', uploadError);
                  console.warn('[Mesh2MotionViewer] ⚠️ 回退到Blob URL作为临时方案');
                  // 如果上传失败，回退到Blob URL
                  const blob = new Blob([result], { type: 'model/gltf-binary' });
                  const url = URL.createObjectURL(blob);
                  console.warn('[Mesh2MotionViewer] ⚠️ 使用Blob URL:', url);
                  resolve(url);
                }
              } else {
                console.error('[Mesh2MotionViewer] ❌ 导出失败：结果不是ArrayBuffer');
                reject(new Error('导出失败：结果不是ArrayBuffer'));
              }
            },
            (error) => {
              // 出错时也要恢复SkinnedMesh
              skinnedMeshes.forEach((mesh) => {
                exportScene.remove(mesh);
                const originalParent = originalParents.get(mesh);
                if (originalParent) {
                  originalParent.add(mesh);
                } else {
                  engine.scene.add(mesh);
                }
              });
              console.error('[Mesh2MotionViewer] 导出模型时出错:', error);
              reject(error);
            },
            exportOptions
          );
        });
      };
      
      // 用于标记是否已经触发过导出，避免重复导出（使用 ref 确保在闭包中正确访问）
      const hasExportedRef = { value: false };
      
      // 监听步骤变化，当进入AnimationsListing步骤时，说明绑骨完成
      // 使用轮询方式检查步骤变化和动画加载
      const checkAndExport = async () => {
        if (!engineRef.current) {
          console.log('[Mesh2MotionViewer] 检查导出条件: engineRef 为空，跳过');
          return;
        }
        const engine = engineRef.current;
        
        // 如果已经导出过，不再执行
        if (hasExportedRef.value) {
          console.log('[Mesh2MotionViewer] 检查导出条件: 已导出过，跳过');
          return;
        }
        
        // 检查当前步骤 - 支持 BindPose 和 AnimationsListing 两个步骤
        const currentStep = engine.process_step;
        console.log('[Mesh2MotionViewer] 检查导出条件，当前步骤:', currentStep, '枚举值:', ProcessStep);
        
        // 如果是 BindPose 步骤，先尝试自动进入 AnimationsListing 步骤
        if (currentStep === ProcessStep.BindPose) {
          console.log('[Mesh2MotionViewer] 检测到 BindPose 步骤，尝试自动进入 AnimationsListing...');
          try {
            // 检查是否有绑骨后的模型
            const skinnedMeshes = engine.weight_skin_step?.final_skinned_meshes();
            if (skinnedMeshes && skinnedMeshes.length > 0) {
              console.log('[Mesh2MotionViewer] 绑骨完成，自动切换到 AnimationsListing 步骤');
              engine.process_step = engine.process_step_changed(ProcessStep.AnimationsListing);
              // 继续执行后续检查
            } else {
              console.log('[Mesh2MotionViewer] 绑骨尚未完成，等待...');
              return;
            }
          } catch (error) {
            console.error('[Mesh2MotionViewer] 切换步骤时出错:', error);
            return;
          }
        }
        
        // 检查是否已进入 AnimationsListing 步骤
        const finalStep = engine.process_step;
        if (finalStep !== ProcessStep.AnimationsListing) {
          console.log('[Mesh2MotionViewer] 检查导出条件: 尚未进入 AnimationsListing 步骤，当前步骤:', finalStep);
          return;
        }
        
        // 检查是否有绑骨后的模型
        const skinnedMeshes = engine.weight_skin_step.final_skinned_meshes();
        console.log('[Mesh2MotionViewer] 绑骨后的模型数量:', skinnedMeshes.length);
        if (skinnedMeshes.length === 0) {
          console.log('[Mesh2MotionViewer] 检查导出条件: 尚未有绑骨后的模型，等待...');
          return;
        }
        
        // 等待动画加载完成
        // 如果动画尚未加载，尝试触发加载
        try {
          if (!engine.animations_listing_step || engine.animations_listing_step.animation_clips().length === 0) {
            console.log('[Mesh2MotionViewer] 动画尚未加载，尝试触发加载...');
            // 获取骨架类型和缩放
            const skeletonType = engine.load_skeleton_step?.skeleton_type();
            const skeletonScale = engine.load_skeleton_step?.skeleton_scale();
            if (skeletonType && skeletonScale !== undefined) {
              engine.animations_listing_step.begin(skeletonType, skeletonScale);
              // 加载动画到绑骨后的模型
              engine.animations_listing_step.load_and_apply_default_animation_to_skinned_mesh(skinnedMeshes);
              console.log('[Mesh2MotionViewer] 已触发动画加载');
            }
          }
        } catch (error) {
          console.warn('[Mesh2MotionViewer] 触发动画加载时出错:', error);
        }
        
        const animationClips = engine.animations_listing_step.animation_clips();
        console.log('[Mesh2MotionViewer] 已加载的动画数量:', animationClips.length);
        if (animationClips.length === 0) {
          console.log('[Mesh2MotionViewer] 检查导出条件: 动画尚未加载，等待...');
          return;
        }
        
        // 标记为已导出，避免重复执行
        hasExportedRef.value = true;
        console.log('[Mesh2MotionViewer] ========== 开始自动导出模型 ==========');
        console.log('[Mesh2MotionViewer] 绑骨完成，动画已加载，数量:', animationClips.length);
        console.log('[Mesh2MotionViewer] 可用动画:', animationClips.map(c => c.name));
        console.log('[Mesh2MotionViewer] 正在查找动画: Idle_Torch_Loop 和 Idle_Talking_Loop');
        
        try {
          // 查找Idle_Torch_Loop和Idle_Talking_Loop动画
          let idleClip = animationClips.find(clip => clip.name === 'Idle_Torch_Loop');
          let talkingClip = animationClips.find(clip => clip.name === 'Idle_Talking_Loop');
          
          // 如果在base动画库中找不到，尝试从addon动画库加载
          if (!idleClip || !talkingClip) {
            console.log('[Mesh2MotionViewer] 在当前动画库中未找到完整动画，尝试加载addon动画库...');
            try {
              const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
              const loader = new GLTFLoader();
              
              // 加载addon动画库
              const addonGltf = await new Promise<any>((resolve, reject) => {
                loader.load(
                  '/animations/human-addon-animations.glb',
                  (gltf) => resolve(gltf),
                  undefined,
                  (error) => reject(error)
                );
              });
              
              if (addonGltf.animations && addonGltf.animations.length > 0) {
                console.log('[Mesh2MotionViewer] Addon动画库加载成功，包含', addonGltf.animations.length, '个动画');
                console.log('[Mesh2MotionViewer] Addon动画列表:', addonGltf.animations.map((a: any) => a.name));
                
                // 在addon动画库中查找缺失的动画
                if (!idleClip) {
                  const addonIdleClip = addonGltf.animations.find((clip: any) => clip.name === 'Idle_Torch_Loop');
                  if (addonIdleClip) {
                    console.log('[Mesh2MotionViewer] ✅ 在addon动画库中找到Idle_Torch_Loop动画');
                    // 注意：addon动画需要重新映射到当前模型的骨骼
                    // 但由于动画已经绑定到相同的人类骨骼结构，可以直接使用
                    idleClip = addonIdleClip;
                  }
                }
                
                if (!talkingClip) {
                  const addonTalkingClip = addonGltf.animations.find((clip: any) => clip.name === 'Idle_Talking_Loop');
                  if (addonTalkingClip) {
                    console.log('[Mesh2MotionViewer] ✅ 在addon动画库中找到Idle_Talking_Loop动画');
                    talkingClip = addonTalkingClip;
                  }
                }
              }
            } catch (addonError) {
              console.warn('[Mesh2MotionViewer] 加载addon动画库失败:', addonError);
            }
          }
          
          if (!idleClip) {
            console.warn('[Mesh2MotionViewer] ⚠️ 未找到Idle_Torch_Loop动画（已尝试base和addon动画库）');
          }
          if (!talkingClip) {
            console.warn('[Mesh2MotionViewer] ⚠️ 未找到Idle_Talking_Loop动画（已尝试base和addon动画库）');
          }
          
          let idleModelUrl: string | undefined;
          let talkingModelUrl: string | undefined;
          
          // 导出空闲动画模型并上传到服务器
          if (idleClip) {
            try {
              console.log('[Mesh2MotionViewer] ✅ 找到空闲动画，开始导出并上传...');
              console.log('[Mesh2MotionViewer] 动画名称:', idleClip.name, '时长:', idleClip.duration);
              const filename = `idle_model_${companion?.id || 'default'}_${Date.now()}`;
              idleModelUrl = await exportSkinnedModelWithAnimation(engine, idleClip, filename);
              console.log('[Mesh2MotionViewer] ✅✅✅ 空闲动画模型导出并上传成功！URL:', idleModelUrl);
            } catch (error) {
              console.error('[Mesh2MotionViewer] ❌ 导出空闲动画模型失败:', error);
              console.error('[Mesh2MotionViewer] 错误详情:', error);
            }
          } else {
            console.warn('[Mesh2MotionViewer] ⚠️ 未找到空闲动画，跳过导出');
          }
          
          // 导出说话动画模型并上传到服务器
          if (talkingClip) {
            try {
              console.log('[Mesh2MotionViewer] ✅ 找到说话动画，开始导出并上传...');
              console.log('[Mesh2MotionViewer] 动画名称:', talkingClip.name, '时长:', talkingClip.duration);
              const filename = `talking_model_${companion?.id || 'default'}_${Date.now()}`;
              talkingModelUrl = await exportSkinnedModelWithAnimation(engine, talkingClip, filename);
              console.log('[Mesh2MotionViewer] ✅✅✅ 说话动画模型导出并上传成功！URL:', talkingModelUrl);
            } catch (error) {
              console.error('[Mesh2MotionViewer] ❌ 导出说话动画模型失败:', error);
              console.error('[Mesh2MotionViewer] 错误详情:', error);
            }
          } else {
            console.warn('[Mesh2MotionViewer] ⚠️ 未找到说话动画，跳过导出');
          }
          
          // 保存导出的模型 URL（立即保存到 ref，确保 getExportedModelUrls 能获取到）
          exportedIdleModelUrlRef.current = idleModelUrl;
          exportedTalkingModelUrlRef.current = talkingModelUrl;
          
          console.log('[Mesh2MotionViewer] ✅✅✅ 模型URL已保存到 ref');
          console.log('[Mesh2MotionViewer] exportedIdleModelUrlRef.current:', exportedIdleModelUrlRef.current);
          console.log('[Mesh2MotionViewer] exportedTalkingModelUrlRef.current:', exportedTalkingModelUrlRef.current);
          
          // 传递导出的模型URL给回调（这会自动保存到 companion 数据）
          console.log('[Mesh2MotionViewer] ========== 导出完成，调用 onBindingComplete 回调 ==========');
          console.log('[Mesh2MotionViewer] 📤 准备传递给回调的数据:');
          console.log('[Mesh2MotionViewer]   - idleModelUrl:', idleModelUrl || '(未定义)');
          console.log('[Mesh2MotionViewer]   - talkingModelUrl:', talkingModelUrl || '(未定义)');
          
          if (!idleModelUrl && !talkingModelUrl) {
            console.error('[Mesh2MotionViewer] ❌❌❌ 警告：没有任何动画模型被导出！');
            console.error('[Mesh2MotionViewer] 可能的原因：');
            console.error('[Mesh2MotionViewer]   1. 动画未找到（Idle_Torch_Loop 或 Idle_Talking_Loop）');
            console.error('[Mesh2MotionViewer]   2. 导出过程失败');
            console.error('[Mesh2MotionViewer]   3. 上传过程失败');
          }
          
          onBindingComplete?.(idleModelUrl, talkingModelUrl);
          console.log('[Mesh2MotionViewer] ✅ 回调已调用，动画模型应已自动保存到 companion 数据');
        } catch (error) {
          console.error('[Mesh2MotionViewer] 导出绑骨模型失败:', error);
          // 即使导出失败，也通知绑定完成（使用原始模型）
          onBindingComplete?.();
        }
      };
      
      // 使用定时器定期检查并导出（每500ms检查一次，最多检查120次，即60秒）
      // 注意：不依赖 isInitialized 状态，直接检查 engineRef.current
      let exportCheckCount = 0;
      const maxExportChecks = 120;
      console.log('[Mesh2MotionViewer] 启动自动导出检查定时器');
      const exportCheckInterval = setInterval(() => {
        exportCheckCount++;
        
        // 每次检查都打印状态（前10次或每10次打印一次，避免日志过多）
        if (exportCheckCount <= 10 || exportCheckCount % 10 === 0) {
          const hasEngine = !!engineRef.current;
          const currentStep = engineRef.current?.process_step;
          console.log(`[Mesh2MotionViewer] 导出检查 #${exportCheckCount}: engineRef=${hasEngine}, 当前步骤=${currentStep}`);
        }
        
        // 直接检查 engineRef.current，不依赖 isInitialized 状态
        if (engineRef.current) {
          checkAndExport();
          
          // 如果已经导出或超过最大检查次数，清除定时器
          if (hasExportedRef.value || exportCheckCount >= maxExportChecks) {
            console.log('[Mesh2MotionViewer] 停止导出检查定时器，已导出:', hasExportedRef.value, '检查次数:', exportCheckCount);
            clearInterval(exportCheckInterval);
          }
        } else {
          // 如果条件不满足，也打印原因
          if (exportCheckCount <= 10 || exportCheckCount % 10 === 0) {
            console.log('[Mesh2MotionViewer] 导出检查等待: engineRef 未就绪');
          }
        }
      }, 500);

      // 监听窗口大小变化
      const handleResize = () => {
        if (rendererContainerRef.current && engineRef.current) {
          const rect = rendererContainerRef.current.getBoundingClientRect();
          engineRef.current.renderer.setSize(rect.width, rect.height);
          engineRef.current.camera.aspect = rect.width / rect.height;
          engineRef.current.camera.updateProjectionMatrix();
        }
      };
      window.addEventListener('resize', handleResize);

      setIsInitialized(true);
      
      // 暴露获取导出模型 URL 的方法（实时获取最新值）
      if (getExportedModelUrls) {
        getExportedModelUrls(() => {
          // 每次调用时返回最新的 URL
          const urls = {
            idleModelUrl: exportedIdleModelUrlRef.current,
            talkingModelUrl: exportedTalkingModelUrlRef.current
          };
          console.log('[Mesh2MotionViewer] getExportedModelUrls 被调用，返回:', JSON.stringify(urls, null, 2));
          return urls;
        });
      }

      // 返回清理函数（只在组件卸载时执行）
      return () => {
        console.log('Mesh2MotionViewer - Cleanup function called');
        clearInterval(stepCheckInterval);
        clearInterval(exportCheckInterval);
        window.removeEventListener('resize', handleResize);
        
        // 清理渲染器 DOM 元素
        if (engineRef.current) {
          const domElement = engineRef.current.renderer.domElement;
          console.log('Mesh2MotionViewer - Cleaning up canvas:', domElement);
          
          // 从任何父节点中移除
          if (domElement.parentNode) {
            domElement.parentNode.removeChild(domElement);
          }
          
          // 清理渲染器
          engineRef.current.renderer.dispose();
          
          // 清理引擎引用
          engineRef.current = null;
        }
        
        // 清理当前 canvas 引用
        currentCanvasRef.current = null;
        
        // 清理容器（但只在组件卸载时）
        if (rendererContainerRef.current) {
          rendererContainerRef.current.innerHTML = '';
        }
      };
    } catch (error) {
      console.error('Failed to initialize Mesh2MotionEngine:', error);
    }
  }, [onStepChange, onBindingComplete]); // 移除 currentStep，避免不必要的重新初始化

  useEffect(() => {
    initializeEngine();
    // 清理逻辑已在 initializeEngine 的返回函数中处理
    // 这里不需要额外的清理，避免在重新渲染时误删 canvas
    return () => {
      // 只在组件真正卸载时清理
      console.log('Mesh2MotionViewer - Component unmounting');
    };
  }, [initializeEngine]);

  // 监听模型 URL 变化并加载模型
  useEffect(() => {
    console.log('Mesh2MotionViewer - companion?.model3dUrl:', companion?.model3dUrl);
    console.log('Mesh2MotionViewer - isInitialized:', isInitialized);
    console.log('Mesh2MotionViewer - engineRef.current:', engineRef.current);
    
    if (companion?.model3dUrl && engineRef.current && isInitialized) {
      setIsLoading(true);
      try {
        // 清除之前的模型数据
        engineRef.current.load_model_step.clear_loaded_model_data();
        
        // 清除场景中的旧模型
        const oldModels = engineRef.current.scene.children.filter(
          child => child.name && child.name.includes('Model') || 
          (child.type === 'Scene' && child.children.length > 0)
        );
        oldModels.forEach(model => {
          engineRef.current?.scene.remove(model);
        });
        
        // 确定文件格式
        const url = companion.model3dUrl;
        let fileExtension = 'glb'; // 默认格式
        if (url.endsWith('.fbx')) {
          fileExtension = 'fbx';
        } else if (url.endsWith('.zip')) {
          fileExtension = 'zip';
        } else if (url.endsWith('.glb') || url.endsWith('.gltf')) {
          fileExtension = 'glb';
        } else if (url.startsWith('blob:') || url.startsWith('data:')) {
          // 如果是 blob URL 或 data URL，尝试从 URL 推断格式，或使用 glb 作为默认
          fileExtension = 'glb';
        }
        
        console.log('Mesh2MotionViewer - Loading model:', url, 'Format:', fileExtension);
        
        // 加载模型
        engineRef.current.load_model_step.load_model_file(url, fileExtension);
      } catch (error) {
        console.error('Mesh2MotionViewer - Failed to load model:', error);
        setIsLoading(false);
        setError('加载模型失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    } else if (!companion?.model3dUrl && engineRef.current && isInitialized) {
      console.log('Mesh2MotionViewer - No model URL, clearing scene');
      // 如果没有模型URL，清除场景中的模型
      const oldModels = engineRef.current.scene.children.filter(
        child => child.name && child.name.includes('Model') || 
        (child.type === 'Scene' && child.children.length > 0)
      );
      oldModels.forEach(model => {
        engineRef.current?.scene.remove(model);
      });
    } else {
      console.log('Mesh2MotionViewer - Conditions not met for loading model');
      console.log('  - companion?.model3dUrl:', companion?.model3dUrl);
      console.log('  - engineRef.current:', !!engineRef.current);
      console.log('  - isInitialized:', isInitialized);
    }
  }, [companion?.model3dUrl, isInitialized]);

  // 处理文件上传
  useEffect(() => {
    if (!isInitialized || !engineRef.current) return;

    const uploadInput = document.getElementById('model-upload') as HTMLInputElement;
    const loadButton = document.getElementById('load-model-button');
    const modelSelection = document.getElementById('model-selection') as HTMLSelectElement;

    const handleFileUpload = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && engineRef.current) {
        setIsLoading(true);
        const url = URL.createObjectURL(file);
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'glb';
        
        engineRef.current.load_model_step.clear_loaded_model_data();
        engineRef.current.load_model_step.load_model_file(url, fileExtension);
      }
    };

    const handleLoadButton = () => {
      if (modelSelection && engineRef.current) {
        const modelPath = modelSelection.value;
        setIsLoading(true);
        engineRef.current.load_model_step.clear_loaded_model_data();
        engineRef.current.load_model_step.load_model_file(modelPath, 'glb');
      }
    };

    uploadInput?.addEventListener('change', handleFileUpload);
    loadButton?.addEventListener('click', handleLoadButton);

    return () => {
      uploadInput?.removeEventListener('change', handleFileUpload);
      loadButton?.removeEventListener('click', handleLoadButton);
    };
  }, [isInitialized]);

  // 确保当步骤切换到 LoadSkeleton 时，begin() 方法被调用
  // 这样 Mesh2Motion 自己的事件监听器才会被设置
  useEffect(() => {
    if (!isInitialized || !engineRef.current) return;
    
    // 当步骤切换到 LoadSkeleton 时，确保 begin() 被调用
    if (currentStep === ProcessStep.LoadSkeleton) {
      console.log('Mesh2MotionViewer - Ensuring LoadSkeleton begin() is called');
      // process_step_changed 会自动调用 begin()，但为了确保，我们显式调用
      if (engineRef.current.process_step !== ProcessStep.LoadSkeleton) {
        engineRef.current.process_step = engineRef.current.process_step_changed(ProcessStep.LoadSkeleton);
      } else {
        // 如果已经在 LoadSkeleton 步骤，确保 begin() 被调用（如果还没调用过）
        engineRef.current.load_skeleton_step.begin();
      }
    }
  }, [isInitialized, currentStep]);

  // 当进入 EditSkeleton 步骤时，绑定"绑定姿态"按钮的事件监听器
  useEffect(() => {
    if (!isInitialized || currentStep !== ProcessStep.EditSkeleton) return;
    
    const setupBindPoseButton = () => {
      const bindPoseButton = document.getElementById('action_bind_pose');
      if (bindPoseButton && !(bindPoseButton as any)._eventBound) {
        const handleBindPoseClick = () => {
          console.log('Mesh2MotionViewer - Bind pose button clicked');
          if (engineRef.current) {
            // 切换到 BindPose 步骤，这会触发蒙皮计算
            engineRef.current.process_step = engineRef.current.process_step_changed(ProcessStep.BindPose);
            console.log('Mesh2MotionViewer - Switched to BindPose step');
          }
        };
        bindPoseButton.addEventListener('click', handleBindPoseClick);
        (bindPoseButton as any)._eventBound = true;
        (bindPoseButton as any)._cleanup = () => {
          bindPoseButton.removeEventListener('click', handleBindPoseClick);
          (bindPoseButton as any)._eventBound = false;
        };
        console.log('Mesh2MotionViewer - Bind pose button event listener added');
      }
    };
    
    // 延迟绑定，确保按钮已渲染
    setupBindPoseButton();
    const timeout1 = setTimeout(setupBindPoseButton, 100);
    const timeout2 = setTimeout(setupBindPoseButton, 500);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      const bindPoseButton = document.getElementById('action_bind_pose');
      if (bindPoseButton && (bindPoseButton as any)._cleanup) {
        (bindPoseButton as any)._cleanup();
      }
    };
  }, [isInitialized, currentStep]);

  return (
    <div ref={containerRef} className="w-full h-full relative min-h-[500px]">
      {/* 3D 渲染器容器 */}
      <div ref={rendererContainerRef} className="w-full h-full min-h-[500px]" />
      
      {/* Mesh2Motion 需要的隐藏 DOM 元素（供 UI 类查找） */}
      <div style={{ display: 'none' }}>
        <div id="view-control-hitbox"></div>
        <span id="build-version"></span>
        <a id="attribution-link" href="#"></a>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <div>加载中...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg z-10 backdrop-blur-sm shadow-lg border border-red-400/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="font-semibold mb-1">⚠️ 错误</div>
              <div className="text-sm">{error}</div>
              {error.includes('骨骼') && (
                <div className="text-xs mt-2 text-white/80">
                  💡 提示：请先在"加载骨骼"步骤中选择骨骼类型（Human/Fox/Bird/Dragon），然后点击"编辑骨骼"按钮。
                </div>
              )}
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-white hover:text-gray-200 text-xl leading-none flex-shrink-0"
              title="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
