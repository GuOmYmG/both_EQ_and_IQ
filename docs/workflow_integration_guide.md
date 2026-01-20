# Fay工作流集成指南：角色生成工作流

## 核心判断

✅ **Fay完全支持工作流系统**，你的需求可以完美实现。

## 工作流架构

Fay使用 **LangGraph** 构建工作流，支持：
- **自动意图识别**：LLM分析用户意图
- **工具链式调用**：支持多步骤工具调用
- **状态管理**：跟踪工作流执行状态
- **错误处理**：自动重试和错误恢复

## 你的工作流实现

### 流程设计

```
用户语音: "我想和孔子对话"
    ↓
[Fay ASR] 识别为文字: "我想和孔子对话"
    ↓
[Fay LLM] 分析意图: 
  - 识别关键词："孔子"、"对话"
  - 推断意图："用户想要创建一个孔子的虚拟角色"
  - 规划步骤：
    1. 生成孔子全身图像
    2. 根据图像生成3D模型
    ↓
[工具1] generate_character_image({"character_name": "孔子"})
  → 返回: {"image_path": "/path/to/confucius.png"}
    ↓
[工具2] generate_3d_model({
    "image_path": "/path/to/confucius.png",
    "character_name": "孔子"
  })
  → 返回: {"model_path": "/path/to/confucius.glb"}
    ↓
[Fay回复] "已为您创建孔子的3D模型，可以开始对话了"
```

## 快速开始

### 步骤1: 安装依赖

```bash
cd mcp_servers/character_workflow
pip install mcp requests
```

### 步骤2: 配置API（可选）

如果你有图像生成和3D生成API，设置环境变量：

```bash
# Windows
set STABLE_DIFFUSION_API_URL=http://localhost:7860
set OPENAI_API_KEY=sk-...

# Linux/Mac
export STABLE_DIFFUSION_API_URL=http://localhost:7860
export OPENAI_API_KEY=sk-...
```

### 步骤3: 在Fay中注册MCP服务器

1. 启动Fay：`python main.py`
2. 访问MCP管理界面（通常在Web界面）
3. 添加新MCP服务器：
   - **名称**: 角色生成工作流
   - **类型**: STDIO（本地）
   - **命令**: python
   - **参数**: server.py
   - **工作目录**: `mcp_servers/character_workflow`

### 步骤4: 测试工作流

通过Fay的语音或文字接口说：
- "我想和孔子对话"
- "生成一个诸葛亮的3D模型"
- "创建一个李白的虚拟形象"

Fay会自动识别意图并调用工具链。

## 工作原理

### 1. 意图识别（自动）

Fay的LLM会自动分析用户输入：

```python
# 用户输入: "我想和孔子对话"
# LLM分析结果:
{
  "intent": "create_character",
  "character_name": "孔子",
  "required_tools": [
    "generate_character_image",
    "generate_3d_model"
  ]
}
```

### 2. 工具注册

工具通过MCP协议注册到Fay：

```python
# 工具定义
{
  "name": "generate_character_image",
  "description": "根据角色名称生成全身图像",
  "inputSchema": {
    "properties": {
      "character_name": {"type": "string"}
    }
  }
}
```

### 3. 工作流执行

Fay的规划器（Planner）自动决定调用顺序：

```python
# 规划器决策
{
  "action": "tool",
  "tool": "generate_character_image",
  "args": {"character_name": "孔子"}
}

# 执行后，规划器继续
{
  "action": "tool",
  "tool": "generate_3d_model",
  "args": {
    "image_path": "/path/to/confucius.png",
    "character_name": "孔子"
  }
}
```

## 自定义实现

### 方案A: 使用现有API

如果你有现成的图像生成和3D生成API，只需修改：

```python
# workflow_tools/character_workflow.py

def _call_image_generation_api(prompt: str):
    # 替换为你的API调用
    response = requests.post(
        "你的图像生成API地址",
        json={"prompt": prompt}
    )
    return response.json()["image_url"]

def _call_3d_generation_api(image_path: str, character_name: str, model_format: str):
    # 替换为你的API调用
    with open(image_path, "rb") as f:
        response = requests.post(
            "你的3D生成API地址",
            files={"image": f}
        )
    return response.json()["model_path"]
```

### 方案B: 本地服务

如果你有本地运行的Stable Diffusion或3D生成服务：

```python
# 本地Stable Diffusion
STABLE_DIFFUSION_API_URL = "http://localhost:7860"

# 本地3D生成服务
LOCAL_3D_API_URL = "http://localhost:8000"
```

### 方案C: 模拟实现（测试用）

如果暂时没有API，可以使用模拟实现：

```python
def _call_image_generation_api(prompt: str):
    # 模拟返回一个占位图像
    return "https://via.placeholder.com/512x768"

def _call_3d_generation_api(image_path: str, character_name: str, model_format: str):
    # 模拟返回一个占位模型路径
    return f"cache_data/character_models/{character_name}.{model_format}"
```

## 高级配置

### 自定义提示词模板

修改LLM的系统提示词，让Fay更好地理解角色生成需求：

```python
# 在Fay配置中添加
system_prompt = """
你是一个智能助手，可以帮助用户创建虚拟角色。
当用户说"我想和XX对话"时，你需要：
1. 识别角色名称
2. 调用generate_character_image生成图像
3. 调用generate_3d_model生成3D模型
4. 返回结果给用户
"""
```

### 工作流扩展

可以添加更多工具：

```python
# 添加语音生成工具
def generate_character_voice_executor(args, attempt):
    # 生成角色语音
    pass

# 添加动画绑定工具
def bind_character_animation_executor(args, attempt):
    # 绑定角色动画
    pass
```

## 故障排查

### 问题1: 工具未显示

**原因**: MCP服务器未正确启动

**解决**:
1. 检查MCP服务器配置是否正确
2. 查看Fay日志中的错误信息
3. 手动测试MCP服务器：`python mcp_servers/character_workflow/server.py`

### 问题2: 工作流不执行

**原因**: LLM未识别到意图

**解决**:
1. 在系统提示词中明确说明角色生成流程
2. 使用更明确的用户输入，如"生成一个孔子的3D模型"
3. 查看Fay的规划器日志

### 问题3: API调用失败

**原因**: API密钥或网络问题

**解决**:
1. 检查环境变量中的API密钥
2. 测试API连接：`curl -X POST "你的API地址"`
3. 查看错误日志中的详细信息

## 最佳实践

1. **错误处理**: 每个工具都应该有完善的错误处理
2. **超时设置**: 3D生成可能需要较长时间，设置合理的超时
3. **缓存机制**: 相同角色的图像和模型可以缓存复用
4. **进度反馈**: 长时间操作应该给用户反馈

## 总结

Fay的工作流系统完全支持你的需求：
- ✅ ASR识别（已有）
- ✅ 意图识别（LLM自动）
- ✅ 工具链式调用（支持）
- ✅ 多步骤工作流（支持）

只需要：
1. 实现图像生成和3D生成工具
2. 注册到Fay的MCP系统
3. 让Fay的LLM自动规划和执行

**这就是"好品味"的实现方式：让特殊情况消失，变成正常情况。**

