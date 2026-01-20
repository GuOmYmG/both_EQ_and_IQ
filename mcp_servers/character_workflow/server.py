#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
角色生成工作流 MCP 服务器
实现：用户说"我想和孔子对话" -> 生成图像 -> 生成3D模型
"""

import asyncio
import json
import sys
import os
from typing import Any, Dict, List

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from workflow_tools.character_workflow import (
    generate_character_image_executor,
    generate_3d_model_executor,
    CHARACTER_IMAGE_TOOL,
    CHARACTER_3D_TOOL
)

# 创建MCP服务器实例
server = Server("character-workflow")


@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    """
    返回可用工具列表
    """
    return [
        Tool(
            name=CHARACTER_IMAGE_TOOL["name"],
            description=CHARACTER_IMAGE_TOOL["description"],
            inputSchema=CHARACTER_IMAGE_TOOL["inputSchema"]
        ),
        Tool(
            name=CHARACTER_3D_TOOL["name"],
            description=CHARACTER_3D_TOOL["description"],
            inputSchema=CHARACTER_3D_TOOL["inputSchema"]
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """
    执行工具调用
    """
    try:
        if name == CHARACTER_IMAGE_TOOL["name"]:
            success, output, error = generate_character_image_executor(arguments, 0)
            if success:
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "success": True,
                        "result": json.loads(output) if output else {},
                        "message": "角色图像生成成功"
                    }, ensure_ascii=False)
                )]
            else:
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "success": False,
                        "error": error or "未知错误"
                    }, ensure_ascii=False)
                )]
        
        elif name == CHARACTER_3D_TOOL["name"]:
            success, output, error = generate_3d_model_executor(arguments, 0)
            if success:
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "success": True,
                        "result": json.loads(output) if output else {},
                        "message": "3D模型生成成功"
                    }, ensure_ascii=False)
                )]
            else:
                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "success": False,
                        "error": error or "未知错误"
                    }, ensure_ascii=False)
                )]
        
        else:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": False,
                    "error": f"未知工具: {name}"
                }, ensure_ascii=False)
            )]
    
    except Exception as e:
        return [TextContent(
            type="text",
            text=json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)
        )]


async def main():
    """
    启动MCP服务器
    """
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())

