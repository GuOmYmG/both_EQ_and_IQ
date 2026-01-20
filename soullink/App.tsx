import React, { useState, useEffect, useRef } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  Sparkles,
  Heart,
  MessageCircle,
  Settings,
  Mic,
  Send,
  Trash2,
  UserPlus,
  Image as ImageIcon,
  X,
  ChevronUp,
  ChevronDown,
  Box,
  Check,
  Plus,
  Scan,
  Activity,
  Cpu,
  Upload,
  FileBox,
  Star,
  Cloud,
  Moon,
  User,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { chatWithCompanion } from "./services/qwenService";
import {
  generateModelFromImage,
  generateModelFromText,
} from "./services/hunyuan3dService";
import { characterService } from "./services/characterService";
import { modelService } from "./services/modelService";
import { audioService, isCapacitor } from "./services/audioService";
import { Button, Input, Modal, PageContainer } from "./components/ui";
import { Mesh2MotionViewer } from "./components/Mesh2MotionViewer";
import { Mesh2MotionControls } from "./components/Mesh2MotionControls";
import { CharacterDescriptionInput } from "./components/CharacterDescriptionInput";
import { ProcessStep } from "@mesh2motion/lib/enums/ProcessStep";
import { Companion, ChatMessage, CharacterAttributes } from "./types";
import { APIConfig } from "./services/apiConfig";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- Global Context for Companion Data ---
const STORAGE_KEY = "soul_link_data";

// Built-in Default Character
const DEFAULT_COMPANION: Companion = {
  id: "default_lumia",
  name: "Lumia",
  role: "光之向导",
  personality:
    "温柔、充满智慧，如同深夜的星光般宁静。她不仅是倾听者，更是你灵魂的共鸣者。",
  avatarUrl:
    "https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=500&auto=format&fit=crop",
  isBound: false,
  createdAt: Date.now(),
  model3dUrl: "",
};

interface AppData {
  companions: Companion[];
  activeId: string;
}

