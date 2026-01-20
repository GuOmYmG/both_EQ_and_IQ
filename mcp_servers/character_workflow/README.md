# 角色生成工作流 MCP 服务器

实现用户说"我想和孔子对话"的完整工作流：
1. ASR识别语音为文字（Fay已有）
2. LLM分析意图："生成一个孔子的全身图像"
3. 调用图像生成工具生成图像
4. 调用3D模型生成工具生成3D模型
5. 返回结果给用户

## 功能特点

- **自动意图识别**：Fay的LLM自动分析用户意图并调用相应工具
- **多步骤工作流**：支持图像生成 -> 3D模型生成的链式调用
- **灵活配置**：支持多种图像生成API和3D生成API

## 安装配置

### 1. 安装依赖

```bash
pip install mcp requests
```

### 2. 配置API密钥（可选）

在环境变量中设置：

```bash
# 图像生成API（选择一种）
export STABLE_DIFFUSION_API_URL="http://localhost:7860"  # 本地Stable Diffusion
export OPENAI_API_KEY="sk-..."  # 或使用DALL-E

# 3D模型生成API（选择一种）
export TRIPO_API_KEY="..."  # Tripo AI
export LOCAL_3D_API_URL="http://localhost:8000"  # 本地3D生成服务
```

### 3. 在Fay中注册MCP服务器

在Fay的MCP管理界面添加：

- **名称**: 角色生成工作流
- **类型**: STDIO（本地）
- **命令**: python
- **参数**: server.py
- **工作目录**: mcp_servers/character_workflow

## 使用方式

### 通过Fay语音/文字交互

用户说：
- "我想和孔子对话"
- "生成一个孔子的3D模型"
- "创建一个诸葛亮的虚拟形象"

Fay会自动：
1. 识别意图
2. 调用 `generate_character_image` 生成图像
3. 调用 `generate_3d_model` 生成3D模型
4. 返回结果

### 工作流示例

```
用户: "我想和孔子对话"
  ↓
Fay LLM分析: "用户想要创建一个孔子的虚拟角色，需要先生成图像，再生成3D模型"
  ↓
调用工具1: generate_character_image({"character_name": "孔子"})
  → 返回: {"image_path": "/path/to/confucius.png"}
  ↓
调用工具2: generate_3d_model({"image_path": "/path/to/confucius.png", "character_name": "孔子"})
  → 返回: {"model_path": "/path/to/confucius.glb"}
  ↓
Fay回复用户: "已为您创建孔子的3D模型，模型文件位于..."
```

## 工具说明

### generate_character_image

生成角色全身图像

**参数**：
- `character_name` (必需): 角色名称，如"孔子"、"李白"
- `description` (可选): 详细描述
- `style` (可选): 图像风格，realistic/anime/3d

**返回**：
- `image_url`: 图像URL
- `image_path`: 本地图像路径
- `character_name`: 角色名称

### generate_3d_model

根据图像生成3D模型

**参数**：
- `image_path` (必需): 图像路径或URL
- `character_name` (必需): 角色名称
- `model_format` (可选): 模型格式，glb/gltf/fbx

**返回**：
- `model_path`: 本地模型路径
- `model_url`: 模型访问URL
- `format`: 模型格式

## 自定义实现

### 使用自己的图像生成API

修改 `workflow_tools/character_workflow.py` 中的 `_call_image_generation_api` 函数：

```python
def _call_image_generation_api(prompt: str) -> Optional[str]:
    # 调用你的API
    response = requests.post("你的API地址", json={"prompt": prompt})
    return response.json()["image_url"]
```

### 使用自己的3D生成API

修改 `_call_3d_generation_api` 函数：

```python
def _call_3d_generation_api(image_path: str, character_name: str, model_format: str) -> Optional[str]:
    # 调用你的API
    with open(image_path, "rb") as f:
        response = requests.post("你的API地址", files={"image": f})
    return response.json()["model_path"]
```

## 注意事项

1. **API密钥安全**：不要将API密钥提交到代码仓库，使用环境变量
2. **超时设置**：3D模型生成可能需要较长时间，确保超时设置足够
3. **文件存储**：生成的图像和模型保存在 `cache_data/` 目录下
4. **错误处理**：如果某个步骤失败，工作流会返回错误信息

## 故障排查

1. **工具未显示**：检查MCP服务器是否正常启动
2. **API调用失败**：检查API密钥和网络连接
3. **生成失败**：查看Fay日志中的错误信息

