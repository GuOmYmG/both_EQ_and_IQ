#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
人物属性自动生成脚本

根据用户描述的人物，调用大语言模型自动生成Fay项目所需的人物属性配置。
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

# 添加项目根目录到系统路径
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))

from simulation_engine.gpt_structure import gpt_request
from simulation_engine.settings import LLM_VERS
from utils import config_util as cfg


def generate_character_prompt(character_description: str) -> str:
    """
    生成用于LLM的人物属性生成提示词
    
    参数:
        character_description: 用户描述的人物信息
        
    返回:
        完整的提示词字符串
    """
    prompt = f"""你是一个人物属性生成助手。根据以下人物描述，生成符合Fay数字人项目配置格式的人物属性。

人物描述：
{character_description}

请根据描述生成以下属性（如果描述中没有明确信息，请根据人物特点合理推断）：
- name: 姓名（必填）
- gender: 性别（男/女，必填）
- age: 年龄（如：成年、18岁、25岁等，必填）
- birth: 出生地（如：北京、上海、Github等，必填）
- zodiac: 生肖（如：鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪，必填）
- constellation: 星座（如：白羊座、金牛座等，必填）
- job: 职业（如：程序员、教师、医生等，必填）
- hobby: 爱好（如：编程、阅读、运动等，必填）
- contact: 联系方式（如：邮箱、QQ等，可选）
- voice: 声音类型（如：abin、xiaoyun等，可选，如果没有则使用"abin"）
- position: 定位（从以下选项中选择：客服、陪伴、教培、娱乐、销售、助理，必填）
- goal: 目标/使命（如：工作协助、陪伴聊天等，必填）
- additional: 附加信息/性格特点（如：活泼、内向、专业等，必填）

请以JSON格式返回，格式如下：
{{
    "name": "姓名",
    "gender": "性别",
    "age": "年龄",
    "birth": "出生地",
    "zodiac": "生肖",
    "constellation": "星座",
    "job": "职业",
    "hobby": "爱好",
    "contact": "联系方式",
    "voice": "声音类型",
    "position": "定位",
    "goal": "目标",
    "additional": "附加信息"
}}

只返回JSON，不要包含其他文字说明。"""
    
    return prompt


def extract_json_from_response(response: str) -> Optional[Dict[str, Any]]:
    """
    从LLM响应中提取JSON数据
    
    参数:
        response: LLM返回的响应文本
        
    返回:
        解析后的JSON字典，如果解析失败返回None
    """
    # 尝试直接解析JSON
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass
    
    # 尝试提取代码块中的JSON
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # 尝试提取大括号中的内容
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    return None


def validate_character_attributes(attributes: Dict[str, Any]) -> Tuple[bool, str]:
    """
    验证人物属性是否完整和有效
    
    参数:
        attributes: 人物属性字典
        
    返回:
        (是否有效, 错误信息)
    """
    required_fields = ['name', 'gender', 'age', 'birth', 'zodiac', 'constellation', 
                      'job', 'hobby', 'position', 'goal', 'additional']
    
    missing_fields = [field for field in required_fields if field not in attributes or not attributes[field]]
    if missing_fields:
        return False, f"缺少必填字段: {', '.join(missing_fields)}"
    
    # 验证性别
    if attributes['gender'] not in ['男', '女']:
        return False, f"性别字段无效: {attributes['gender']}，应为'男'或'女'"
    
    # 验证定位
    valid_positions = ['客服', '陪伴', '教培', '娱乐', '销售', '助理']
    if attributes['position'] not in valid_positions:
        return False, f"定位字段无效: {attributes['position']}，应为: {', '.join(valid_positions)}"
    
    return True, ""