// --- Background Decorations Component ---
const BackgroundDecorations = () => {
  // 生成多个星星位置
  const stars = [
    { top: "10%", left: "8%", size: 28, delay: "0s", duration: "3s" },
    { top: "20%", left: "85%", size: 22, delay: "0.5s", duration: "3.5s" },
    { top: "35%", left: "15%", size: 26, delay: "1s", duration: "4s" },
    { top: "45%", left: "75%", size: 24, delay: "0.3s", duration: "3.2s" },
    { top: "15%", left: "45%", size: 30, delay: "1.5s", duration: "4.5s" },
    { top: "60%", left: "25%", size: 20, delay: "0.8s", duration: "3.8s" },
    { top: "70%", left: "65%", size: 27, delay: "1.2s", duration: "4.2s" },
    { top: "25%", left: "55%", size: 23, delay: "0.4s", duration: "3.3s" },
    { top: "50%", left: "90%", size: 25, delay: "1.8s", duration: "4.8s" },
    { top: "80%", left: "40%", size: 21, delay: "0.6s", duration: "3.6s" },
    { top: "5%", left: "30%", size: 29, delay: "1.3s", duration: "4.3s" },
    { top: "55%", left: "10%", size: 22, delay: "0.7s", duration: "3.7s" },
    { top: "30%", left: "70%", size: 26, delay: "1.6s", duration: "4.6s" },
    { top: "75%", left: "80%", size: 24, delay: "0.9s", duration: "3.9s" },
    { top: "40%", left: "50%", size: 28, delay: "1.1s", duration: "4.1s" },
    { top: "65%", left: "5%", size: 25, delay: "0.2s", duration: "3.1s" },
    { top: "85%", left: "60%", size: 23, delay: "1.4s", duration: "4.4s" },
    { top: "12%", left: "70%", size: 27, delay: "0.5s", duration: "3.5s" },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Soft Glowing Orbs - 温馨暖色调 */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-pink-300/30 rounded-full blur-[100px] animate-pulse-slow"></div>
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-300/30 rounded-full blur-[100px] animate-pulse-slow"
        style={{ animationDelay: "1.5s" }}
      ></div>
      <div className="absolute top-[40%] left-[30%] w-64 h-64 bg-yellow-200/25 rounded-full blur-[80px] animate-float"></div>

      {/* 闪烁的星星 - 使用emoji */}
      {stars.map((star, index) => (
        <div
          key={`star-${index}`}
          className="absolute twinkle-star"
          style={{
            top: star.top,
            left: star.left,
            fontSize: `${star.size}px`,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        >
          ⭐
        </div>
      ))}

      {/* 额外的✨星星 */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute twinkle-sparkle"
          style={{
            top: `${15 + i * 15}%`,
            left: `${20 + i * 12}%`,
            fontSize: `${18 + i * 2}px`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${3 + i * 0.5}s`,
          }}
        >
          ✨
        </div>
      ))}

      {/* Floating Cute Icons - 温馨色调 */}
      <div
        className="absolute top-[25%] left-[10%] text-pink-300/30 animate-float"
        style={{ animationDuration: "10s", animationDelay: "1s" }}
      >
        <Cloud size={32} fill="currentColor" />
      </div>
      <div
        className="absolute bottom-[20%] left-[20%] text-pink-400/40 animate-pulse"
        style={{ animationDuration: "4s" }}
      >
        <Heart size={20} fill="currentColor" />
      </div>
      <div
        className="absolute bottom-[40%] right-[25%] text-orange-300/30 animate-float"
        style={{ animationDuration: "12s", animationDelay: "2s" }}
      >
        <Moon size={28} fill="currentColor" />
      </div>
    </div>
  );
};

// --- Reusable 3D Avatar Component ---
interface AvatarSceneProps {
  modelUrl?: string;
  isTalking?: boolean;
  isRigging?: boolean; // Effect for binding page
  color?: string;
}

const AvatarScene: React.FC<AvatarSceneProps> = ({
  modelUrl,
  isTalking = false,
  isRigging = false,
  color = "#8b5cf6",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const talkingActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!containerRef.current || !modelUrl) return;

    // 清理之前的渲染器
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    let animateId: number = 0;

    // 参考 HTML 示例：创建场景、相机、渲染器
    const scene = new THREE.Scene();
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1, 2.5); // 相机更近，模型看起来更大
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);

    // 添加光源 - 增强光照使模型更亮更真实
    // 环境光：使用更亮的颜色和更高的强度
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    // 主方向光：增加强度，模拟主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = false;
    scene.add(directionalLight);

    // 补充光源：从另一侧增加光照，减少阴影，增强立体感
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-5, 5, 5);
    scene.add(fillLight);

    // 顶部补光：增强顶部光照，让模型顶部更亮
    const topLight = new THREE.DirectionalLight(0xffffff, 1.2);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    // 前补光：从相机方向补光，减少正面阴影，增强正面亮度
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.3);
    frontLight.position.set(0, 3, 8);
    scene.add(frontLight);

    // 从缓存加载模型（优先使用缓存）
    const loadModel = async () => {
      try {
        const { animationCacheService } = await import(
          "./services/animationCacheService"
        );
        // 尝试从缓存获取，如果不存在则自动下载并缓存
        const cachedUrl = await animationCacheService.getAnimationUrl(modelUrl);
        console.log(
          "[AvatarScene] 📦 使用缓存URL:",
          cachedUrl !== modelUrl ? "是" : "否"
        );

        // 参考 HTML 示例：加载模型
        const loader = new GLTFLoader();
        loader.load(
          cachedUrl,
          (gltf) => {
            console.log("[AvatarScene] 模型加载成功，URL:", modelUrl);
            console.log(
              "[AvatarScene] 动画数量:",
              gltf.animations?.length || 0
            );
            const digitalHuman = gltf.scene;

            // 优化材质，增强亮度和真实感
            digitalHuman.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                const material = child.material;
                // 如果是数组材质，遍历每个材质
                if (Array.isArray(material)) {
                  material.forEach((mat) => {
                    if (
                      mat instanceof THREE.MeshStandardMaterial ||
                      mat instanceof THREE.MeshPhysicalMaterial
                    ) {
                      // 轻微提亮材质，增强可见度
                      if (mat.color) {
                        const hsl = { h: 0, s: 0, l: 0 };
                        mat.color.getHSL(hsl);
                        // 轻微增加亮度，但不要过度
                        hsl.l = Math.min(hsl.l * 1.15, 0.95);
                        mat.color.setHSL(hsl.h, hsl.s, hsl.l);
                      }
                      // 优化材质属性，让细节更清晰
                      if (mat.roughness !== undefined) {
                        mat.roughness = Math.max(mat.roughness * 0.95, 0.1);
                      }
                      mat.needsUpdate = true;
                    }
                  });
                } else if (
                  material instanceof THREE.MeshStandardMaterial ||
                  material instanceof THREE.MeshPhysicalMaterial
                ) {
                  // 单个材质的情况
                  if (material.color) {
                    const hsl = { h: 0, s: 0, l: 0 };
                    material.color.getHSL(hsl);
                    hsl.l = Math.min(hsl.l * 1.15, 0.95);
                    material.color.setHSL(hsl.h, hsl.s, hsl.l);
                  }
                  if (material.roughness !== undefined) {
                    material.roughness = Math.max(
                      material.roughness * 0.95,
                      0.1
                    );
                  }
                  material.needsUpdate = true;
                }
              }
            });

            scene.add(digitalHuman);

            // 参考 HTML 示例：对整个模型创建 AnimationMixer
            mixerRef.current = new THREE.AnimationMixer(digitalHuman);

            // 查找并播放动画 - 参考 HTML 示例：直接播放所有动画
            if (gltf.animations && gltf.animations.length > 0) {
              console.log(
                "[AvatarScene] ✅ 模型动画列表:",
                gltf.animations.map((a) => a.name)
              );
              const idleClip = gltf.animations.find(
                (clip) =>
                  clip.name === "Idle_Torch_Loop" ||
                  clip.name.toLowerCase().includes("idle") ||
                  clip.name.toLowerCase().includes("torch")
              );
              const talkingClip = gltf.animations.find(
                (clip) =>
                  clip.name === "Idle_Talking_Loop" ||
                  clip.name.toLowerCase().includes("talking") ||
                  clip.name.toLowerCase().includes("speak")
              );

              if (idleClip && mixerRef.current) {
                idleActionRef.current = mixerRef.current.clipAction(idleClip);
                console.log("[AvatarScene] ✅ 找到空闲动画:", idleClip.name);
                if (!isTalking) {
                  idleActionRef.current.play();
                  idleActionRef.current.setLoop(THREE.LoopRepeat);
                  console.log(
                    "[AvatarScene] ✅ 播放空闲动画，isRunning:",
                    idleActionRef.current.isRunning()
                  );
                }
              }
              if (talkingClip && mixerRef.current) {
                talkingActionRef.current =
                  mixerRef.current.clipAction(talkingClip);
                console.log("[AvatarScene] ✅ 找到说话动画:", talkingClip.name);
                if (isTalking) {
                  talkingActionRef.current.play();
                  talkingActionRef.current.setLoop(THREE.LoopRepeat);
                  console.log(
                    "[AvatarScene] ✅ 播放说话动画，isRunning:",
                    talkingActionRef.current.isRunning()
                  );
                }
              }

              // 如果没有找到指定的动画，播放第一个动画
              if (
                !idleClip &&
                !talkingClip &&
                gltf.animations.length > 0 &&
                mixerRef.current
              ) {
                const action = mixerRef.current.clipAction(gltf.animations[0]);
                action.play();
                action.setLoop(THREE.LoopRepeat);
                console.log(
                  "[AvatarScene] ⚠️ 使用第一个动画（未找到指定动画）:",
                  gltf.animations[0].name
                );
                // 同时设置为idle和talking，这样至少会有动画
                idleActionRef.current = action;
                talkingActionRef.current = action;
              }
            } else {
              console.warn("[AvatarScene] ⚠️ 模型没有动画数据！");
              console.warn(
                "[AvatarScene] ⚠️ 提示：需要使用绑骨后导出的动画模型"
              );
              console.warn("[AvatarScene] ⚠️ 当前模型URL:", modelUrl);
            }
          },
          undefined,
          (error) => console.error("[AvatarScene] 模型加载失败:", error)
        );
      } catch (error) {
        console.error("[AvatarScene] ❌ 缓存加载失败，使用原始URL:", error);
        // 如果缓存失败，回退到原始URL
        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            console.log(
              "[AvatarScene] 模型加载成功（原始URL），URL:",
              modelUrl
            );
            const digitalHuman = gltf.scene;

            // 优化材质，增强亮度和真实感（与缓存加载路径相同的处理）
            digitalHuman.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                const material = child.material;
                if (Array.isArray(material)) {
                  material.forEach((mat) => {
                    if (
                      mat instanceof THREE.MeshStandardMaterial ||
                      mat instanceof THREE.MeshPhysicalMaterial
                    ) {
                      if (mat.color) {
                        const hsl = { h: 0, s: 0, l: 0 };
                        mat.color.getHSL(hsl);
                        hsl.l = Math.min(hsl.l * 1.15, 0.95);
                        mat.color.setHSL(hsl.h, hsl.s, hsl.l);
                      }
                      if (mat.roughness !== undefined) {
                        mat.roughness = Math.max(mat.roughness * 0.95, 0.1);
                      }
                      mat.needsUpdate = true;
                    }
                  });
                } else if (
                  material instanceof THREE.MeshStandardMaterial ||
                  material instanceof THREE.MeshPhysicalMaterial
                ) {
                  if (material.color) {
                    const hsl = { h: 0, s: 0, l: 0 };
                    material.color.getHSL(hsl);
                    hsl.l = Math.min(hsl.l * 1.15, 0.95);
                    material.color.setHSL(hsl.h, hsl.s, hsl.l);
                  }
                  if (material.roughness !== undefined) {
                    material.roughness = Math.max(
                      material.roughness * 0.95,
                      0.1
                    );
                  }
                  material.needsUpdate = true;
                }
              }
            });

            scene.add(digitalHuman);
            mixerRef.current = new THREE.AnimationMixer(digitalHuman);
            if (gltf.animations && gltf.animations.length > 0) {
              const action = mixerRef.current.clipAction(gltf.animations[0]);
              action.play();
              action.setLoop(THREE.LoopRepeat);
              idleActionRef.current = action;
              talkingActionRef.current = action;
            }
          },
          undefined,
          (error) => console.error("[AvatarScene] 模型加载失败:", error)
        );
      }
    };

    loadModel();

    // 参考 HTML 示例：动画循环
    const clock = new THREE.Clock();
    const animate = () => {
      animateId = requestAnimationFrame(animate);
      if (mixerRef.current) {
        mixerRef.current.update(clock.getDelta());
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animateId) cancelAnimationFrame(animateId);
      if (idleActionRef.current) {
        idleActionRef.current.stop();
        idleActionRef.current = null;
      }
      if (talkingActionRef.current) {
        talkingActionRef.current.stop();
        talkingActionRef.current = null;
      }
      mixerRef.current = null;
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl]);

  // 切换动画
  useEffect(() => {
    if (!mixerRef.current) {
      console.log("[AvatarScene] ⚠️ 切换动画时 mixerRef 为空");
      return;
    }

    console.log("[AvatarScene] 🔄 切换动画状态:", {
      isTalking,
      hasIdle: !!idleActionRef.current,
      hasTalking: !!talkingActionRef.current,
    });

    if (isTalking && talkingActionRef.current) {
      if (idleActionRef.current) {
        idleActionRef.current.fadeOut(0.3);
        idleActionRef.current.stop();
      }
      talkingActionRef.current.reset();
      talkingActionRef.current.play();
      talkingActionRef.current.setLoop(THREE.LoopRepeat);
      talkingActionRef.current.fadeIn(0.3);
      console.log("[AvatarScene] ✅ 切换到说话动画");
    } else if (!isTalking && idleActionRef.current) {
      if (talkingActionRef.current) {
        talkingActionRef.current.fadeOut(0.3);
        talkingActionRef.current.stop();
      }
      idleActionRef.current.reset();
      idleActionRef.current.play();
      idleActionRef.current.setLoop(THREE.LoopRepeat);
      idleActionRef.current.fadeIn(0.3);
      console.log("[AvatarScene] ✅ 切换到空闲动画");
    } else {
      console.warn("[AvatarScene] ⚠️ 无法切换动画 - 缺少动画动作");
    }
  }, [isTalking]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "500px" }}
    />
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.companions && !parsed.activeId && parsed.id) {
          return { companions: [parsed], activeId: parsed.id };
        }
        return parsed;
      }
      return {
        companions: [DEFAULT_COMPANION],
        activeId: DEFAULT_COMPANION.id,
      };
    } catch (e) {
      console.error(e);
      return {
        companions: [DEFAULT_COMPANION],
        activeId: DEFAULT_COMPANION.id,
      };
    }
  });

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [hasLoadedBackend, setHasLoadedBackend] = useState(false);

  // 从后端加载模型列表（只在首次加载时执行）
  useEffect(() => {
    if (hasLoadedBackend) return; // 避免重复加载

    const loadModelsFromBackend = async () => {
      try {
        setIsLoadingModels(true);
        const models = await modelService.getModels("User", true);
        const companions = models.map((model) =>
          modelService.modelToCompanion(model)
        );

        setData((prev) => {
          // 完全以后端模型为准，只保留后端返回的模型
          // 对于已有的companion，尝试保留本地的一些UI相关数据（如avatarUrl）
          const mergedCompanions = companions.map((backendCompanion) => {
            const localCompanion = prev.companions.find(
              (c) => c.model_id === backendCompanion.model_id
            );
            if (localCompanion) {
              // 保留本地的avatarUrl（如果后端没有提供），其他数据完全使用后端的
              return {
                ...backendCompanion,
                avatarUrl:
                  localCompanion.avatarUrl || backendCompanion.avatarUrl,
              };
            }
            return backendCompanion;
          });

          // 完全以后端为准，不保留本地独有的companion
          const activeId =
            prev.activeId &&
            mergedCompanions.find((c) => c.id === prev.activeId)
              ? prev.activeId
              : mergedCompanions.length > 0
              ? mergedCompanions[0].id
              : DEFAULT_COMPANION.id;

          return {
            companions: mergedCompanions,
            activeId: activeId,
          };
        });

        setHasLoadedBackend(true);
      } catch (error) {
        console.error("从后端加载模型失败，使用本地数据:", error);
        // 如果加载失败，继续使用本地数据
        setHasLoadedBackend(true);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModelsFromBackend();
  }, [hasLoadedBackend]); // 只在首次加载时执行

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // API 配置调试信息
  useEffect(() => {
    const config = APIConfig.getConfigInfo();
    console.log("📱 [API 配置] 当前配置信息:", config);
    console.log("📱 [API 配置] 当前 API URL:", APIConfig.getApiUrl());

    // 测试连接
    APIConfig.testConnection().then((connected) => {
      console.log("📱 [API 配置] 连接测试:", connected ? "✅ 成功" : "❌ 失败");
      if (!connected) {
        console.warn("⚠️ [API 配置] 无法连接到 API，请检查：");
        console.warn("1. 是否创建了 .env.local 文件？");
        console.warn("2. VITE_FAY_API_URL 是否正确设置？");
        console.warn("3. 手机和电脑是否在同一 Wi-Fi？");
        console.warn("4. Fay 后端是否正在运行？");
        console.warn("当前尝试连接的地址:", APIConfig.getApiUrl());
      }
    });
  }, []);

  const activeCompanion =
    data.companions.find((c) => c.id === data.activeId) ||
    data.companions[0] ||
    null;

  const addCompanion = async (newCompanion: Companion) => {
    try {
      // 如果有角色属性、描述或3D模型，同步创建后端模型
      if (
        newCompanion.characterAttributes ||
        newCompanion.characterDescription ||
        newCompanion.model3dUrl
      ) {
        const modelData = modelService.companionToModelData(newCompanion);
        const modelId = await modelService.createModel(modelData);
        newCompanion.model_id = modelId;
        newCompanion.id = modelId; // 使用后端返回的model_id作为前端ID，确保一致性
        console.log("[App] 后端模型创建成功，model_id:", modelId);
      }

      setData((prev) => ({
        companions: [...prev.companions, newCompanion],
        activeId: newCompanion.id,
      }));

      // 如果创建了后端模型，选择该模型
      if (newCompanion.model_id) {
        try {
          await modelService.selectModel(newCompanion.model_id, "User");
        } catch (error) {
          console.warn("选择模型失败:", error);
        }
      }
    } catch (error) {
      console.error("创建后端模型失败，仅保存到本地:", error);
      // 即使后端创建失败，也保存到本地
      setData((prev) => ({
        companions: [...prev.companions, newCompanion],
        activeId: newCompanion.id,
      }));
    }
  };

  const updateActiveCompanion = async (updates: Partial<Companion>) => {
    if (!activeCompanion) return;

    const updatedCompanion = { ...activeCompanion, ...updates };

    // 如果companion有model_id，同步更新后端模型
    if (updatedCompanion.model_id) {
      try {
        const modelData = modelService.companionToModelData(updatedCompanion);
        await modelService.updateModel(updatedCompanion.model_id, {
          name: modelData.name,
          description: modelData.description,
          attribute_json: modelData.attribute_json,
          model3d_url: modelData.model3d_url, // 同步3D模型URL
          idle_model_url: modelData.idle_model_url, // 同步待机动画模型URL
          talking_model_url: modelData.talking_model_url, // 同步说话动画模型URL
        });
        console.log("[App] 后端模型更新成功，包括model3d_url和动画模型URL");
      } catch (error) {
        console.error("更新后端模型失败:", error);
      }
    }

    setData((prev) => ({
      ...prev,
      companions: prev.companions.map((c) =>
        c.id === prev.activeId ? updatedCompanion : c
      ),
    }));
  };

  const switchCompanion = async (id: string) => {
    const companion = data.companions.find((c) => c.id === id);

    // 如果companion有model_id，选择该模型
    if (companion?.model_id) {
      try {
        await modelService.selectModel(companion.model_id, "User");
        console.log("[App] 已选择模型:", companion.model_id);
      } catch (error) {
        console.warn("选择模型失败:", error);
      }
    }

    // 预加载并缓存动画文件
    if (companion?.idleModelUrl || companion?.talkingModelUrl) {
      try {
        const { animationCacheService } = await import(
          "./services/animationCacheService"
        );
        // 异步预加载，不阻塞UI
        animationCacheService
          .preloadAnimations(companion.idleModelUrl, companion.talkingModelUrl)
          .then(() => {
            console.log("[App] ✅ 动画预加载完成");
          })
          .catch((error) => {
            console.warn("[App] ⚠️ 动画预加载失败:", error);
          });
      } catch (error) {
        console.warn("[App] ⚠️ 加载动画缓存服务失败:", error);
      }
    }

    setData((prev) => ({ ...prev, activeId: id }));
  };

  const deleteCompanion = async (id: string) => {
    const companion = data.companions.find((c) => c.id === id);

    // 如果companion有model_id，同步删除后端模型
    if (companion?.model_id) {
      try {
        await modelService.deleteModel(companion.model_id);
        console.log("[App] 后端模型删除成功");
      } catch (error) {
        console.error("删除后端模型失败:", error);
      }
    }

    setData((prev) => {
      const newCompanions = prev.companions.filter((c) => c.id !== id);
      let newActiveId = prev.activeId;
      if (id === prev.activeId) {
        newActiveId = newCompanions.length > 0 ? newCompanions[0].id : "";

        // 如果切换到了新的companion，选择对应的模型
        if (newActiveId) {
          const newCompanion = newCompanions.find((c) => c.id === newActiveId);
          if (newCompanion?.model_id) {
            modelService
              .selectModel(newCompanion.model_id, "User")
              .catch((err) => {
                console.warn("选择新模型失败:", err);
              });
          }
        }
      }
      return { companions: newCompanions, activeId: newActiveId };
    });
  };

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <BackgroundDecorations />
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route
              path="/"
              element={<HomePage companion={activeCompanion} />}
            />
            <Route
              path="/create"
              element={<CreatePage addCompanion={addCompanion} />}
            />
            <Route
              path="/bind"
              element={
                <BindPage
                  companion={activeCompanion}
                  updateCompanion={updateActiveCompanion}
                />
              }
            />
            <Route
              path="/chat"
              element={
                <ChatPage
                  key={activeCompanion?.id}
                  companion={activeCompanion}
                />
              }
            />
            <Route
              path="/manage"
              element={
                <ManagePage
                  companions={data.companions}
                  activeCompanion={activeCompanion}
                  switchCompanion={switchCompanion}
                  updateCompanion={updateActiveCompanion}
                  deleteCompanion={deleteCompanion}
                />
              }
            />
          </Routes>
        </main>
        <Navigation />
      </div>
    </HashRouter>
  );
};

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const navItems = [
    { path: "/", icon: <Home size={20} />, label: "首页" },
    { path: "/create", icon: <Sparkles size={20} />, label: "生成" },
    { path: "/bind", icon: <Heart size={20} />, label: "绑定" },
    { path: "/chat", icon: <MessageCircle size={20} />, label: "互动" },
    { path: "/manage", icon: <Settings size={20} />, label: "管理" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-pink-300/50 px-6 py-4 flex justify-between items-center z-[60] md:justify-center md:gap-12 bg-white/80 backdrop-blur-xl shadow-lg">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${
            isActive(item.path)
              ? "text-secondary scale-110"
              : "text-gray-600/70 hover:text-gray-800"
          }`}
        >
          {item.icon}
          <span className="text-[10px] font-medium">{item.label}</span>
        </Link>
      ))}
    </div>
  );
};

// --- Pages ---

const HomePage: React.FC<{ companion: Companion | null }> = ({ companion }) => {
  const navigate = useNavigate();
  const menuItems = [
    {
      id: "generate",
      title: "生成",
      subtitle: "创造 3D 数字人",
      path: "/create",
      icon: <Sparkles size={28} className="text-pink-400" />,
      gradient: "from-pink-200/50 to-orange-200/50",
    },
    {
      id: "bind",
      title: "绑定",
      subtitle: "骨骼与蒙皮",
      path: "/bind",
      icon: <Heart size={28} className="text-rose-400" />,
      gradient: "from-rose-200/50 to-amber-200/50",
    },
    {
      id: "interact",
      title: "互动",
      subtitle: "驱动与对话",
      path: "/chat",
      icon: <MessageCircle size={28} className="text-emerald-400" />,
      gradient: "from-emerald-200/50 to-teal-200/50",
    },
    {
      id: "manage",
      title: "管理",
      subtitle: "模型数据库",
      path: "/manage",
      icon: <Settings size={28} className="text-amber-400" />,
      gradient: "from-amber-200/50 to-yellow-200/50",
    },
  ];

  return (
    <PageContainer className="flex flex-col min-h-[80vh]">
      <div className="text-center pt-8 mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-300 mb-2 leading-tight drop-shadow-lg animate-fade-in">
          情智兼备的
          <br />
          虚拟陪伴系统
        </h1>
        <p
          className="text-gray-600/80 text-sm tracking-widest uppercase flex items-center justify-center gap-2 animate-fade-in"
          style={{ animationDelay: "0.1s" }}
        >
          <Star size={12} className="text-yellow-500" /> 3D 智能陪伴{" "}
          <Star size={12} className="text-yellow-500" />
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 content-start">
        {menuItems.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => navigate(item.path)}
            className="glass-panel aspect-square rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 group relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.06}s` }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
            />
            <div className="relative z-10 p-3 rounded-full bg-white/50 group-hover:bg-white/70 transition-colors shadow-inner ring-1 ring-pink-200/30 animate-float">
              {item.icon}
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-gray-700 mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-gray-600/80 group-hover:text-gray-800 transition-colors">
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
};

const CreatePage: React.FC<{ addCompanion: (c: Companion) => void }> = ({
  addCompanion,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  // 生成参数状态
  const [generateTexture, setGenerateTexture] = useState(true); // 默认生成纹理
  const [octreeResolution, setOctreeResolution] = useState(128);
  const [numInferenceSteps, setNumInferenceSteps] = useState(5);
  const [guidanceScale, setGuidanceScale] = useState(5.0);

  // 角色描述相关状态
  const [characterDescription, setCharacterDescription] = useState("");
  const [isGeneratingAttributes, setIsGeneratingAttributes] = useState(false);
  const [characterAttributes, setCharacterAttributes] =
    useState<CharacterAttributes | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const navigate = useNavigate();

  // Voice Recognition Logic
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("您的浏览器不支持语音识别功能");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
        setPrompt(transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  // Model Upload Logic - 上传到服务器
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setLoading(true);
        setGenerationProgress("正在上传模型文件...");

        // 上传文件到服务器
        const serverUrl = await modelService.uploadModel(file);
        setUploadedModelUrl(serverUrl);

        setGenerationProgress("模型上传成功！");

        // 不设置prompt为"Uploaded Model"，保持用户输入的描述
        // 如果用户没有输入描述，提示用户可以输入
        if (!prompt.trim() && !characterDescription.trim()) {
          setPrompt(""); // 清空prompt，让用户输入角色描述
        }
      } catch (error) {
        console.error("[CreatePage] 上传模型失败:", error);
        alert(
          `上传模型失败: ${error instanceof Error ? error.message : "未知错误"}`
        );
      } finally {
        setLoading(false);
        setGenerationProgress("");
      }
    }
  };

  // Image Upload Logic (用于图生3D)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!validTypes.includes(file.type)) {
        alert("请上传 PNG、JPG 或 WEBP 格式的图片");
        return;
      }
      setUploadedImageFile(file);
      // 如果有图片，清空文字提示
      if (file) {
        setPrompt("");
      }
    }
  };

  // 生成角色属性
  const handleGenerateAttributes = async (description: string) => {
    if (!description.trim()) return;

    setIsGeneratingAttributes(true);
    try {
      const tempCompanionId = `temp_${Date.now()}`;
      const attributes = await characterService.generateAttributes(
        description,
        tempCompanionId
      );
      setCharacterAttributes(attributes);
      console.log("[CreatePage] 角色属性生成成功:", attributes);
    } catch (error) {
      console.error("[CreatePage] 角色属性生成失败:", error);
      alert(
        `角色属性生成失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    } finally {
      setIsGeneratingAttributes(false);
    }
  };

  const handleGenerateProfile = async () => {
    // 必须提供文字描述、上传的图片或上传的模型之一
    if (!prompt.trim() && !uploadedImageFile && !uploadedModelUrl) return;

    setLoading(true);
    setGenerating(false);
    setGenerationProgress("");

    try {
      let modelUrl: string | null = null; // Blob URL用于预览
      let serverUrl: string | null = null; // 服务器URL用于保存到数据库

      // 优先使用上传的模型（如果存在）
      if (uploadedModelUrl) {
        // uploadedModelUrl已经是服务器URL（从uploadModel返回）
        modelUrl = uploadedModelUrl; // 用于预览（如果服务器URL可访问，直接使用）
        serverUrl = uploadedModelUrl; // 服务器URL
        setGenerationProgress("使用已上传的模型...");
      }
      // 如果有上传的图片，进行图生3D
      else if (uploadedImageFile) {
        setGenerating(true);
        setGenerationProgress("正在生成3D模型（图生3D）...");

        const result = await generateModelFromImage(uploadedImageFile, {
          seed: 1234,
          octree_resolution: octreeResolution,
          num_inference_steps: numInferenceSteps,
          guidance_scale: guidanceScale,
          texture: generateTexture,
          type: "glb",
          ...(generateTexture && { face_count: 40000 }),
        });

        if (result.success && result.modelUrl) {
          modelUrl = result.modelUrl; // Blob URL用于预览
          serverUrl = result.serverUrl || result.modelUrl; // 服务器URL
          setGenerationProgress("3D模型生成成功！");
        } else {
          throw new Error(result.error || "3D模型生成失败");
        }
      }
      // 如果有文字描述，进行文字生3D
      else if (prompt.trim()) {
        setGenerating(true);
        setGenerationProgress("正在生成3D模型（文字生3D）...");

        const result = await generateModelFromText(prompt, {
          seed: 1234,
          octree_resolution: octreeResolution,
          num_inference_steps: numInferenceSteps,
          guidance_scale: guidanceScale,
          texture: generateTexture,
          type: "glb",
          ...(generateTexture && { face_count: 40000 }),
        });

        if (result.success && result.modelUrl) {
          modelUrl = result.modelUrl; // Blob URL用于预览
          serverUrl = result.serverUrl || result.modelUrl; // 服务器URL
          setGenerationProgress("3D模型生成成功！");
        } else {
          throw new Error(result.error || "3D模型生成失败");
        }
      }

      // 生成角色名称，优先使用角色属性中的名称
      let defaultName;
      if (characterAttributes && characterAttributes.name) {
        // 如果有生成的角色属性，使用属性中的名称
        defaultName = characterAttributes.name;
      } else if (characterDescription && characterDescription.trim()) {
        // 如果有角色描述但没有生成属性，从描述中提取名称或使用描述的前20个字符
        defaultName = characterDescription.substring(0, 20);
      } else if (prompt.trim() && !prompt.startsWith("Uploaded Model:")) {
        // 如果有用户输入且不是上传模型的默认文本，使用输入的前20个字符
        defaultName = prompt.substring(0, 20);
      } else if (uploadedImageFile) {
        // 如果是图片上传，生成默认名称
        defaultName = `3D角色_${Date.now().toString().slice(-6)}`;
      } else {
        // 其他情况，生成默认名称
        defaultName = `角色_${Date.now().toString().slice(-6)}`;
      }

      // 生成角色资料，优先使用角色属性信息
      const data: any = {
        name: defaultName,
        role: characterAttributes?.position || "虚拟伙伴",
        personality:
          characterDescription ||
          characterAttributes?.additional ||
          prompt.trim() ||
          "这是一个3D虚拟角色",
        visualPrompt: characterDescription || prompt.trim() || "3D角色",
        avatarUrl: "https://via.placeholder.com/150",
      };

      // 保存预览URL和服务器URL
      if (modelUrl) {
        data.model3dUrl = modelUrl; // Blob URL用于预览
      }
      if (serverUrl) {
        data.serverModelUrl = serverUrl; // 服务器URL用于保存到数据库
      }

      console.log("[CreatePage] 生成完成，预览URL:", modelUrl);
      console.log("[CreatePage] 服务器URL:", serverUrl);
      console.log("[CreatePage] 生成的数据:", data);

      setGeneratedData(data);

      setStep(2);
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : "生成失败";
      alert(`生成失败: ${errorMsg}`);
    } finally {
      setLoading(false);
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleConfirm = async () => {
    if (!generatedData) return;

    try {
      setLoading(true);

      // 准备模型数据
      const modelData = {
        name: generatedData.name,
        description:
          generatedData.role ||
          characterDescription.trim() ||
          generatedData.personality ||
          "",
        character_description: characterDescription.trim() || undefined,
        attribute_json: characterAttributes || undefined,
        model3d_url:
          generatedData?.serverModelUrl ||
          generatedData?.model3dUrl ||
          uploadedModelUrl ||
          undefined,
        username: "User",
        is_global: 0,
      };

      // 调用后端API创建模型
      const modelId = await modelService.createModel(modelData);
      console.log("[CreatePage] 模型创建成功，modelId:", modelId);

      // 创建Companion对象
      const newCompanion: Companion = {
        id: modelId,
        model_id: modelId,
        name: generatedData.name,
        role: generatedData.role,
        personality: generatedData.personality,
        avatarUrl: generatedData.avatarUrl,
        isBound: false,
        createdAt: Date.now(),
        model3dUrl:
          generatedData?.model3dUrl ||
          generatedData?.serverModelUrl ||
          uploadedModelUrl ||
          "", // 使用预览URL或服务器URL
        // 添加角色描述和属性
        characterDescription: characterDescription.trim() || undefined,
        characterAttributes: characterAttributes || undefined,
      };

      // 如果有角色属性，保存到本地缓存
      if (characterAttributes) {
        characterService.saveAttributes(newCompanion.id, characterAttributes);
      }

      await addCompanion(newCompanion);
      navigate("/bind");
    } catch (error) {
      console.error("[CreatePage] 创建模型失败:", error);
      alert(
        `创建模型失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-2 text-center">
        <h2 className="text-2xl font-bold mb-1">创造数字生命</h2>
        <p className="text-gray-600/70 text-xs">
          上传图片、输入描述或上传模型，生成3D虚拟实体
        </p>
      </div>

      {step === 1 ? (
        <div className="flex flex-col min-h-[70vh] items-center justify-between space-y-4">
          {/* Dynamic Sphere Section (Voice Interface) */}
          <div className="flex-1 w-full flex flex-col items-center justify-center relative">
            <div
              onClick={toggleListening}
              className={`
                 relative w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500
                 ${isListening ? "scale-110" : "scale-100 hover:scale-105"}
               `}
            >
              {/* Core Sphere */}
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-md opacity-80 ${
                  isListening ? "animate-pulse" : ""
                }`}
              ></div>
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 z-10 flex items-center justify-center border border-white/10">
                {isListening ? (
                  <div className="flex gap-1 h-8 items-center">
                    <span className="w-1 bg-white animate-[bounce_1s_infinite] h-4"></span>
                    <span className="w-1 bg-white animate-[bounce_1.2s_infinite] h-8"></span>
                    <span className="w-1 bg-white animate-[bounce_0.8s_infinite] h-6"></span>
                    <span className="w-1 bg-white animate-[bounce_1.1s_infinite] h-5"></span>
                  </div>
                ) : (
                  <Mic size={48} className="text-white/50" />
                )}
              </div>
              {/* Outer Glow Rings */}
              {isListening && (
                <>
                  <div className="absolute inset-[-20px] rounded-full border border-purple-500/30 animate-[spin_4s_linear_infinite]"></div>
                  <div className="absolute inset-[-40px] rounded-full border border-pink-500/10 animate-[spin_8s_linear_infinite_reverse]"></div>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-gray-600/70 animate-pulse">
              {isListening
                ? "正在聆听您的构想..."
                : "点击球体开始对话，或下方输入"}
            </p>
          </div>

          {/* Input Area */}
          <div className="w-full space-y-4">
            {/* 角色描述输入 */}
            <CharacterDescriptionInput
              value={characterDescription}
              onChange={setCharacterDescription}
              onGenerate={handleGenerateAttributes}
              isGenerating={isGeneratingAttributes}
              disabled={generating || loading}
            />

            {/* 显示生成的角色属性摘要 */}
            {characterAttributes && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs text-green-400">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} />
                  <span className="font-semibold">角色属性已生成</span>
                </div>
                <div className="space-y-1 text-green-300">
                  <p>
                    <span className="text-green-400">姓名:</span>{" "}
                    {characterAttributes.name}
                  </p>
                  <p>
                    <span className="text-green-400">职业:</span>{" "}
                    {characterAttributes.job}
                  </p>
                  <p>
                    <span className="text-green-400">性格:</span>{" "}
                    {characterAttributes.additional}
                  </p>
                </div>
              </div>
            )}

            {/* Generation Progress */}
            {generating && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-400">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="animate-pulse" />
                  <span>{generationProgress || "正在生成3D模型..."}</span>
                </div>
                <div className="w-full h-1 bg-blue-500/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 animate-pulse"
                    style={{ width: "60%" }}
                  ></div>
                </div>
              </div>
            )}

            {/* Upload Info */}
            {uploadedModelUrl && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between text-xs text-green-400">
                <span className="flex items-center gap-2">
                  <Box size={14} /> 模型已就绪（已上传）
                </span>
                <button
                  onClick={() => {
                    setUploadedModelUrl(null);
                  }}
                  className="hover:text-gray-800"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {uploadedImageFile && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 flex items-center justify-between text-xs text-purple-400">
                <span className="flex items-center gap-2">
                  <ImageIcon size={14} /> 图片已就绪：{uploadedImageFile.name}
                </span>
                <button
                  onClick={() => {
                    setUploadedImageFile(null);
                  }}
                  className="hover:text-gray-800"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* 生成参数调整面板 */}
            {(uploadedImageFile || prompt.trim()) && !uploadedModelUrl && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">
                    生成参数
                  </span>
                </div>

                {/* 纹理生成开关 */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-700 font-medium">
                    生成纹理
                  </label>
                  <button
                    onClick={() => setGenerateTexture(!generateTexture)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      generateTexture ? "bg-indigo-500" : "bg-white/20"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        generateTexture ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 分辨率 */}
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1 block">
                    分辨率: {octreeResolution}
                  </label>
                  <input
                    type="range"
                    min="64"
                    max="256"
                    step="64"
                    value={octreeResolution}
                    onChange={(e) =>
                      setOctreeResolution(Number(e.target.value))
                    }
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    disabled={generating || loading}
                  />
                  <div className="flex justify-between text-[10px] text-gray-600/70 mt-1">
                    <span>64 (快速)</span>
                    <span>128 (平衡)</span>
                    <span>256 (高质量)</span>
                  </div>
                </div>

                {/* 推理步数 */}
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1 block">
                    推理步数: {numInferenceSteps}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="1"
                    value={numInferenceSteps}
                    onChange={(e) =>
                      setNumInferenceSteps(Number(e.target.value))
                    }
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    disabled={generating || loading}
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>3 (快速)</span>
                    <span>5 (平衡)</span>
                    <span>10 (高质量)</span>
                  </div>
                </div>

                {/* 引导比例 */}
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1 block">
                    引导比例: {guidanceScale.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="3.0"
                    max="7.0"
                    step="0.5"
                    value={guidanceScale}
                    onChange={(e) => setGuidanceScale(Number(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    disabled={generating || loading}
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>3.0 (宽松)</span>
                    <span>5.0 (平衡)</span>
                    <span>7.0 (严格)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Image Upload Button */}
            <div className="flex gap-2">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <Button
                onClick={() => imageInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                disabled={generating || loading}
              >
                <ImageIcon size={16} className="mr-2" />
                上传图片（图生3D）
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".glb,.gltf"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-green-500/30 text-green-300 hover:bg-green-500/20"
                disabled={generating || loading}
              >
                <Upload size={16} className="mr-2" />
                上传模型（备选）
              </Button>
            </div>

            <div className="relative">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入文字描述（文字生3D）..."
                className="pr-12"
                disabled={generating || loading || !!uploadedImageFile}
              />
              {!uploadedImageFile && (
                <button
                  onClick={toggleListening}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  title="语音输入"
                >
                  <Mic
                    size={20}
                    className={isListening ? "text-red-400 animate-pulse" : ""}
                  />
                </button>
              )}
            </div>

            <Button
              onClick={handleGenerateProfile}
              isLoading={loading || generating}
              className="w-full py-4 text-lg bg-gradient-to-r from-violet-600 to-indigo-600 shadow-xl shadow-indigo-900/20"
              disabled={
                (!prompt.trim() && !uploadedImageFile && !uploadedModelUrl) ||
                generating
              }
            >
              {generating
                ? generationProgress || "正在生成3D模型..."
                : loading
                ? "正在生成角色资料..."
                : uploadedModelUrl
                ? "使用已上传模型"
                : uploadedImageFile
                ? "生成3D模型（图生3D）"
                : prompt.trim()
                ? "生成3D模型（文字生3D）"
                : "请上传图片或输入描述"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-[fadeIn_0.5s_ease-out] min-h-[75vh] w-full">
          <div className="w-full h-[650px] relative mb-6 bg-white/5 rounded-2xl overflow-hidden border border-white/10">
            <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-full text-xs text-green-400 border border-green-500/30 flex items-center gap-1">
              <Activity size={12} /> 3D 预览模式
            </div>
            {/* 3D Preview - uses generated or uploaded model */}
            {(() => {
              const modelUrl =
                generatedData?.model3dUrl || uploadedModelUrl || undefined;
              console.log("[CreatePage] Step 2 - 显示模型，URL:", modelUrl);
              console.log(
                "[CreatePage] Step 2 - generatedData:",
                generatedData
              );
              if (!modelUrl) {
                return (
                  <div className="w-full h-full flex items-center justify-center text-gray-600/70">
                    <div className="text-center">
                      <Box size={48} className="mx-auto mb-2 opacity-50" />
                      <p>暂无模型预览</p>
                    </div>
                  </div>
                );
              }
              return (
                <AvatarScene modelUrl={modelUrl} key={modelUrl || "default"} />
              );
            })()}
          </div>

          <div className="w-full mb-4">
            <h3 className="text-2xl font-bold text-gray-700">
              {generatedData.name}
            </h3>
            <p className="text-sm text-purple-600">{generatedData.role}</p>

            {/* 显示角色描述 */}
            {characterDescription && (
              <div className="mt-3 p-3 bg-white/70 rounded-lg border border-pink-300/30">
                <p className="text-xs text-gray-600 mb-1 font-medium">
                  角色描述
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {characterDescription}
                </p>
              </div>
            )}

            {/* 显示生成的角色属性摘要 */}
            {characterAttributes && (
              <div className="mt-3 p-3 bg-blue-100/80 rounded-lg border border-blue-300/50">
                <p className="text-xs text-blue-700 mb-2 flex items-center gap-1 font-semibold">
                  <User size={12} />
                  生成的角色属性
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600 font-medium">姓名:</span>{" "}
                    <span className="text-gray-700">
                      {characterAttributes.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">职业:</span>{" "}
                    <span className="text-gray-700">
                      {characterAttributes.job}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">性格:</span>{" "}
                    <span className="text-gray-700">
                      {characterAttributes.additional}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">定位:</span>{" "}
                    <span className="text-gray-700">
                      {characterAttributes.position}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 w-full">
            <Button
              variant="secondary"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              重试
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-600"
            >
              确认模型
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

const BindPage: React.FC<{
  companion: Companion | null;
  updateCompanion: (c: Partial<Companion>) => void;
}> = ({ companion, updateCompanion }) => {
  const [currentStep, setCurrentStep] = useState<ProcessStep>(
    ProcessStep.LoadModel
  );
  // 用于获取 Mesh2MotionViewer 导出的模型 URL
  const getExportedModelUrlsRef = useRef<
    (() => { idleModelUrl?: string; talkingModelUrl?: string }) | null
  >(null);
  const navigate = useNavigate();

  if (!companion) {
    return (
      <PageContainer className="text-center pt-20">
        <p className="mb-4 text-white/50">请先创建模型</p>
        <Link to="/create">
          <Button>去创建</Button>
        </Link>
      </PageContainer>
    );
  }

  if (companion.isBound) {
    return (
      <PageContainer className="flex flex-col min-h-[70vh]">
        {/* 模型预览区域 - 在上方 */}
        <div className="w-full h-[500px] relative mb-6 bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <AvatarScene modelUrl={companion.model3dUrl} />
          <div className="absolute top-4 right-4 bg-green-500 text-white p-2 rounded-full shadow-lg z-10">
            <Check size={20} />
          </div>
        </div>

        {/* 文字和按钮区域 - 在下方 */}
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-2">骨骼绑定已完成</h2>
          <p className="text-white/60 mb-8">
            模型 {companion.name} 已准备好被驱动。
          </p>
          <Link to="/chat">
            <Button size="lg" className="px-10">
              进入驱动交互
            </Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  /**
   * 处理绑骨完成事件
   * @param idleModelUrl 包含Idle_Torch_Loop动画的模型URL（可选）
   * @param talkingModelUrl 包含Idle_Talking_Loop动画的模型URL（可选）
   */
  const handleBindingComplete = async (
    idleModelUrl?: string,
    talkingModelUrl?: string
  ) => {
    console.log("[BindPage] ========== 绑骨完成回调（自动保存） ==========");
    console.log("[BindPage] 空闲模型URL:", idleModelUrl);
    console.log("[BindPage] 说话模型URL:", talkingModelUrl);

    // 自动保存动画模型URL到本地和后端
    const updateData: Partial<Companion> = {};

    if (idleModelUrl) {
      updateData.idleModelUrl = idleModelUrl;
      console.log("[BindPage] ✅ 自动保存 idleModelUrl:", idleModelUrl);
    }

    if (talkingModelUrl) {
      updateData.talkingModelUrl = talkingModelUrl;
      console.log("[BindPage] ✅ 自动保存 talkingModelUrl:", talkingModelUrl);
    }

    // 不修改 model3dUrl，保持使用原始模型
    // 只有在交互页面明确需要动画时才使用动画模型

    if (Object.keys(updateData).length > 0) {
      console.log("[BindPage] ✅ 立即保存动画模型到 companion 数据");

      // 先更新本地数据
      updateCompanion(updateData);
      console.log("[BindPage] ✅ 本地数据已更新");

      // 如果companion有model_id，同步到后端数据库
      if (companion?.model_id) {
        try {
          console.log("[BindPage] 开始同步动画模型URL到后端数据库...");
          const modelData = modelService.companionToModelData({
            ...companion,
            ...updateData,
          });

          const success = await modelService.updateModel(companion.model_id, {
            idle_model_url: modelData.idle_model_url,
            talking_model_url: modelData.talking_model_url,
          });

          if (success) {
            console.log("[BindPage] ✅✅✅ 动画模型URL已同步到后端数据库！");
          } else {
            console.warn("[BindPage] ⚠️ 同步到后端失败，但本地已保存");
          }
        } catch (error) {
          console.error("[BindPage] ❌ 同步到后端时出错:", error);
          console.warn("[BindPage] ⚠️ 本地数据已保存，但后端同步失败");
        }
      } else {
        console.warn(
          "[BindPage] ⚠️ Companion没有model_id，跳过后端同步（可能是本地创建的模型）"
        );
      }

      console.log("[BindPage] ✅✅✅ 动画模型已自动保存完成！");
    } else {
      console.warn("[BindPage] ⚠️ 没有动画模型URL需要保存");
    }
  };

  const handleStepChange = (step: ProcessStep) => {
    setCurrentStep(step);
  };

  return (
    <PageContainer className="min-h-screen flex flex-col">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">骨骼绑定 (Rigging)</h2>
        <p className="text-sm text-white/50 mt-1">
          使用 Mesh2Motion 进行专业的骨骼绑定
        </p>
      </div>

      {/* Mesh2Motion 3D 视图 */}
      <div className="flex-1 relative bg-white/5 rounded-2xl overflow-hidden border border-white/10 mb-4 min-h-[500px]">
        <Mesh2MotionViewer
          companion={companion}
          onBindingComplete={handleBindingComplete}
          onStepChange={handleStepChange}
          getExportedModelUrls={(getter) => {
            getExportedModelUrlsRef.current = getter;
          }}
        />
      </div>

      {/* Mesh2Motion 控制面板 */}
      <div className="flex-shrink-0 mb-4">
        <Mesh2MotionControls
          currentStep={currentStep}
          onBindingComplete={async () => {
            // 用户点击"进入对话"按钮时：
            // 1. 检查 companion 中是否已有动画模型URL（可能已经通过回调自动保存）
            // 2. 如果没有，尝试获取已导出的模型 URL
            // 3. 如果还没有导出，等待更长时间让导出完成
            // 4. 最终保存动画模型URL并设置 isBound: true
            // 5. 导航到对话页面
            console.log("[BindPage] ========== 用户点击进入对话 ==========");
            console.log("[BindPage] 首先检查 companion 中是否已有动画模型...");
            console.log(
              "[BindPage] companion.idleModelUrl:",
              companion?.idleModelUrl
            );
            console.log(
              "[BindPage] companion.talkingModelUrl:",
              companion?.talkingModelUrl
            );

            // 先检查 companion 中是否已经有动画模型（可能已经通过回调自动保存）
            let urls:
              | { idleModelUrl?: string; talkingModelUrl?: string }
              | undefined;
            if (companion?.idleModelUrl || companion?.talkingModelUrl) {
              console.log(
                "[BindPage] ✅ 检测到 companion 中已有动画模型URL（已自动保存）"
              );
              urls = {
                idleModelUrl: companion.idleModelUrl,
                talkingModelUrl: companion.talkingModelUrl,
              };
            } else {
              // 如果没有，尝试从 Mesh2MotionViewer 获取
              console.log(
                "[BindPage] companion 中没有动画模型，尝试从导出器获取..."
              );
              urls = getExportedModelUrlsRef.current?.();
              console.log(
                "[BindPage] 从导出器获取的URL:",
                JSON.stringify(urls, null, 2)
              );

              // 如果还没有导出，等待最多30秒（增加等待时间）
              if (
                !urls?.idleModelUrl &&
                !urls?.talkingModelUrl &&
                getExportedModelUrlsRef.current
              ) {
                console.log(
                  "[BindPage] 模型尚未导出，等待导出完成（最多30秒）..."
                );
                for (let i = 0; i < 60; i++) {
                  // 60次 * 500ms = 30秒
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  urls = getExportedModelUrlsRef.current?.();
                  if (urls?.idleModelUrl || urls?.talkingModelUrl) {
                    console.log(
                      "[BindPage] ✅ 导出完成，获取到模型URL:",
                      JSON.stringify(urls, null, 2)
                    );
                    // 立即保存到 companion
                    if (urls?.idleModelUrl || urls?.talkingModelUrl) {
                      handleBindingComplete(
                        urls?.idleModelUrl,
                        urls?.talkingModelUrl
                      );
                    }
                    break;
                  }
                  // 每5秒打印一次进度
                  if (i > 0 && i % 10 === 0) {
                    console.log(`[BindPage] 等待中... ${i * 0.5}秒 / 30秒`);
                  }
                }

                // 最终检查
                if (!urls?.idleModelUrl && !urls?.talkingModelUrl) {
                  urls = getExportedModelUrlsRef.current?.();
                  if (urls?.idleModelUrl || urls?.talkingModelUrl) {
                    console.log("[BindPage] ✅ 最终检查找到模型URL，立即保存");
                    handleBindingComplete(
                      urls?.idleModelUrl,
                      urls?.talkingModelUrl
                    );
                  } else {
                    console.warn(
                      "[BindPage] ⚠️ 等待超时，模型可能尚未导出，将使用原始模型（无动画）"
                    );
                  }
                }
              } else if (urls?.idleModelUrl || urls?.talkingModelUrl) {
                // 如果获取到了，立即保存
                console.log(
                  "[BindPage] ✅ 获取到模型URL，立即保存到 companion"
                );
                handleBindingComplete(
                  urls?.idleModelUrl,
                  urls?.talkingModelUrl
                );
              }
            }

            // 设置 isBound: true 并导航到对话页面
            console.log("[BindPage] 设置 isBound: true 并导航到对话页面");
            updateCompanion({ isBound: true });
            navigate("/chat");
          }}
        />
      </div>
    </PageContainer>
  );
};

const ChatPage: React.FC<{ companion: Companion | null }> = ({ companion }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isDriving, setIsDriving] = useState(false); // Controls the 3D model animation
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const audioUnlockedRef = useRef<boolean>(false); // 音频是否已解锁（Capacitor需要）
  const audioQueueRef = useRef<
    Array<{ url: string; isFirst: boolean; isEnd: boolean }>
  >([]); // 音频播放队列
  const isProcessingQueueRef = useRef<boolean>(false); // 是否正在处理队列
  const navigate = useNavigate();

  // 从后端加载历史消息
  const loadMessageHistory = async (modelId?: string) => {
    if (!companion) return;

    try {
      setIsLoadingHistory(true);
      const { getFayApiUrl } = await import("./services/apiConfig");
      const apiUrl = getFayApiUrl();

      const response = await fetch(`${apiUrl}/api/get-msg`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(
          JSON.stringify({
            username: "User",
            model_id: modelId || companion.model_id,
          })
        )}`,
      });

      if (!response.ok) {
        throw new Error(`加载历史消息失败: ${response.status}`);
      }

      const result = await response.json();
      if (result.list && Array.isArray(result.list)) {
        // 将后端消息格式转换为前端ChatMessage格式
        const historyMessages: ChatMessage[] = result.list.map((msg: any) => ({
          id: msg.id?.toString() || Date.now().toString() + Math.random(),
          role: msg.type === "fay" ? "model" : "user",
          text: msg.content || "",
          timestamp: msg.createtime ? msg.createtime * 1000 : Date.now(), // 后端时间戳是秒，需要转换为毫秒
        }));

        // 如果有历史消息，使用历史消息；否则显示欢迎消息
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        } else if (companion.isBound) {
          setMessages([
            {
              id: "welcome",
              role: "model",
              text: `系统就绪。我是 ${companion.name}。`,
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error("加载历史消息失败:", error);
      // 如果加载失败，显示欢迎消息
      if (companion.isBound && messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "model",
            text: `系统就绪。我是 ${companion.name}。`,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 当companion变化时，加载对应的历史消息
  useEffect(() => {
    if (companion && companion.isBound) {
      loadMessageHistory(companion.model_id);
    } else {
      // 如果companion未绑定，清空消息
      setMessages([]);
    }
  }, [companion?.id, companion?.model_id, companion?.isBound]); // 依赖companion的关键字段

  // WebSocket连接，用于接收TTS音频
  useEffect(() => {
    if (!companion || !companion.isBound) {
      // 如果companion未绑定，关闭WebSocket连接
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // 连接WebSocket服务器
    const connectWebSocket = async () => {
      try {
        const { getFayApiUrl } = await import("./services/apiConfig");
        const apiUrl = getFayApiUrl();

        // 解析主机与协议
        const api = new URL(apiUrl);
        const scheme = api.protocol === "https:" ? "wss" : "ws";
        const host = api.hostname;

        // 按优先级尝试端口：10002(人机接口) -> 10000(历史默认) -> 10003(面板接口)
        const candidateUrls = [
          `${scheme}://${host}:10002`,
          `${scheme}://${host}:10000`,
          `${scheme}://${host}:10003`,
        ];

        console.log("[ChatPage] 将尝试连接WebSocket候选地址:", candidateUrls);

        const createWsWithTimeout = (url: string, timeoutMs = 4000) => {
          return new Promise<WebSocket>((resolve, reject) => {
            try {
              const socket = new WebSocket(url);
              const timer = setTimeout(() => {
                try {
                  socket.close();
                } catch {}
                reject(new Error(`WebSocket 连接超时: ${url}`));
              }, timeoutMs);
              socket.onopen = () => {
                clearTimeout(timer);
                resolve(socket);
              };
              socket.onerror = (err) => {
                clearTimeout(timer);
                reject(
                  err instanceof Event
                    ? new Error(`WebSocket 错误: ${url}`)
                    : (err as any)
                );
              };
            } catch (e) {
              reject(e);
            }
          });
        };

        let ws: WebSocket | null = null;
        let lastError: any = null;
        for (const url of candidateUrls) {
          try {
            console.log("[ChatPage] 尝试连接WebSocket:", url);
            ws = await createWsWithTimeout(url, 4000);
            console.log("[ChatPage] ✅ WebSocket连接成功:", url);
            break;
          } catch (e) {
            console.warn(
              "[ChatPage] WebSocket连接失败，继续尝试下一个:",
              url,
              e
            );
            lastError = e;
          }
        }

        if (!ws) {
          console.error(
            "[ChatPage] ❌ 所有WebSocket候选地址均连接失败",
            lastError
          );
          return;
        }

        ws.onopen = () => {
          console.log("[ChatPage] ✅ WebSocket连接已建立");
          // 发送用户名和输出设置，用于标识连接
          const initMessage = {
            Username: "User",
            Output: true,
          };
          console.log("[ChatPage] 发送初始化消息:", initMessage);
          ws.send(JSON.stringify(initMessage));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[ChatPage] 收到WebSocket消息:", data);

            // 处理音频消息
            if (data.Topic === "human" && data.Data && data.Data.HttpValue) {
              const audioUrl = data.Data.HttpValue;
              const text = data.Data.Text || "";
              const isFirst = data.Data.IsFirst === 1;
              const isEnd = data.Data.IsEnd === 1;

              console.log("[ChatPage] 🎵 收到音频消息:", {
                audioUrl,
                text,
                isFirst,
                isEnd,
                isCapacitor: isCapacitor(),
                audioUnlocked: audioUnlockedRef.current,
                queueLength: audioQueueRef.current.length,
              });

              // 将音频添加到队列
              audioQueueRef.current.push({ url: audioUrl, isFirst, isEnd });

              // 开始处理队列（如果还没有在处理）
              processAudioQueue();

              // 如果是第一条消息，更新UI状态
              if (isFirst) {
                setIsDriving(true);
              }

              // 如果是最后一条消息，停止驱动动画
              if (isEnd) {
                setTimeout(() => setIsDriving(false), 1000);
              }
            } else {
              // 记录其他类型的消息，用于调试
              console.log("[ChatPage] 收到其他WebSocket消息:", {
                Topic: data.Topic,
                hasData: !!data.Data,
                keys: Object.keys(data),
              });
            }

            // 处理文本消息（如果有）
            if (data.panelReply) {
              const message: ChatMessage = {
                id: data.panelReply.id?.toString() || Date.now().toString(),
                role: "model",
                text: data.panelReply.content || "",
                timestamp: Date.now(),
              };
              setMessages((prev) => {
                // 检查是否已存在相同ID的消息
                const existingIndex = prev.findIndex(
                  (m) => m.id === message.id
                );
                if (existingIndex >= 0) {
                  // 更新现有消息
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    text: updated[existingIndex].text + message.text,
                  };
                  return updated;
                } else {
                  // 添加新消息
                  return [...prev, message];
                }
              });
            }
          } catch (error) {
            console.error("[ChatPage] 解析WebSocket消息失败:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[ChatPage] ❌ WebSocket错误:", error);
          const wsTarget = error.target as WebSocket;
          console.error("[ChatPage] WebSocket错误详情:", {
            readyState: wsTarget?.readyState,
            url: wsTarget?.url || wsRef.current?.url,
            error: error,
          });

          // 在Capacitor环境下，WebSocket可能无法连接，使用HTTP轮询作为备选
          if (isCapacitor()) {
            console.warn(
              "[ChatPage] ⚠️ Capacitor环境下WebSocket连接失败，将使用HTTP轮询作为备选方案"
            );
          }
        };

        ws.onclose = (event) => {
          console.log("[ChatPage] WebSocket连接已关闭", {
            code: event.code,
            reason: event.reason || "无原因",
            wasClean: event.wasClean,
            url: wsRef.current?.url,
          });
          wsRef.current = null;

          // 如果是连接失败（code 1006），在Capacitor环境下可能需要使用HTTP轮询
          if (event.code === 1006 && isCapacitor()) {
            console.warn(
              "[ChatPage] ⚠️ WebSocket连接异常关闭（可能是网络问题），在Capacitor环境下建议检查网络连接"
            );
          }

          // 只有在非正常关闭时才重连
          if (event.code !== 1000 && companion && companion.isBound) {
            console.log("[ChatPage] 将在5秒后尝试重连...");
            setTimeout(() => {
              if (companion && companion.isBound && !wsRef.current) {
                console.log("[ChatPage] 开始重连WebSocket...");
                connectWebSocket();
              }
            }, 5000);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("[ChatPage] WebSocket连接失败:", error);
      }
    };

    connectWebSocket();

    // 清理函数
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, [companion?.isBound]);

  // 当 companion 变化时，预加载动画
  useEffect(() => {
    if (companion?.idleModelUrl || companion?.talkingModelUrl) {
      const preloadAnimations = async () => {
        try {
          const { animationCacheService } = await import(
            "./services/animationCacheService"
          );
          await animationCacheService.preloadAnimations(
            companion.idleModelUrl,
            companion.talkingModelUrl
          );
          console.log("[ChatPage] ✅ 动画预加载完成");
        } catch (error) {
          console.warn("[ChatPage] ⚠️ 动画预加载失败:", error);
        }
      };
      preloadAnimations();
    }
  }, [companion?.idleModelUrl, companion?.talkingModelUrl]);

  /**
   * 处理音频播放队列（确保音频按顺序播放，避免重叠）
   */
  const processAudioQueue = async () => {
    // 如果正在处理队列或队列为空，直接返回
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    // 如果正在播放音频，等待播放完成
    if (isPlayingRef.current && audioPlayerRef.current) {
      console.log("[ChatPage] 正在播放音频，等待完成后继续队列");
      return;
    }

    // 开始处理队列
    isProcessingQueueRef.current = true;

    while (audioQueueRef.current.length > 0) {
      // 如果正在播放，等待播放完成
      if (isPlayingRef.current) {
        console.log("[ChatPage] 等待当前音频播放完成...");
        // 等待音频播放完成（通过轮询检查）
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!isPlayingRef.current) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          // 设置超时，最多等待10秒
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 10000);
        });
      }

      // 从队列中取出第一个音频
      const audioItem = audioQueueRef.current.shift();
      if (!audioItem) {
        break;
      }

      console.log(
        "[ChatPage] 从队列取出音频:",
        audioItem,
        "剩余队列长度:",
        audioQueueRef.current.length
      );

      // 播放音频（等待播放完成）
      try {
        await playAudio(audioItem.url, audioItem.isFirst, audioItem.isEnd);

        // 等待音频播放完成
        if (audioItem.isEnd) {
          // 如果是最后一条，等待播放完成
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (!isPlayingRef.current) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);

            // 设置超时
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 10000);
          });
        }
      } catch (error) {
        console.error("[ChatPage] ❌ 播放队列音频失败:", error);
        // 继续处理下一个音频
      }
    }

    // 队列处理完成
    isProcessingQueueRef.current = false;
    console.log("[ChatPage] ✅ 音频队列处理完成");
  };

  /**
   * 播放音频
   * @param audioUrl 音频URL
   * @param isFirst 是否是第一条音频
   * @param isEnd 是否是最后一条音频
   */
  const playAudio = async (
    audioUrl: string,
    isFirst: boolean,
    isEnd: boolean
  ): Promise<void> => {
    // 先处理URL和解锁（在Promise外部处理）
    let fullAudioUrl = audioUrl;
    if (!audioUrl.startsWith("http://") && !audioUrl.startsWith("https://")) {
      // 如果是相对路径，需要拼接API URL
      const apiConfigModule = await import("./services/apiConfig");
      const apiUrl = apiConfigModule.getFayApiUrl();
      if (audioUrl.startsWith("/")) {
        fullAudioUrl = `${apiUrl}${audioUrl}`;
      } else {
        fullAudioUrl = `${apiUrl}/${audioUrl}`;
      }
    }

    // 在Capacitor环境下，如果音频未解锁，先尝试解锁
    if (isCapacitor() && !audioUnlockedRef.current) {
      console.log("[ChatPage] ⚠️ Capacitor环境音频未解锁，尝试解锁...");
      try {
        const unlockAudio = new Audio();
        unlockAudio.volume = 0.01;
        unlockAudio.src =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        await unlockAudio.play();
        unlockAudio.pause();
        unlockAudio.src = "";
        audioUnlockedRef.current = true;
        console.log("[ChatPage] ✅ 音频已解锁");
      } catch (unlockError) {
        console.warn("[ChatPage] ⚠️ 音频解锁失败，继续尝试播放:", unlockError);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        console.log("[ChatPage] 🎵 准备播放音频:", {
          audioUrl: fullAudioUrl,
          isFirst,
          isEnd,
          isCapacitor: isCapacitor(),
        });

        // 如果已有音频在播放，先停止（这应该不会发生，因为队列已经处理了）
        if (audioPlayerRef.current && isPlayingRef.current) {
          console.log("[ChatPage] ⚠️ 警告：停止当前播放的音频（这不应该发生）");
          audioPlayerRef.current.pause();
          audioPlayerRef.current = null;
          isPlayingRef.current = false;
        }

        console.log("[ChatPage] 完整音频URL:", fullAudioUrl);

        // 在Capacitor环境下，如果音频未解锁，先尝试解锁（在Promise外部处理）

        // 创建新的音频元素
        const audio = new Audio();
        audioPlayerRef.current = audio;

        // 设置音频属性
        audio.volume = 1.0;
        audio.preload = "auto";
        audio.crossOrigin = "anonymous"; // 允许跨域（如果需要）

        // 设置音频事件
        setupAudioEvents(audio, isEnd, fullAudioUrl);

        // 先设置src，等待可以播放
        audio.src = fullAudioUrl;

        // 等待音频可以播放
        const canPlayHandler = () => {
          console.log("[ChatPage] 🔊 音频可以播放，准备播放");
          audio.removeEventListener("canplay", canPlayHandler);
          audio.removeEventListener("canplaythrough", canPlayHandler);

          // 在Capacitor环境下，确保音频已解锁
          if (isCapacitor() && !audioUnlockedRef.current) {
            console.warn(
              "[ChatPage] ⚠️ Capacitor环境下音频未解锁，尝试解锁..."
            );
            // 尝试解锁
            const unlockAudio = new Audio();
            unlockAudio.volume = 0.01;
            unlockAudio.src =
              "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
            unlockAudio
              .play()
              .then(() => {
                unlockAudio.pause();
                unlockAudio.src = "";
                audioUnlockedRef.current = true;
                console.log("[ChatPage] ✅ 音频已解锁，继续播放");
                // 继续播放实际音频
                tryPlayAudio();
              })
              .catch(() => {
                console.warn("[ChatPage] ⚠️ 音频解锁失败，但继续尝试播放");
                tryPlayAudio();
              });
          } else {
            tryPlayAudio();
          }
        };

        const tryPlayAudio = () => {
          console.log("[ChatPage] 🎵 尝试播放音频:", fullAudioUrl);
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("[ChatPage] ✅ 音频播放已启动");
                audioUnlockedRef.current = true; // 标记为已解锁
                resolve(); // 播放启动成功，resolve promise
              })
              .catch((error) => {
                console.error("[ChatPage] ❌ 播放音频失败:", error);
                console.error("[ChatPage] 错误详情:", {
                  name: error.name,
                  message: error.message,
                  code: audio.error?.code,
                  errorMessage: audio.error?.message,
                  readyState: audio.readyState,
                  networkState: audio.networkState,
                  src: audio.src,
                });

                // 在Capacitor环境下，尝试通过用户交互播放
                if (isCapacitor()) {
                  console.warn(
                    "[ChatPage] ⚠️ Capacitor环境下音频播放失败，等待用户交互..."
                  );

                  const tryPlayOnInteraction = (event?: Event) => {
                    if (event) {
                      event.preventDefault();
                      event.stopPropagation();
                    }

                    console.log("[ChatPage] 🔄 用户交互触发，重试播放音频");
                    audio
                      .play()
                      .then(() => {
                        console.log("[ChatPage] ✅ 用户交互后音频播放成功");
                        audioUnlockedRef.current = true;
                        document.removeEventListener(
                          "click",
                          tryPlayOnInteraction
                        );
                        document.removeEventListener(
                          "touchstart",
                          tryPlayOnInteraction
                        );
                        document.removeEventListener(
                          "touchend",
                          tryPlayOnInteraction
                        );
                        resolve(); // 播放成功，resolve promise
                      })
                      .catch((err) => {
                        console.error(
                          "[ChatPage] ❌ 用户交互后仍然播放失败:",
                          err
                        );
                        console.error("[ChatPage] 最终错误:", {
                          name: err.name,
                          message: err.message,
                          code: audio.error?.code,
                          errorMessage: audio.error?.message,
                        });
                        reject(err); // 播放失败，reject promise
                      });
                  };

                  // 监听用户交互
                  document.addEventListener("click", tryPlayOnInteraction, {
                    once: true,
                  });
                  document.addEventListener(
                    "touchstart",
                    tryPlayOnInteraction,
                    { once: true }
                  );
                  document.addEventListener("touchend", tryPlayOnInteraction, {
                    once: true,
                  });
                } else {
                  reject(error); // 非Capacitor环境，直接reject
                }
              });
          } else {
            resolve(); // 没有playPromise，直接resolve
          }
        };

        audio.addEventListener("canplay", canPlayHandler);
        audio.addEventListener("canplaythrough", canPlayHandler);

        // 如果音频已经可以播放，直接触发
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          console.log("[ChatPage] 音频已就绪，立即播放");
          canPlayHandler();
        }

        // 设置超时，如果加载时间过长，尝试直接播放
        setTimeout(() => {
          if (!isPlayingRef.current) {
            const readyState = audio.readyState;
            console.log("[ChatPage] 音频加载超时检查，readyState:", readyState);
            if (readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              console.log("[ChatPage] ⏰ 音频加载超时，但数据已就绪，尝试播放");
              tryPlayAudio();
            } else {
              console.warn(
                "[ChatPage] ⚠️ 音频加载超时，数据未就绪，readyState:",
                readyState
              );
              reject(new Error("音频加载超时")); // 超时失败，reject promise
            }
          }
        }, 3000);
      } catch (error) {
        console.error("[ChatPage] ❌ 创建音频播放器失败:", error);
        reject(error); // 捕获异常，reject promise
      }
    });
  };

  /**
   * 设置音频事件监听
   */
  const setupAudioEvents = (
    audio: HTMLAudioElement,
    isEnd: boolean,
    fullAudioUrl?: string
  ) => {
    // 设置音频属性
    audio.volume = 1.0; // 最大音量
    audio.preload = "auto";

    audio.onloadstart = () => {
      console.log("[ChatPage] 音频开始加载");
    };

    audio.oncanplay = () => {
      console.log("[ChatPage] 音频可以播放");
    };

    audio.onplay = () => {
      isPlayingRef.current = true;
      console.log("[ChatPage] ✅ 开始播放音频:", fullAudioUrl || "未知URL");
    };

    audio.onended = () => {
      isPlayingRef.current = false;
      console.log("[ChatPage] ✅ 音频播放完成");
      if (isEnd) {
        setIsDriving(false);
      }
      // 播放完成后，继续处理队列
      setTimeout(() => {
        processAudioQueue();
      }, 100);
    };

    audio.onerror = (error) => {
      isPlayingRef.current = false;
      console.error("[ChatPage] ❌ 音频播放失败:", error);
      console.error("[ChatPage] 音频错误详情:", {
        error: audio.error,
        code: audio.error?.code,
        message: audio.error?.message,
        url: fullAudioUrl,
      });
      if (isEnd) {
        setIsDriving(false);
      }
    };

    audio.onabort = () => {
      console.warn("[ChatPage] 音频加载被中止");
      isPlayingRef.current = false;
    };
  };

  // 解锁音频播放（Capacitor环境需要用户交互）
  useEffect(() => {
    if (isCapacitor() && !audioUnlockedRef.current) {
      console.log("[ChatPage] 检测到Capacitor环境，准备解锁音频播放");

      // 创建一个静音的音频元素来解锁播放权限
      const unlockAudio = () => {
        if (audioUnlockedRef.current) return;

        try {
          const unlockAudio = new Audio();
          unlockAudio.volume = 0.01; // 几乎静音
          unlockAudio.src =
            "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

          const playPromise = unlockAudio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("[ChatPage] ✅ 音频播放已解锁");
                audioUnlockedRef.current = true;
                unlockAudio.pause();
                unlockAudio.src = "";
              })
              .catch((error) => {
                console.warn(
                  "[ChatPage] ⚠️ 音频解锁失败，将在用户交互时重试:",
                  error
                );
              });
          }
        } catch (error) {
          console.warn("[ChatPage] ⚠️ 音频解锁异常:", error);
        }
      };

      // 在用户第一次交互时解锁
      const unlockOnInteraction = () => {
        unlockAudio();
        document.removeEventListener("click", unlockOnInteraction);
        document.removeEventListener("touchstart", unlockOnInteraction);
        document.removeEventListener("touchend", unlockOnInteraction);
      };

      document.addEventListener("click", unlockOnInteraction, { once: true });
      document.addEventListener("touchstart", unlockOnInteraction, {
        once: true,
      });
      document.addEventListener("touchend", unlockOnInteraction, {
        once: true,
      });
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isChatExpanded]);

  const handleSend = async () => {
    if (!input.trim() || !companion) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const userInput = input;
    setInput("");
    setIsDriving(true); // Start driving animation

    // 记录发送时间，用于后续获取音频
    const sendTime = Date.now();

    try {
      const history = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      const responseText = await chatWithCompanion(
        companion,
        history,
        userMsg.text
      );
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          text: responseText,
          timestamp: Date.now(),
        },
      ]);

      // 在Capacitor环境下，如果WebSocket未连接，尝试通过HTTP获取音频
      if (
        isCapacitor() &&
        (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      ) {
        console.log("[ChatPage] ⚠️ WebSocket未连接，尝试通过HTTP获取音频");
        // 等待一段时间让后端生成音频，然后尝试获取
        setTimeout(() => {
          tryGetAudioFromHttp(sendTime, responseText);
        }, 2000); // 等待2秒让TTS生成音频
      }
    } catch (error) {
      console.error("[ChatPage] 发送消息失败:", error);
    } finally {
      // 延迟停止动画，给音频播放时间
      setTimeout(() => setIsDriving(false), 5000);
    }
  };

  /**
   * 通过HTTP获取音频（WebSocket失败时的备选方案）
   * 通过轮询samples目录获取最新的音频文件
   */
  const tryGetAudioFromHttp = async (sendTime: number, text: string) => {
    try {
      const { getFayApiUrl } = await import("./services/apiConfig");
      const apiUrl = getFayApiUrl();

      console.log("[ChatPage] 🔄 开始通过HTTP获取音频，发送时间:", sendTime);

      // 轮询尝试获取音频（最多尝试10次，每次间隔500ms）
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 500;

      const pollForAudio = setInterval(async () => {
        attempts++;
        console.log(`[ChatPage] 尝试获取音频 (${attempts}/${maxAttempts})`);

        // 尝试访问可能的音频文件名（基于时间戳范围）
        // 音频文件通常在发送消息后1-5秒内生成
        const timeWindow = sendTime + attempts * pollInterval;
        const possibleAudioNames = [
          `sample-${timeWindow}.wav`,
          `sample-${timeWindow - 100}.wav`,
          `sample-${timeWindow - 200}.wav`,
          `sample-${timeWindow - 300}.wav`,
          `sample-${timeWindow - 400}.wav`,
        ];

        for (const audioName of possibleAudioNames) {
          const audioUrl = `${apiUrl}/audio/${audioName}`;

          try {
            // 使用HEAD请求检查文件是否存在（更快）
            const response = await fetch(audioUrl, {
              method: "HEAD",
              cache: "no-cache",
            });

            if (response.ok) {
              console.log("[ChatPage] ✅ 找到音频文件:", audioUrl);
              clearInterval(pollForAudio);

              // 播放音频
              playAudio(audioUrl, true, true).catch((error) => {
                console.error("[ChatPage] ❌ 播放HTTP获取的音频失败:", error);
              });
              return;
            }
          } catch (error) {
            // 继续尝试下一个文件名
            continue;
          }
        }

        // 如果达到最大尝试次数，停止轮询
        if (attempts >= maxAttempts) {
          clearInterval(pollForAudio);
          console.warn(
            "[ChatPage] ⚠️ 无法通过HTTP获取音频，可能WebSocket连接有问题或音频生成失败"
          );
        }
      }, pollInterval);
    } catch (error) {
      console.error("[ChatPage] ❌ 通过HTTP获取音频失败:", error);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      // 停止录音
      if (recognitionRef.current) {
        // Web Speech API
        (recognitionRef.current as any).stop();
        recognitionRef.current = null;
      } else {
        // 使用audioService停止录音
        try {
          const audioBlob = await audioService.stopRecording();
          if (audioBlob) {
            console.log(
              "[ChatPage] 录音停止，音频大小:",
              audioBlob.size,
              "bytes"
            );
            // 上传并识别音频
            try {
              const transcript = await audioService.uploadAndRecognize(
                audioBlob,
                companion?.name || "User"
              );
              if (transcript) {
                setInput(transcript);
                console.log("[ChatPage] 语音识别结果:", transcript);
              }
            } catch (error) {
              console.error("[ChatPage] 音频识别失败:", error);
              alert("语音识别失败，请重试或使用文字输入");
            }
          }
        } catch (error) {
          console.error("[ChatPage] 停止录音失败:", error);
        }
      }
      setIsListening(false);
    } else {
      // 开始录音
      const useCapacitorRecorder = isCapacitor();

      if (useCapacitorRecorder) {
        // Capacitor环境：使用audioService录音
        try {
          await audioService.startRecording();
          setIsListening(true);
          console.log("[ChatPage] 使用audioService开始录音（Capacitor环境）");
        } catch (error) {
          console.error("[ChatPage] 启动录音失败:", error);
          alert(
            `启动录音失败: ${
              error instanceof Error ? error.message : "未知错误"
            }`
          );
        }
      } else {
        // Web环境：优先尝试使用Web Speech API，失败则使用audioService
        const SpeechRecognition =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          // 使用Web Speech API
          const recognition = new SpeechRecognition();
          recognition.lang = "zh-CN";
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onstart = () => {
            setIsListening(true);
            console.log("[ChatPage] Web Speech API录音已开始");
          };

          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result) => result.transcript)
              .join("");
            setInput(transcript);
          };

          recognition.onend = () => {
            setIsListening(false);
            console.log("[ChatPage] Web Speech API录音已结束");
          };

          recognition.onerror = (event: any) => {
            console.error("[ChatPage] Web Speech API错误:", event.error);
            setIsListening(false);
            // Web Speech API失败时，回退到audioService
            if (
              event.error === "not-allowed" ||
              event.error === "service-not-allowed"
            ) {
              alert("麦克风权限被拒绝，请允许访问麦克风");
            } else {
              console.log(
                "[ChatPage] Web Speech API失败，尝试使用audioService"
              );
              audioService
                .startRecording()
                .then(() => {
                  setIsListening(true);
                })
                .catch((err) => {
                  alert(`启动录音失败: ${err.message}`);
                });
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } else {
          // 浏览器不支持Web Speech API，使用audioService
          try {
            await audioService.startRecording();
            setIsListening(true);
            console.log(
              "[ChatPage] 使用audioService开始录音（浏览器不支持Web Speech API）"
            );
          } catch (error) {
            console.error("[ChatPage] 启动录音失败:", error);
            alert(
              `启动录音失败: ${
                error instanceof Error ? error.message : "未知错误"
              }`
            );
          }
        }
      }
    }
  };

  if (!companion || !companion.isBound) {
    return (
      <PageContainer className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="mb-4 text-white/50">请先完成绑定流程</p>
        <Button onClick={() => navigate("/bind")}>前往绑定</Button>
      </PageContainer>
    );
  }

  // 检查是否有动画模型，如果没有，显示提示
  const hasAnimationModels = !!(
    companion.idleModelUrl || companion.talkingModelUrl
  );
  if (!hasAnimationModels && companion.model3dUrl) {
    console.warn("[ChatPage] ⚠️ 当前模型没有配置动画模型文件");
    console.warn("[ChatPage] ⚠️ 模型将显示但不会动");
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-[#ffeef5] via-[#fff5e6] to-[#ffe4cc] overflow-hidden">
      {/* 3D Scene Container - 固定尺寸的容器，确保模型稳定显示 */}
      <div className="fixed inset-0 z-0">
        <div className="w-full h-full">
          <AvatarScene
            modelUrl={(() => {
              // 优先使用导出的动画模型
              // 空闲时使用 idleModelUrl（空闲动画模型）
              // 说话时使用 talkingModelUrl（说话动画模型）
              // 如果没有动画模型，则回退到原始模型
              let url: string | undefined;

              if (isDriving) {
                // 说话时，优先使用 talkingModelUrl
                url =
                  companion.talkingModelUrl ||
                  companion.idleModelUrl ||
                  companion.model3dUrl;
              } else {
                // 空闲时，优先使用 idleModelUrl（包含空闲动画）
                url = companion.idleModelUrl || companion.model3dUrl;
              }

              // 调试日志
              const debugInfo = {
                isDriving,
                talkingModelUrl: companion.talkingModelUrl,
                idleModelUrl: companion.idleModelUrl,
                model3dUrl: companion.model3dUrl,
                selectedUrl: url,
                hasAnimationModels: !!(
                  companion.idleModelUrl || companion.talkingModelUrl
                ),
              };
              console.log(
                "[ChatPage] 📱 模型URL选择:",
                JSON.stringify(debugInfo, null, 2)
              );

              // 如果使用的是原始模型（没有动画），给出提示
              if (!companion.idleModelUrl && !companion.talkingModelUrl) {
                console.warn(
                  "[ChatPage] ⚠️ 警告：当前使用的模型没有动画数据！"
                );
                console.warn('[ChatPage] ⚠️ 请在"管理"页面配置动画模型文件');
                console.warn("[ChatPage] ⚠️ 或者完成绑骨流程并等待导出完成");
              }

              return url;
            })()}
            isTalking={isDriving}
          />
        </div>
      </div>

      {/* Header - 固定定位 */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-white/60 to-transparent backdrop-blur-md">
        <Button
          variant="ghost"
          className="rounded-full p-2 w-10 h-10 bg-white/60 hover:bg-white/80"
          onClick={() => navigate("/")}
        >
          <X size={20} />
        </Button>
        <div className="text-center">
          <h3 className="font-bold text-gray-700 drop-shadow-md">
            {companion.name}
          </h3>
          <div className="flex items-center gap-2 justify-center mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                isDriving ? "bg-green-500 animate-ping" : "bg-green-600"
              }`}
            ></span>
            <span className="text-[10px] text-gray-600 bg-white/70 px-2 rounded-full border border-pink-300/40">
              {isDriving ? "Driving Model..." : "Idle"}
            </span>
          </div>
        </div>
        <div className="w-10"></div>
      </div>

      {/* 控制按钮区域 - 固定在底部导航栏上方，确保始终可见 */}
      <div className="fixed left-0 right-0 bottom-[84px] z-30 flex justify-center items-center gap-4 p-4">
        {!isChatExpanded && (
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border border-pink-300/50 shadow-2xl transition-all duration-300 ${
              isListening
                ? "bg-red-400/80 animate-breath scale-105"
                : "bg-white/80 hover:bg-white/90"
            }`}
          >
            <Mic size={28} className="text-gray-700" />
          </button>
        )}
        <button
          onClick={() => setIsChatExpanded(!isChatExpanded)}
          className="px-4 py-2 bg-white/80 backdrop-blur-md rounded-full border border-pink-300/40 text-xs font-medium text-gray-700 hover:bg-white/90 transition-colors flex items-center gap-2 shadow-lg"
        >
          {isChatExpanded ? (
            <>
              <ChevronDown size={14} /> 收起对话
            </>
          ) : (
            <>
              <ChevronUp size={14} /> 展开文字对话
            </>
          )}
        </button>
      </div>

      {/* 聊天面板 - 使用固定定位，占据一半屏幕，半透明背景 */}
      <div
        className={`fixed left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-t border-pink-300/50 rounded-t-3xl flex flex-col transition-transform duration-300 ease-out shadow-2xl animate-fade-in-up ${
          isChatExpanded
            ? "bottom-[84px] h-[50vh]"
            : "bottom-0 translate-y-full"
        }`}
      >
        {/* 关闭按钮 - 在聊天面板顶部 */}
        {isChatExpanded && (
          <div className="flex-shrink-0 flex justify-center pt-3 pb-2">
            <button
              onClick={() => setIsChatExpanded(false)}
              className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full border border-pink-300/40 text-xs font-medium text-gray-700 hover:bg-white transition-colors flex items-center gap-2 shadow-md"
            >
              <ChevronDown size={14} /> 收起对话
            </button>
          </div>
        )}

        {/* 消息列表容器 - 固定高度，可滚动 */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        >
          {isLoadingHistory && (
            <div className="flex justify-center py-4">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <Cpu size={14} className="animate-spin" /> 加载历史消息...
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 backdrop-blur-sm ${
                  msg.role === "user"
                    ? "bg-primary/80 text-white rounded-tr-none"
                    : "bg-white/70 text-gray-700 rounded-tl-none"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {isDriving && (
            <div className="flex justify-start">
              <div className="bg-white/70 backdrop-blur-sm px-4 py-2 rounded-2xl rounded-tl-none text-xs text-gray-600 flex items-center gap-2">
                <Cpu size={12} className="animate-spin" /> 生成回复并驱动模型...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* 输入区域 - 固定在底部，半透明背景 */}
        <div className="flex-shrink-0 p-4 bg-white/90 backdrop-blur-sm border-t border-pink-300/50 flex gap-2 items-center shadow-lg">
          <Button
            variant="ghost"
            onClick={toggleListening}
            className={`p-2 rounded-full h-10 w-10 ${
              isListening ? "text-red-500" : ""
            }`}
          >
            <Mic size={20} />
          </Button>
          <input
            className="flex-1 bg-white/70 border border-pink-300/40 rounded-xl px-4 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/50"
            placeholder="发送消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-10 w-10 p-0 rounded-xl"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

const ManagePage: React.FC<{
  companions: Companion[];
  activeCompanion: Companion | null;
  switchCompanion: (id: string) => void;
  updateCompanion: (c: Partial<Companion>) => void;
  deleteCompanion: (id: string) => void;
}> = ({
  companions,
  activeCompanion,
  switchCompanion,
  updateCompanion,
  deleteCompanion,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [modelUrl, setModelUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [companionToDelete, setCompanionToDelete] = useState<string | null>(
    null
  );
  const idleFileInputRef = useRef<HTMLInputElement>(null);
  const talkingFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // 初始化API地址显示
  useEffect(() => {
    if (showApiConfigModal) {
      setApiUrl(APIConfig.getApiUrl());
      setConnectionStatus("idle");
      setConnectionMessage("");
    }
  }, [showApiConfigModal]);

  const handleUpdateModel = () => {
    if (activeCompanion) {
      updateCompanion({ model3dUrl: modelUrl });
      setShowModelModal(false);
    }
  };

  /**
   * 处理本地文件选择，创建 Blob URL 并更新到 companion
   * @param file 选择的文件
   * @param type 模型类型：'idle' 或 'talking'
   */
  const handleFileSelect = (file: File, type: "idle" | "talking") => {
    if (!activeCompanion) return;

    const blobUrl = URL.createObjectURL(file);
    console.log(
      `[ManagePage] 选择${type === "idle" ? "空闲" : "说话"}动画模型文件:`,
      file.name,
      "Blob URL:",
      blobUrl
    );

    if (type === "idle") {
      updateCompanion({ idleModelUrl: blobUrl });
    } else {
      updateCompanion({ talkingModelUrl: blobUrl });
    }

    // 如果两个模型都设置了，使用idle作为默认值
    if (type === "idle" && activeCompanion.talkingModelUrl) {
      updateCompanion({ model3dUrl: blobUrl });
    } else if (type === "talking" && activeCompanion.idleModelUrl) {
      // 如果只设置了talking，使用talking作为默认值
      if (!activeCompanion.idleModelUrl) {
        updateCompanion({ model3dUrl: blobUrl });
      }
    } else if (
      !activeCompanion.idleModelUrl &&
      !activeCompanion.talkingModelUrl
    ) {
      // 如果这是第一个设置的模型，使用它作为默认值
      updateCompanion({ model3dUrl: blobUrl });
    }
  };

  const confirmDelete = () => {
    if (companionToDelete) {
      deleteCompanion(companionToDelete);
      setShowDeleteModal(false);
      setCompanionToDelete(null);
    }
  };

  /**
   * 测试API连接
   */
  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      setConnectionStatus("error");
      setConnectionMessage("请输入API地址");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus("idle");
    setConnectionMessage("正在测试连接...");

    try {
      const isValid = await APIConfig.testConnection(apiUrl, 5000);
      if (isValid) {
        setConnectionStatus("success");
        setConnectionMessage("连接成功！");
      } else {
        setConnectionStatus("error");
        setConnectionMessage("连接失败，请检查地址是否正确或服务器是否运行");
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage(
        `连接错误: ${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  /**
   * 保存API配置
   */
  const handleSaveApiConfig = () => {
    if (!apiUrl.trim()) {
      setConnectionStatus("error");
      setConnectionMessage("请输入API地址");
      return;
    }

    try {
      APIConfig.setApiUrl(apiUrl.trim());
      setShowApiConfigModal(false);
      // 刷新页面以应用新配置（可选）
      window.location.reload();
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage(
        `保存失败: ${error instanceof Error ? error.message : "无效的地址格式"}`
      );
    }
  };

  return (
    <PageContainer>
      <h2 className="text-2xl font-bold mb-8">系统管理</h2>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white/80">人物列表</h3>
          <span className="text-xs text-white/40">
            {companions.length} 个模型已载入
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {companions.map((c) => (
            <div
              key={c.id}
              onClick={() => switchCompanion(c.id)}
              className={`relative p-3 rounded-xl border transition-all cursor-pointer ${
                c.id === activeCompanion?.id
                  ? "bg-primary/20 border-primary/50 ring-1 ring-primary/50"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={c.avatarUrl}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-[10px] text-white/50 truncate">{c.role}</p>
                  {/* 显示角色描述预览 */}
                  {c.characterDescription && (
                    <p className="text-[9px] text-white/40 truncate mt-0.5">
                      {c.characterDescription}
                    </p>
                  )}
                  {/* 显示角色属性标签 */}
                  {c.characterAttributes && (
                    <div className="flex gap-1 mt-1">
                      <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
                        {c.characterAttributes.job}
                      </span>
                      <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                        {c.characterAttributes.position}
                      </span>
                    </div>
                  )}
                  {/* 显示创建时间 */}
                  {c.createdAtStr && (
                    <p className="text-[8px] text-white/30 mt-1 truncate">
                      {c.createdAtStr}
                    </p>
                  )}
                </div>
              </div>
              {c.id === activeCompanion?.id && (
                <div className="absolute top-2 right-2 text-green-400">
                  <Check size={14} />
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => navigate("/create")}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors h-[74px]"
          >
            <Plus size={20} />
            <span className="text-xs">添加新人物</span>
          </button>
        </div>
      </div>
      {activeCompanion ? (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-secondary rounded-full"></span>
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">
              当前选中模型配置
            </h3>
          </div>
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-4 relative z-10">
              <img
                src={activeCompanion.avatarUrl}
                className="w-16 h-16 rounded-full object-cover shadow-lg"
              />
              <div>
                <h3 className="text-lg font-bold">{activeCompanion.name}</h3>
                <p className="text-sm text-white/50">{activeCompanion.role}</p>

                {/* 显示创建时间 */}
                {activeCompanion.createdAtStr && (
                  <p className="text-xs text-white/40 mt-1">
                    创建时间: {activeCompanion.createdAtStr}
                  </p>
                )}

                {/* 显示角色描述 */}
                {activeCompanion.characterDescription && (
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">
                    {activeCompanion.characterDescription}
                  </p>
                )}
              </div>
            </div>

            {/* 显示角色属性 */}
            {activeCompanion.characterAttributes && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400">
                    角色属性
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/60">姓名:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">性别:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.gender}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">年龄:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.age}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">职业:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.job}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">爱好:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.hobby}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">定位:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.position}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div>
                    <span className="text-white/60">性格特点:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.additional}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-white/60">目标使命:</span>{" "}
                    <span className="text-white/90">
                      {activeCompanion.characterAttributes.goal}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">3D Model Source</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    activeCompanion.model3dUrl
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {activeCompanion.model3dUrl
                    ? "Custom GLB Linked"
                    : "Default Procedural"}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => {
                setModelUrl(activeCompanion.model3dUrl || "");
                setShowModelModal(true);
              }}
              className="w-full glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <Box
                  size={20}
                  className="text-white/70 group-hover:text-secondary transition-colors"
                />
                <div>
                  <span className="block text-sm font-medium">
                    配置 3D 模型
                  </span>
                  <span className="block text-xs text-white/30">
                    绑定 .glb / .gltf 文件链接
                  </span>
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowAnimationModal(true)}
              className="w-full glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <Activity
                  size={20}
                  className="text-white/70 group-hover:text-secondary transition-colors"
                />
                <div className="flex-1">
                  <span className="block text-sm font-medium">
                    配置动画模型
                  </span>
                  <span className="block text-xs text-white/30">
                    绑定包含动画的模型文件（解决模型不动的问题）
                  </span>
                  {(activeCompanion.idleModelUrl ||
                    activeCompanion.talkingModelUrl) && (
                    <span className="block text-xs text-green-400 mt-1">
                      ✓ 已配置动画模型
                    </span>
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowApiConfigModal(true)}
              className="w-full glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <Server
                  size={20}
                  className="text-white/70 group-hover:text-secondary transition-colors"
                />
                <div className="flex-1">
                  <span className="block text-sm font-medium">
                    配置后端地址
                  </span>
                  <span className="block text-xs text-white/30">
                    设置后端服务器的IP地址和端口
                  </span>
                  <span className="block text-xs text-blue-400 mt-1">
                    {APIConfig.getApiUrl()}
                  </span>
                </div>
              </div>
            </button>
          </div>
          <Button
            variant="outline"
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 mt-8"
            onClick={() => {
              setCompanionToDelete(activeCompanion.id);
              setShowDeleteModal(true);
            }}
          >
            <Trash2 size={18} className="mr-2" />
            删除当前人物数据
          </Button>
        </div>
      ) : (
        <div className="text-center py-10 glass-panel rounded-2xl">
          <p className="text-white/50 mb-4">请选择或创建一个人物</p>
          <Link to="/create">
            <Button className="mx-auto">
              <UserPlus size={18} /> 创建新伙伴
            </Button>
          </Link>
        </div>
      )}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="确认删除?"
      >
        <p className="text-white/70 mb-6">
          这将永久删除该人物的所有记忆、设置与绑定关系。
        </p>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
            className="flex-1"
          >
            取消
          </Button>
          <Button
            onClick={confirmDelete}
            className="flex-1 bg-red-600 hover:bg-red-700 shadow-none"
          >
            确认删除
          </Button>
        </div>
      </Modal>
      <Modal
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        title="配置 3D 模型"
      >
        <div className="mb-6">
          <p className="text-sm text-white/60 mb-2">
            请输入 .glb / .gltf 模型的网络地址:
          </p>
          <Input
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            placeholder="https://.../model.glb"
          />
          <p className="text-xs text-white/30 mt-2 leading-relaxed">
            提示: 此设置将覆盖默认形象。每一个人物都可以绑定独立的 3D 模型文件。
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => setShowModelModal(false)}
            className="flex-1"
          >
            取消
          </Button>
          <Button onClick={handleUpdateModel} className="flex-1">
            保存配置
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showAnimationModal}
        onClose={() => setShowAnimationModal(false)}
        title="配置动画模型"
      >
        <div className="mb-6 space-y-4">
          <p className="text-sm text-white/60 mb-4">
            选择绑骨后下载的动画模型文件（.glb格式）:
          </p>

          {/* 空闲动画模型 */}
          <div>
            <label className="block text-sm text-white/80 mb-2">
              空闲动画模型 (Idle_Torch_Loop)
            </label>
            <div className="flex gap-2">
              <input
                ref={idleFileInputRef}
                type="file"
                accept=".glb"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file, "idle");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => idleFileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload size={16} className="mr-2" />
                选择空闲动画模型
              </Button>
              {activeCompanion?.idleModelUrl && (
                <span className="text-xs text-green-400 flex items-center">
                  ✓ 已设置
                </span>
              )}
            </div>
            {activeCompanion?.idleModelUrl && (
              <p className="text-xs text-white/40 mt-1">
                当前: {activeCompanion.idleModelUrl.substring(0, 50)}...
              </p>
            )}
          </div>

          {/* 说话动画模型 */}
          <div>
            <label className="block text-sm text-white/80 mb-2">
              说话动画模型 (Idle_Talking_Loop)
            </label>
            <div className="flex gap-2">
              <input
                ref={talkingFileInputRef}
                type="file"
                accept=".glb"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file, "talking");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => talkingFileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload size={16} className="mr-2" />
                选择说话动画模型
              </Button>
              {activeCompanion?.talkingModelUrl && (
                <span className="text-xs text-green-400 flex items-center">
                  ✓ 已设置
                </span>
              )}
            </div>
            {activeCompanion?.talkingModelUrl && (
              <p className="text-xs text-white/40 mt-1">
                当前: {activeCompanion.talkingModelUrl.substring(0, 50)}...
              </p>
            )}
          </div>

          <p className="text-xs text-white/30 mt-4 leading-relaxed">
            提示: 绑骨完成后，系统会自动下载两个动画模型文件到您的下载目录。
            文件名格式为:{" "}
            <code className="bg-white/10 px-1 rounded">idle_model_*.glb</code>{" "}
            和{" "}
            <code className="bg-white/10 px-1 rounded">
              talking_model_*.glb
            </code>
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => setShowAnimationModal(false)}
            className="flex-1"
          >
            关闭
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        title="配置后端地址"
      >
        <div className="mb-6 space-y-4">
          <div>
            <p className="text-sm text-white/60 mb-2">
              请输入后端服务器的地址:
            </p>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://192.168.1.100:5000 或 https://your-domain.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-white/30 mt-2 leading-relaxed">
              格式示例:
              <br />• 本地/局域网:{" "}
              <code className="bg-white/10 px-1 rounded">
                http://192.168.1.100:5000
              </code>
              <br />• 域名:{" "}
              <code className="bg-white/10 px-1 rounded">
                https://your-domain.com
              </code>
            </p>
          </div>

          {/* 连接状态显示 */}
          {connectionMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                connectionStatus === "success"
                  ? "bg-green-500/20 border border-green-500/30"
                  : connectionStatus === "error"
                  ? "bg-red-500/20 border border-red-500/30"
                  : "bg-blue-500/20 border border-blue-500/30"
              }`}
            >
              {connectionStatus === "success" && (
                <Wifi size={16} className="text-green-400" />
              )}
              {connectionStatus === "error" && (
                <WifiOff size={16} className="text-red-400" />
              )}
              {connectionStatus === "idle" && (
                <Server size={16} className="text-blue-400" />
              )}
              <span
                className={`text-sm ${
                  connectionStatus === "success"
                    ? "text-green-400"
                    : connectionStatus === "error"
                    ? "text-red-400"
                    : "text-blue-400"
                }`}
              >
                {connectionMessage}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => setShowApiConfigModal(false)}
            className="flex-1"
          >
            取消
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            isLoading={isTestingConnection}
            className="flex-1"
          >
            {isTestingConnection ? "测试中..." : "测试连接"}
          </Button>
          <Button
            onClick={handleSaveApiConfig}
            disabled={isTestingConnection || connectionStatus === "error"}
            className="flex-1"
          >
            保存
          </Button>
        </div>
      </Modal>
      <div className="mt-12 text-center">
        <p className="text-xs text-white/20">
          SoulLink - Virtual Companion System v2.1
        </p>
      </div>
    </PageContainer>
  );
};

export default App;
