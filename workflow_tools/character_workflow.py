#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
角色生成工作流工具
实现：用户说"我想和孔子对话" -> 生成图像 -> 生成3D模型
"""

import os
import json
import time
import requests
import base64
from typing import Dict, Any, Tuple, Optional
from utils import util

# ============================================================================
# 工具1: 生成角色全身图像
# ============================================================================

def generate_character_image_executor(args: Dict[str, Any], attempt: int) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    生成角色全身图像
    
    参数:
        args: {
            "character_name": "孔子",  # 角色名称
            "description": "古代哲学家，穿着传统汉服",  # 可选描述
            "style": "realistic"  # 可选：realistic, anime, 3d
        }
    
    返回:
        (success, output, error)
        output: 图像文件的base64编码或URL
    """
    try:
        character_name = args.get("character_name", "")
        description = args.get("description", "")
        style = args.get("style", "realistic")
        
        if not character_name:
            return False, None, "缺少角色名称参数"
        
        util.log(1, f"[工作流] 开始生成角色图像: {character_name}")
        
        # 方案1: 调用图像生成API（例如Stable Diffusion、DALL-E等）
        # 这里使用示例，你需要替换为实际的API调用
        prompt = f"full body portrait of {character_name}, {description}, high quality, detailed, {style} style"
        
        # 示例：调用本地或远程图像生成服务
        # 你可以替换为：
        # - Stable Diffusion API
        # - DALL-E API
        # - Midjourney API
        # - 或其他图像生成服务
        
        image_url = _call_image_generation_api(prompt)
        
        if image_url:
            # 保存图像到本地
            image_path = _save_image_from_url(image_url, character_name)
            util.log(1, f"[工作流] 图像生成成功: {image_path}")
            return True, json.dumps({
                "image_url": image_url,
                "image_path": image_path,
                "character_name": character_name
            }), None
        else:
            return False, None, "图像生成API调用失败"
            
    except Exception as e:
        util.log(1, f"[工作流] 生成图像异常: {e}")
        return False, None, str(e)