def update_config_json(attributes: Dict[str, Any], config_path: Optional[str] = None) -> bool:
    """
    更新config.json文件中的人物属性
    
    参数:
        attributes: 人物属性字典
        config_path: config.json文件路径，如果为None则使用项目根目录下的config.json
        
    返回:
        是否更新成功
    """
    if config_path is None:
        config_path = os.path.join(BASE_DIR, 'config.json')
    
    # 读取现有配置
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"错误: 配置文件不存在: {config_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"错误: 配置文件格式错误: {e}")
        return False
    
    # 更新属性
    if 'attribute' not in config:
        config['attribute'] = {}
    
    # 更新所有属性字段
    for key, value in attributes.items():
        config['attribute'][key] = value
    
    # 如果没有voice，设置默认值
    if 'voice' not in config['attribute'] or not config['attribute']['voice']:
        config['attribute']['voice'] = 'abin'
    
    # 保存配置
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        print(f"✓ 配置已成功更新到: {config_path}")
        return True
    except Exception as e:
        print(f"错误: 保存配置文件失败: {e}")
        return False


def generate_character(character_description: str, model: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    根据人物描述生成人物属性
    
    参数:
        character_description: 用户描述的人物信息
        model: 使用的LLM模型名称，如果为None则使用配置中的默认模型
        
    返回:
        生成的人物属性字典，如果生成失败返回None
    """
    # 优先使用新的服务函数
    try:
        from llm import llm_service
        attributes = llm_service.generate_character_attributes(character_description, model)
        if attributes:
            print(f"✓ 使用LLM服务成功生成人物属性")
            return attributes
    except ImportError:
        # 如果导入失败，使用原有逻辑
        pass
    except Exception as e:
        print(f"警告: 使用LLM服务失败，回退到原有逻辑: {e}")
    
    # 回退到原有实现
    if model is None:
        model = LLM_VERS or "gpt-4o"
    
    print(f"正在使用模型 {model} 生成人物属性...")
    print(f"人物描述: {character_description}\n")
    
    # 生成提示词
    prompt = generate_character_prompt(character_description)
    
    # 调用LLM
    try:
        response = gpt_request(prompt, model=model, max_tokens=2000)
        print(f"LLM响应:\n{response}\n")
    except Exception as e:
        print(f"错误: 调用LLM失败: {e}")
        return None
    
    # 提取JSON
    attributes = extract_json_from_response(response)
    if attributes is None:
        print("错误: 无法从LLM响应中提取有效的JSON数据")
        print("请检查LLM返回的内容是否符合JSON格式")
        return None
    
    # 验证属性
    is_valid, error_msg = validate_character_attributes(attributes)
    if not is_valid:
        print(f"错误: 属性验证失败 - {error_msg}")
        return None
    
    return attributes


def main():
    """
    主函数：交互式生成人物属性
    """
    print("=" * 60)
    print("Fay 人物属性自动生成工具")
    print("=" * 60)
    print()
    
    # 确保配置已加载
    cfg.load_config()
    
    # 获取人物描述
    print("请输入要创建的人物描述（例如：一个25岁的女性程序员，来自北京，喜欢编程和阅读）")
    print("或者输入 'q' 退出")
    print()
    
    character_description = input("人物描述: ").strip()
    
    if character_description.lower() in ['q', 'quit', 'exit', '退出']:
        print("已退出")
        return
    
    if not character_description:
        print("错误: 人物描述不能为空")
        return
    
    # 生成人物属性
    attributes = generate_character(character_description)
    
    if attributes is None:
        print("\n人物属性生成失败，请检查错误信息后重试")
        return
    
    # 显示生成的属性
    print("\n" + "=" * 60)
    print("生成的人物属性:")
    print("=" * 60)
    for key, value in attributes.items():
        print(f"  {key}: {value}")
    print()
    
    # 询问是否更新配置
    confirm = input("是否更新 config.json 文件? (y/n): ").strip().lower()
    if confirm in ['y', 'yes', '是', 'Y']:
        success = update_config_json(attributes)
        if success:
            print("\n✓ 人物属性已成功更新到配置文件！")
        else:
            print("\n✗ 更新配置文件失败")
    else:
        print("\n已取消更新配置文件")
        print("\n生成的属性JSON:")
        print(json.dumps(attributes, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

