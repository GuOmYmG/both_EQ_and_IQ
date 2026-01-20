import React from 'react';

export interface Companion {
  id: string;
  name: string;
  role: string; // e.g., Friend, Mentor, Partner
  personality: string;
  avatarUrl: string;
  isBound: boolean;
  userNickname?: string;
  createdAt: number;
  createdAtStr?: string;  // 格式化后的创建时间字符串
  // Added visualPrompt to interface as it is returned by the generation service
  visualPrompt?: string;
  // URL for 3D model (glb/gltf/fbx)
  model3dUrl?: string;
  // URLs for 3D models with specific animations (绑骨后导出的模型)
  idleModelUrl?: string; // 包含 Idle_Torch_Loop 动画的模型
  talkingModelUrl?: string; // 包含 Idle_Talking_Loop 动画的模型
  
  // 角色描述增强功能
  characterDescription?: string; // 用户输入的原始描述
  characterAttributes?: CharacterAttributes; // 生成的角色属性
  
  // 后端模型管理相关字段
  model_id?: string; // 后端模型ID，用于与后端模型系统对接
  is_global?: boolean; // 是否为全局模型
}

// 角色属性接口（基于generate_character.py的实现）
export interface CharacterAttributes {
  name: string;
  gender: string; // 男/女
  age: string;
  birth: string;
  zodiac: string;
  constellation: string;
  job: string;
  hobby: string;
  contact?: string;
  voice?: string;
  position: string; // 客服、陪伴、教培、娱乐、销售、助理
  goal: string;
  additional: string; // 性格特点
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}