def _call_image_generation_api(prompt: str) -> Optional[str]:
    """
    调用图像生成API
    
    这里提供几种实现方案：
    1. Stable Diffusion (本地或API)
    2. DALL-E (OpenAI)
    3. Midjourney
    4. 其他服务
    """
    # 方案1: 使用Stable Diffusion API示例
    try:
        # 替换为你的Stable Diffusion API地址
        sd_api_url = os.getenv("STABLE_DIFFUSION_API_URL", "http://localhost:7860")
        
        response = requests.post(
            f"{sd_api_url}/sdapi/v1/txt2img",
            json={
                "prompt": prompt,
                "negative_prompt": "blurry, low quality, distorted",
                "steps": 20,
                "width": 512,
                "height": 768,  # 全身像建议768高度
                "cfg_scale": 7
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            # 返回base64编码的图像
            if result.get("images"):
                return result["images"][0]  # base64编码
            return None
    except Exception as e:
        util.log(1, f"Stable Diffusion API调用失败: {e}")
    
    # 方案2: 使用DALL-E API示例
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            response = requests.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "size": "1024x1792",  # 全身像尺寸
                    "quality": "hd",
                    "n": 1
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("data") and len(result["data"]) > 0:
                    return result["data"][0]["url"]
    except Exception as e:
        util.log(1, f"DALL-E API调用失败: {e}")
    
    # 如果都失败，返回None
    return None


def _save_image_from_url(image_data: str, character_name: str) -> str:
    """
    保存图像到本地
    """
    try:
        # 创建保存目录
        save_dir = os.path.join("cache_data", "character_images")
        os.makedirs(save_dir, exist_ok=True)
        
        # 如果是base64编码
        if image_data.startswith("data:image") or len(image_data) > 100:
            # 提取base64数据
            if "," in image_data:
                image_data = image_data.split(",")[1]
            
            image_bytes = base64.b64decode(image_data)
            file_path = os.path.join(save_dir, f"{character_name}_{int(time.time())}.png")
            
            with open(file_path, "wb") as f:
                f.write(image_bytes)
            
            return file_path
        else:
            # 如果是URL，下载图像
            response = requests.get(image_data, timeout=30)
            if response.status_code == 200:
                file_path = os.path.join(save_dir, f"{character_name}_{int(time.time())}.png")
                with open(file_path, "wb") as f:
                    f.write(response.content)
                return file_path
    except Exception as e:
        util.log(1, f"保存图像失败: {e}")
    
    return ""


# ============================================================================
# 工具2: 根据图像生成3D模型
# ============================================================================

def generate_3d_model_executor(args: Dict[str, Any], attempt: int) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    根据图像生成3D模型
    
    参数:
        args: {
            "image_path": "/path/to/image.png",  # 或 image_url
            "character_name": "孔子",
            "model_format": "glb"  # glb, gltf, fbx
        }
    
    返回:
        (success, output, error)
        output: 3D模型文件路径或URL
    """
    try:
        image_path = args.get("image_path") or args.get("image_url")
        character_name = args.get("character_name", "character")
        model_format = args.get("model_format", "glb")
        
        if not image_path:
            return False, None, "缺少图像路径参数"
        
        util.log(1, f"[工作流] 开始生成3D模型: {character_name}")
        
        # 方案1: 调用3D模型生成API
        # 可以使用：
        # - Tripo AI API
        # - Luma AI API
        # - CSM (Character Studio Model) API
        # - 或其他3D生成服务
        
        model_path = _call_3d_generation_api(image_path, character_name, model_format)
        
        if model_path:
            util.log(1, f"[工作流] 3D模型生成成功: {model_path}")
            return True, json.dumps({
                "model_path": model_path,
                "model_url": f"/models/{os.path.basename(model_path)}",
                "character_name": character_name,
                "format": model_format
            }), None
        else:
            return False, None, "3D模型生成API调用失败"
            
    except Exception as e:
        util.log(1, f"[工作流] 生成3D模型异常: {e}")
        return False, None, str(e)


def _call_3d_generation_api(image_path: str, character_name: str, model_format: str) -> Optional[str]:
    """
    调用3D模型生成API
    """
    try:
        # 方案1: 使用Tripo AI API示例
        tripo_api_key = os.getenv("TRIPO_API_KEY")
        if tripo_api_key:
            # 上传图像
            with open(image_path, "rb") as f:
                files = {"image": f}
                data = {
                    "model_format": model_format,
                    "character_name": character_name
                }
                response = requests.post(
                    "https://api.tripo3d.ai/v1/models/generate",
                    headers={"Authorization": f"Bearer {tripo_api_key}"},
                    files=files,
                    data=data,
                    timeout=300  # 3D生成可能需要较长时间
                )
                
                if response.status_code == 200:
                    result = response.json()
                    model_url = result.get("model_url")
                    if model_url:
                        # 下载模型到本地
                        return _download_3d_model(model_url, character_name, model_format)
        
        # 方案2: 使用本地3D生成服务（如果有）
        local_3d_api = os.getenv("LOCAL_3D_API_URL", "http://localhost:8000")
        try:
            with open(image_path, "rb") as f:
                files = {"image": f}
                response = requests.post(
                    f"{local_3d_api}/generate",
                    files=files,
                    json={"format": model_format},
                    timeout=300
                )
                
                if response.status_code == 200:
                    result = response.json()
                    model_path = result.get("model_path")
                    if model_path:
                        return model_path
        except Exception as e:
            util.log(1, f"本地3D API调用失败: {e}")
        
        # 如果都失败，返回None
        return None
        
    except Exception as e:
        util.log(1, f"3D模型生成API调用失败: {e}")
        return None


def _download_3d_model(model_url: str, character_name: str, model_format: str) -> str:
    """
    下载3D模型到本地
    """
    try:
        save_dir = os.path.join("cache_data", "character_models")
        os.makedirs(save_dir, exist_ok=True)
        
        response = requests.get(model_url, timeout=300)
        if response.status_code == 200:
            file_path = os.path.join(save_dir, f"{character_name}_{int(time.time())}.{model_format}")
            with open(file_path, "wb") as f:
                f.write(response.content)
            return file_path
    except Exception as e:
        util.log(1, f"下载3D模型失败: {e}")
    
    return ""


# ============================================================================
# 工具定义（用于注册到Fay工作流系统）
# ============================================================================

CHARACTER_IMAGE_TOOL = {
    "name": "generate_character_image",
    "description": "根据角色名称和描述生成全身图像。用于创建虚拟角色的视觉形象。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "character_name": {
                "type": "string",
                "description": "角色名称，例如：孔子、李白、诸葛亮等"
            },
            "description": {
                "type": "string",
                "description": "可选的详细描述，例如：古代哲学家，穿着传统汉服，手持竹简"
            },
            "style": {
                "type": "string",
                "enum": ["realistic", "anime", "3d"],
                "description": "图像风格：realistic(写实), anime(动漫), 3d(3D风格)",
                "default": "realistic"
            }
        },
        "required": ["character_name"]
    }
}

CHARACTER_3D_TOOL = {
    "name": "generate_3d_model",
    "description": "根据角色图像生成3D模型文件（GLB/GLTF格式）。用于在3D场景中展示角色。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "image_path": {
                "type": "string",
                "description": "角色图像的本地路径或URL"
            },
            "image_url": {
                "type": "string",
                "description": "角色图像的URL（如果image_path未提供）"
            },
            "character_name": {
                "type": "string",
                "description": "角色名称"
            },
            "model_format": {
                "type": "string",
                "enum": ["glb", "gltf", "fbx"],
                "description": "3D模型格式",
                "default": "glb"
            }
        },
        "required": ["image_path", "character_name"]
    }
}


# ============================================================================
# 工具注册函数（供Fay工作流系统调用）
# ============================================================================

def register_character_workflow_tools():
    """
    注册角色生成工作流工具到Fay系统
    
    使用方式：
    1. 在Fay的MCP服务中注册这些工具
    2. 或者在nlp_cognitive_stream.py中直接注册
    """
    from llm.nlp_cognitive_stream import WorkflowToolSpec
    
    tools = []
    
    # 注册图像生成工具
    tools.append(WorkflowToolSpec(
        name=CHARACTER_IMAGE_TOOL["name"],
        description=CHARACTER_IMAGE_TOOL["description"],
        schema=CHARACTER_IMAGE_TOOL["inputSchema"],
        executor=generate_character_image_executor,
        example_args={"character_name": "孔子", "description": "古代哲学家"}
    ))
    
    # 注册3D模型生成工具
    tools.append(WorkflowToolSpec(
        name=CHARACTER_3D_TOOL["name"],
        description=CHARACTER_3D_TOOL["description"],
        schema=CHARACTER_3D_TOOL["inputSchema"],
        executor=generate_3d_model_executor,
        example_args={"image_path": "/path/to/image.png", "character_name": "孔子"}
    ))
    
    return tools


# ============================================================================
# MCP服务器实现（可选：作为独立MCP服务运行）
# ============================================================================

if __name__ == "__main__":
    # 可以作为独立的MCP服务器运行
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    print("角色生成工作流工具已加载")
    print("工具列表：")
    print("1. generate_character_image - 生成角色图像")
    print("2. generate_3d_model - 生成3D模型")

