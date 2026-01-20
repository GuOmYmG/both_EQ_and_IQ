# -*- coding: utf-8 -*-
import importlib
import json
import time
import os
import pyaudio
import re
from flask import Flask, render_template, request, jsonify, Response, send_file
from flask_cors import CORS
import requests
import datetime
import pytz
import logging
import uuid

import fay_booter
from tts import tts_voice
from gevent import pywsgi
try:
    # Use gevent.sleep to avoid blocking the gevent loop; fallback to time.sleep if unavailable
    from gevent import sleep as gsleep
except Exception:
    from time import sleep as gsleep
from scheduler.thread_manager import MyThread
from utils import config_util, util
from core import wsa_server
from core import fay_core
from core import content_db
from core.interact import Interact
from core import member_db
import fay_booter
from flask_httpauth import HTTPBasicAuth
from core import qa_service
from core import stream_manager

# 全局变量，用于跟踪当前的genagents服务器
genagents_server = None
genagents_thread = None
monitor_thread = None

__app = Flask(__name__)
# 禁用 Flask 默认日志
__app.logger.disabled = True
log = logging.getLogger('werkzeug')
log.disabled = True
# 禁用请求日志中间件
__app.config['PROPAGATE_EXCEPTIONS'] = True
# 设置最大请求大小限制为150MB（略大于100MB，留出余量）
__app.config['MAX_CONTENT_LENGTH'] = 150 * 1024 * 1024  # 150MB

auth = HTTPBasicAuth()

# CORS 配置：支持通过环境变量配置允许的域名
# 开发环境：允许所有域名（默认行为）
# 生产环境：设置环境变量 ALLOWED_ORIGINS 为逗号分隔的域名列表
# 例如：ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
allowed_origins = os.getenv('ALLOWED_ORIGINS', None)
if allowed_origins:
    # 生产环境：限制特定域名
    origins_list = [origin.strip() for origin in allowed_origins.split(',')]
    CORS(__app, origins=origins_list, supports_credentials=True)
    util.log(1, f'[CORS] 已配置允许的域名: {origins_list}')
else:
    # 开发环境：允许所有域名
    CORS(__app, supports_credentials=True)
    util.log(1, '[CORS] 开发模式：允许所有域名访问')


@__app.route('/health', methods=['GET'])
def health_check():
    """
    简单健康检查端点，供前端 API 配置测试使用
    """
    return jsonify({'status': 'ok'}), 200

def load_users():
    try:
        with open('verifier.json') as f:
            users = json.load(f)
        return users
    except Exception as e:
        print(f"Error loading users: {e}")
        return {}

users = load_users()

@auth.verify_password
def verify_password(username, password):
    if not users or config_util.start_mode == 'common':
        return True
    if username in users and users[username] == password:
        return username


def __get_template():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"Error rendering template: {e}", 500

def __get_device_list():
    try:
        if config_util.start_mode == 'common':
            audio = pyaudio.PyAudio()
            device_list = []
            for i in range(audio.get_device_count()):
                devInfo = audio.get_device_info_by_index(i)
                if devInfo['hostApi'] == 0:
                    device_list.append(devInfo["name"])
            return list(set(device_list))
        else:
            return []
    except Exception as e:
        print(f"Error getting device list: {e}")
        return []

@__app.route('/api/submit', methods=['post'])
def api_submit():
    data = request.values.get('data')
    if not data:
        return jsonify({'result': 'error', 'message': '未提供数据'})
    try:
        config_data = json.loads(data)
        if 'config' not in config_data:
            return jsonify({'result': 'error', 'message': '数据中缺少config'})

        config_util.load_config()
        existing_config = config_util.config

        def merge_configs(existing, new):
            for key, value in new.items():
                if isinstance(value, dict) and key in existing:
                    if isinstance(existing[key], dict):
                        merge_configs(existing[key], value)
                    else:
                        existing[key] = value
                else:
                    existing[key] = value

        merge_configs(existing_config, config_data['config'])

        config_util.save_config(existing_config)
        config_util.load_config()

        return jsonify({'result': 'successful'})
    except json.JSONDecodeError:
        return jsonify({'result': 'error', 'message': '无效的JSON数据'})
    except Exception as e:
        return jsonify({'result': 'error', 'message': f'保存配置时出错: {e}'}), 500
    



@__app.route('/api/get-data', methods=['post'])
def api_get_data():
    # 获取配置和语音列表
    try:
        config_util.load_config()
        voice_list = tts_voice.get_voice_list()
        send_voice_list = []
        if config_util.tts_module == 'ali':
            voice_list = [
                {"id": "abin", "name": "阿斌"},
                {"id": "zhixiaobai", "name": "知小白"},
                {"id": "zhixiaoxia", "name": "知小夏"},
                {"id": "zhixiaomei", "name": "知小妹"},
                {"id": "zhigui", "name": "知柜"},
                {"id": "zhishuo", "name": "知硕"},
                {"id": "aixia", "name": "艾夏"},
                {"id": "zhifeng_emo", "name": "知锋_多情感"},
                {"id": "zhibing_emo", "name": "知冰_多情感"},
                {"id": "zhimiao_emo", "name": "知妙_多情感"},
                {"id": "zhimi_emo", "name": "知米_多情感"},
                {"id": "zhiyan_emo", "name": "知燕_多情感"},
                {"id": "zhibei_emo", "name": "知贝_多情感"},
                {"id": "zhitian_emo", "name": "知甜_多情感"},
                {"id": "xiaoyun", "name": "小云"},
                {"id": "xiaogang", "name": "小刚"},
                {"id": "ruoxi", "name": "若兮"},
                {"id": "siqi", "name": "思琪"},
                {"id": "sijia", "name": "思佳"},
                {"id": "sicheng", "name": "思诚"},
                {"id": "aiqi", "name": "艾琪"},
                {"id": "aijia", "name": "艾佳"},
                {"id": "aicheng", "name": "艾诚"},
                {"id": "aida", "name": "艾达"},
                {"id": "ninger", "name": "宁儿"},
                {"id": "ruilin", "name": "瑞琳"},
                {"id": "siyue", "name": "思悦"},
                {"id": "aiya", "name": "艾雅"},
                {"id": "aimei", "name": "艾美"},
                {"id": "aiyu", "name": "艾雨"},
                {"id": "aiyue", "name": "艾悦"},
                {"id": "aijing", "name": "艾婧"},
                {"id": "xiaomei", "name": "小美"},
                {"id": "aina", "name": "艾娜"},
                {"id": "yina", "name": "伊娜"},
                {"id": "sijing", "name": "思婧"},
                {"id": "sitong", "name": "思彤"},
                {"id": "xiaobei", "name": "小北"},
                {"id": "aitong", "name": "艾彤"},
                {"id": "aiwei", "name": "艾薇"},
                {"id": "aibao", "name": "艾宝"},
                {"id": "shanshan", "name": "姗姗"},
                {"id": "chuangirl", "name": "小玥"},
                {"id": "lydia", "name": "Lydia"},
                {"id": "aishuo", "name": "艾硕"},
                {"id": "qingqing", "name": "青青"},
                {"id": "cuijie", "name": "翠姐"},
                {"id": "xiaoze", "name": "小泽"},
                {"id": "zhimao", "name": "知猫"},
                {"id": "zhiyuan", "name": "知媛"},
                {"id": "zhiya", "name": "知雅"},
                {"id": "zhiyue", "name": "知悦"},
                {"id": "zhida", "name": "知达"},
                {"id": "zhistella", "name": "知莎"},
                {"id": "kelly", "name": "Kelly"},
                {"id": "jiajia", "name": "佳佳"},
                {"id": "taozi", "name": "桃子"},
                {"id": "guijie", "name": "柜姐"},
                {"id": "stella", "name": "Stella"},
                {"id": "stanley", "name": "Stanley"},
                {"id": "kenny", "name": "Kenny"},
                {"id": "rosa", "name": "Rosa"},
                {"id": "mashu", "name": "马树"},
                {"id": "xiaoxian", "name": "小仙"},
                {"id": "yuer", "name": "悦儿"},
                {"id": "maoxiaomei", "name": "猫小美"},
                {"id": "aifei", "name": "艾飞"},
                {"id": "yaqun", "name": "亚群"},
                {"id": "qiaowei", "name": "巧薇"},
                {"id": "dahu", "name": "大虎"},
                {"id": "ailun", "name": "艾伦"},
                {"id": "jielidou", "name": "杰力豆"},
                {"id": "laotie", "name": "老铁"},
                {"id": "laomei", "name": "老妹"},
                {"id": "aikan", "name": "艾侃"}
            ]
            send_voice_list = {"voiceList": voice_list}
            wsa_server.get_web_instance().add_cmd(send_voice_list)
        elif config_util.tts_module == 'volcano':
            voice_list = [
                {"id": "BV001_streaming", "name": "通用女声"},
                {"id": "BV002_streaming", "name": "通用男声"},
                {"id": "zh_male_jingqiangkanye_moon_bigtts", "name": "京腔侃爷/Harmony"},
                {"id": "zh_female_shuangkuaisisi_moon_bigtts", "name": "爽快思思/Skye"},
                {"id": "zh_male_wennuanahu_moon_bigtts", "name": "温暖阿虎/Alvin"},
                {"id": "zh_female_wanwanxiaohe_moon_bigtts", "name": "湾湾小何"}
            ]
            send_voice_list = {"voiceList": voice_list}
            wsa_server.get_web_instance().add_cmd(send_voice_list)

        else:
            voice_list = tts_voice.get_voice_list()
            send_voice_list = []
            for voice in voice_list:
                voice_data = voice.value
                send_voice_list.append({"id": voice_data['name'], "name": voice_data['name']})
            wsa_server.get_web_instance().add_cmd({"voiceList": send_voice_list})
            voice_list = send_voice_list
        wsa_server.get_web_instance().add_cmd({"deviceList": __get_device_list()})
        if fay_booter.is_running():
            wsa_server.get_web_instance().add_cmd({"liveState": 1})
        return json.dumps({'config': config_util.config, 'voice_list': voice_list})
    except Exception as e:
        return jsonify({'result': 'error', 'message': f'获取数据时出错: {e}'}), 500

def ensure_fay_service_running(timeout=10):
    """
    确保Fay数字人服务正在运行
    如果服务未运行，则自动启动并等待服务就绪
    
    参数:
        timeout: 等待服务启动的超时时间（秒），默认10秒
        
    返回:
        tuple: (是否成功, 消息, 详细信息)
        - (True, "服务已运行", {}): 服务已在运行
        - (True, "服务启动成功", {"startup_time": 3}): 服务启动成功
        - (False, "服务启动超时", {"timeout": timeout}): 启动超时
        - (False, "启动失败: {错误信息}", {"error": str(e)}): 启动失败
    """
    try:
        # 检查服务是否已在运行
        if fay_booter.is_running():
            util.log(1, "[自动启动] 服务已在运行")
            return True, "服务已运行", {"status": "already_running"}
        
        util.log(1, "[自动启动] 服务未运行，开始自动启动...")
        
        # 记录启动开始时间
        start_time = time.time()
        
        # 启动服务
        try:
            fay_booter.start()
            util.log(1, "[自动启动] 服务启动命令已发送，等待服务就绪...")
        except Exception as e:
            util.log(1, f"[自动启动] 启动命令失败: {e}")
            import traceback
            util.log(1, f"[自动启动] 错误详情: {traceback.format_exc()}")
            return False, f"启动失败: {str(e)}", {"error": str(e), "stage": "start_command"}
        
        # 等待服务就绪（最多等待timeout秒）
        for i in range(timeout):
            gsleep(1)  # 等待1秒
            if fay_booter.is_running():
                elapsed_time = int(time.time() - start_time)
                util.log(1, f"[自动启动] 服务启动成功（耗时 {elapsed_time} 秒）")
                # 通知前端服务状态
                try:
                    wsa_server.get_web_instance().add_cmd({"liveState": 1})
                except:
                    pass
                return True, "服务启动成功", {"startup_time": elapsed_time, "status": "started"}
            
            if i < timeout - 1:  # 不是最后一次循环
                util.log(1, f"[自动启动] 等待服务就绪... ({i+1}/{timeout})")
        
        # 超时
        elapsed_time = int(time.time() - start_time)
        util.log(1, f"[自动启动] 服务启动超时（等待了 {timeout} 秒）")
        return False, f"服务启动超时（已等待 {timeout} 秒），请稍后重试", {"timeout": timeout, "elapsed_time": elapsed_time, "stage": "timeout"}
        
    except Exception as e:
        util.log(1, f"[自动启动] 确保服务运行过程中出错: {e}")
        import traceback
        util.log(1, f"[自动启动] 错误详情: {traceback.format_exc()}")
        return False, f"启动失败: {str(e)}", {"error": str(e), "stage": "exception"}


@__app.route('/api/start-live', methods=['post'])
def api_start_live():
    # 启动
    try:
        success, message, details = ensure_fay_service_running()
        if success:
            return jsonify({
                'result': 'successful',
                'message': message,
                'details': details
            })
        else:
            return jsonify({
                'result': 'error', 
                'message': message,
                'details': details
            }), 500
    except Exception as e:
        return jsonify({'result': 'error', 'message': f'启动时出错: {e}'}), 500

@__app.route('/api/stop-live', methods=['post'])
def api_stop_live():
    # 停止
    try:
        fay_booter.stop()
        gsleep(1)
        wsa_server.get_web_instance().add_cmd({"liveState": 0})
        return '{"result":"successful"}'
    except Exception as e:
        return jsonify({'result': 'error', 'message': f'停止时出错: {e}'}), 500

@__app.route('/api/send', methods=['post'])
def api_send():
    # 接收前端发送的消息
    data = request.values.get('data')
    if not data:
        return jsonify({'result': 'error', 'message': '未提供数据'})
    try:
        info = json.loads(data)
        username = info.get('username')
        msg = info.get('msg')
        pure_mode = info.get('pure_mode', False)  # 获取纯模型模式参数
        if not username or not msg:
            return jsonify({'result': 'error', 'message': '用户名和消息内容不能为空'})
        msg = msg.strip()
        
        # 如果不在纯模式，确保数字人服务正在运行
        if not pure_mode:
            if not fay_booter.is_running():
                util.log(1, "[对话API] 服务未运行，自动启动...")
                start_success, start_message, start_details = ensure_fay_service_running(timeout=10)
                if not start_success:
                    return jsonify({
                        'result': 'error', 
                        'message': f'数字人服务启动失败: {start_message}，请稍后重试',
                        'details': start_details,
                        'suggestion': '请尝试手动启动服务，或稍后重试'
                    }), 500
                util.log(1, f"[对话API] 服务启动成功: {start_message}，继续处理消息")
      
        interact = Interact("text", 1, {'user': username, 'msg': msg, 'pure_mode': pure_mode})
        util.printInfo(1, username, '[文字发送按钮]{}'.format(interact.data["msg"]), time.time())
        fay_booter.feiFei.on_interact(interact)
        return '{"result":"successful"}'
    except json.JSONDecodeError:
        return jsonify({'result': 'error', 'message': '无效的JSON数据'})
    except Exception as e:
        return jsonify({'result': 'error', 'message': f'发送消息时出错: {e}'}), 500

# 获取指定用户的消息记录
@__app.route('/api/get-msg', methods=['post'])
def api_get_Msg():
    try:
        data = request.form.get('data')
        if data is None:
            data = request.get_json()
        else:
            data = json.loads(data)
        username = data.get("username", "User")
        model_id = data.get("model_id")  # 支持按模型ID筛选
        
        uid = member_db.new_instance().find_user(username)
        contentdb = content_db.new_instance()
        if uid == 0:
            return json.dumps({'list': []})
        else:
            # 如果提供了model_id，按模型筛选；否则获取所有消息
            list = contentdb.get_list('all', 'desc', 1000, uid, model_id)
        
        relist = []
        i = len(list) - 1
        while i >= 0:
            timezone = pytz.timezone('Asia/Shanghai')
            timetext = datetime.datetime.fromtimestamp(list[i][3], timezone).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            relist.append(dict(type=list[i][0], way=list[i][1], content=list[i][2], createtime=list[i][3], timetext=timetext, username=list[i][5], id=list[i][6], is_adopted=list[i][7]))
            i -= 1
        if fay_booter.is_running():
            wsa_server.get_web_instance().add_cmd({"liveState": 1})
        return json.dumps({'list': relist})
    except json.JSONDecodeError:
        return jsonify({'list': [], 'message': '无效的JSON数据'})
    except Exception as e:
        return jsonify({'list': [], 'message': f'获取消息时出错: {e}'}), 500

#文字沟通接口
@__app.route('/v1/chat/completions', methods=['post'])
@__app.route('/api/send/v1/chat/completions', methods=['post'])
def api_send_v1_chat_completions():
    # 处理聊天完成请求
    data = request.get_json()
    if not data:
        return jsonify({'error': '未提供数据'})
    
    # 获取pure_mode参数
    pure_mode = data.get('pure_mode', False)
    
    # 如果不在纯模式，确保数字人服务正在运行
    if not pure_mode:
        # 检查服务是否运行或feiFei是否已初始化
        if not fay_booter.is_running() or fay_booter.feiFei is None:
            if fay_booter.feiFei is None:
                util.log(1, "[对话API-v1] feiFei 未初始化，尝试自动启动服务...")
            else:
                util.log(1, "[对话API-v1] 服务未运行，自动启动...")
            
            start_success, start_message, start_details = ensure_fay_service_running(timeout=10)
            if not start_success:
                # 启动失败，回退到直接调用LLM API
                util.log(1, f"[对话API-v1] 服务启动失败: {start_message}，回退到直接LLM调用")
                # 记录启动失败信息，但仍然尝试直接调用LLM
                try:
                    response = direct_llm_api_call(data)
                    # 如果直接LLM调用成功，在响应中添加警告信息
                    if isinstance(response, dict):
                        response['warning'] = f'数字人服务未启动（{start_message}），已使用直接LLM模式'
                    return response
                except:
                    # 如果直接LLM也失败，返回错误
                    return jsonify({
                        'error': f'服务启动失败且LLM调用失败: {start_message}',
                        'details': start_details
                    }), 500
            util.log(1, f"[对话API-v1] 服务启动成功: {start_message}，继续处理消息")
            
            # 再次检查feiFei是否已初始化（启动后应该已初始化）
            if fay_booter.feiFei is None:
                util.log(1, "[对话API-v1] ⚠️ 服务已启动但feiFei仍未初始化，等待初始化...")
                # 等待一小段时间让feiFei初始化（time模块已在文件顶部导入）
                for i in range(5):  # 最多等待5秒
                    time.sleep(1)
                    if fay_booter.feiFei is not None:
                        util.log(1, f"[对话API-v1] ✅ feiFei 已初始化（等待了 {i+1} 秒）")
                        break
                
                # 如果仍然未初始化，回退到直接LLM调用
                if fay_booter.feiFei is None:
                    util.log(1, "[对话API-v1] ⚠️ feiFei 初始化超时，使用直接LLM调用")
                    try:
                        response = direct_llm_api_call(data)
                        if isinstance(response, dict):
                            response['warning'] = '数字人服务启动但未完全初始化，已使用直接LLM模式'
                        return response
                    except:
                        return jsonify({
                            'error': '服务启动但feiFei未初始化，LLM调用也失败'
                        }), 500
    
    try:
        last_content = ""
        if 'messages' in data and data['messages']:
            last_message = data['messages'][-1]
            username = last_message.get('role', 'User')
            if username == 'user':
                username = 'User'
            last_content = last_message.get('content', 'No content provided')
        else:
            last_content = 'No messages found'
            username = 'User'

        model = data.get('model', 'fay')
        observation = data.get('observation', '')
        # 检查请求中是否指定了流式传输
        stream_requested = data.get('stream', False)
        if stream_requested or model == 'fay-streaming':
            interact = Interact("text", 1, {'user': username, 'msg': last_content, 'observation': str(observation), 'stream':True, 'pure_mode': pure_mode})
            util.printInfo(1, username, '[文字沟通接口(流式)]{}'.format(interact.data["msg"]), time.time())
            fay_booter.feiFei.on_interact(interact)
            return gpt_stream_response(last_content, username)
        else:
            interact = Interact("text", 1, {'user': username, 'msg': last_content, 'observation': str(observation), 'stream':False, 'pure_mode': pure_mode})
            util.printInfo(1, username, '[文字沟通接口(非流式)]{}'.format(interact.data["msg"]), time.time())
            fay_booter.feiFei.on_interact(interact)
            return non_streaming_response(last_content, username)
    except Exception as e:
        util.log(1, f"[API] 处理请求时出错: {e}")
        return jsonify({'error': f'处理请求时出错: {e}'}), 500

def direct_llm_api_call(data):
    """
    直接调用 LLM API（当 feiFei 未初始化时使用）
    """
    try:
        import openai
        
        # 加载配置
        config_util.load_config()
        
        # 构建消息
        messages = []
        if 'messages' in data:
            for msg in data['messages']:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if role == 'system':
                    messages.append({'role': 'system', 'content': content})
                elif role == 'assistant':
                    messages.append({'role': 'assistant', 'content': content})
                else:
                    messages.append({'role': 'user', 'content': content})
        
        # 使用配置中的API设置，不做任何修改
        base_url = config_util.gpt_base_url
        api_key = config_util.key_gpt_api_key
        model_name = config_util.gpt_model_engine or 'gpt-3.5-turbo'
        
        util.log(1, f"[API] 直接调用LLM API，base_url: {base_url}, model: {model_name}")
        
        # 使用配置的API设置
        client = openai.OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 调用 API
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=False
        )
        
        # 返回 OpenAI 兼容格式
        return jsonify({
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': response.choices[0].message.content
                }
            }]
        })
    except Exception as e:
        util.log(1, f"[API] 直接调用 LLM API 失败: {e}")
        import traceback
        util.log(1, f"[API] 错误详情: {traceback.format_exc()}")
        return jsonify({'error': f'LLM API 调用失败: {e}'}), 500

@__app.route('/api/get-member-list', methods=['post'])
def api_get_Member_list():
    # 获取成员列表
    try:
        memberdb = member_db.new_instance()
        list = memberdb.get_all_users()
        return json.dumps({'list': list})
    except Exception as e:
        return jsonify({'list': [], 'message': f'获取成员列表时出错: {e}'}), 500

@__app.route('/api/get-run-status', methods=['post'])
def api_get_run_status():
    # 获取运行状态
    try:
        status = fay_booter.is_running()
        return json.dumps({'status': status})
    except Exception as e:
        return jsonify({'status': False, 'message': f'获取运行状态时出错: {e}'}), 500

@__app.route('/api/adopt-msg', methods=['POST'])
def adopt_msg():
    # 采纳消息
    data = request.get_json()
    if not data:
        return jsonify({'status':'error', 'msg': '未提供数据'})

    id = data.get('id')

    if not id:
        return jsonify({'status':'error', 'msg': 'id不能为空'})

    if  config_util.config["interact"]["QnA"] == "":
        return jsonify({'status':'error', 'msg': '请先设置Q&A文件'})

    try:
        info = content_db.new_instance().get_content_by_id(id)
        content = info[3] if info else ''
        if info is not None:
            previous_info = content_db.new_instance().get_previous_user_message(id)
            previous_content = previous_info[3] if previous_info else ''
            result = content_db.new_instance().adopted_message(id)
            if result:
                qa_service.QAService().record_qapair(previous_content, content)
                return jsonify({'status': 'success', 'msg': '采纳成功'})
            else:
                return jsonify({'status':'error', 'msg': '采纳失败'}), 500
        else:
            return jsonify({'status':'error', 'msg': '消息未找到'}), 404
    except Exception as e:
        return jsonify({'status':'error', 'msg': f'采纳消息时出错: {e}'}), 500

def gpt_stream_response(last_content, username):
    sm = stream_manager.new_instance()
    _, nlp_Stream = sm.get_Stream(username)
    def generate():
        conversation_id = sm.get_conversation_id(username)
        while True:
            sentence = nlp_Stream.read()
            if sentence is None:
                gsleep(0.01)
                continue
            
            # 跳过非当前会话
            try:
                m = re.search(r"__<cid=([^>]+)>__", sentence)
                producer_cid = m.group(1)
                if producer_cid != conversation_id:
                    continue
                if m:
                    sentence = sentence.replace(m.group(0), "")
            except Exception as e:
                print(e)
            is_first = "_<isfirst>" in sentence
            is_end = "_<isend>" in sentence
            content = sentence.replace("_<isfirst>", "").replace("_<isend>", "").replace("_<isqa>", "")
            if content or is_first or is_end:  # 只有当有实际内容时才发送
                message = {
                    "id": "faystreaming-" + str(uuid.uuid4()),
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": "fay-streaming",
                    "choices": [
                        {
                            "delta": {
                                "content": content
                            },
                            "index": 0,
                            "finish_reason": "stop" if is_end else None
                        }
                    ],
                    #TODO 这里的token计算方式需要优化
                    "usage": {
                        "prompt_tokens": len(last_content) if is_first else 0, 
                        "completion_tokens": len(content),
                        "total_tokens": len(last_content) + len(content)
                    },
                    "system_fingerprint": ""
                }
                yield f"data: {json.dumps(message)}\n\n"
            if is_end:
                break
            gsleep(0.01)
        yield 'data: [DONE]\n\n'
    
    return Response(generate(), mimetype='text/event-stream')

# 处理非流式响应
def non_streaming_response(last_content, username):
    sm = stream_manager.new_instance()
    _, nlp_Stream = sm.get_Stream(username)
    text = ""
    conversation_id = sm.get_conversation_id(username)
    while True:
        sentence = nlp_Stream.read()
        if sentence is None:
            gsleep(0.01)
            continue
        
        # 跳过非当前会话
        try:
            m = re.search(r"__<cid=([^>]+)>__", sentence)
            producer_cid = m.group(1)
            if producer_cid != conversation_id:
                continue
            if m:
                sentence = sentence.replace(m.group(0), "")
        except Exception as e:
            print(e)
        is_first = "_<isfirst>" in sentence
        is_end = "_<isend>" in sentence
        text += sentence.replace("_<isfirst>", "").replace("_<isend>", "").replace("_<isqa>", "")
        if is_end:
            break
    return jsonify({
        "id": "fay-" + str(uuid.uuid4()),
        "object": "chat.completion",
        "created": int(time.time()),
        "model": "fay",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": text
                },
                "logprobs": "",
                "finish_reason": "stop"
            }
        ],
        #TODO 这里的token计算方式需要优化
        "usage": {
            "prompt_tokens": len(last_content), 
            "completion_tokens": len(text),
            "total_tokens": len(last_content) + len(text)
        },
        "system_fingerprint": ""
    })

@__app.route('/', methods=['get'])
@auth.login_required
def home_get():
    try:
        return __get_template()
    except Exception as e:
        return f"Error loading home page: {e}", 500

@__app.route('/', methods=['post'])
@auth.login_required
def home_post():
    try:
        return __get_template()
    except Exception as e:
        return f"Error processing request: {e}", 500

@__app.route('/setting', methods=['get'])
def setting():
    try:
        return render_template('setting.html')
    except Exception as e:
        return f"Error loading settings page: {e}", 500

@__app.route('/models', methods=['get'])
def models():
    try:
        return render_template('models.html')
    except Exception as e:
        return f"Error loading models page: {e}", 500

@__app.route('/Page3', methods=['get'])
def Page3():
    try:
        return render_template('Page3.html')
    except Exception as e:
        return f"Error loading settings page: {e}", 500

@__app.route('/test-pure-llm', methods=['get'])
def test_pure_llm():
    try:
        with open('test_pure_llm_api.html', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error loading test page: {e}", 500

@__app.route('/debug-pure-mode', methods=['get'])
def debug_pure_mode():
    try:
        with open('debug_pure_mode.html', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error loading debug page: {e}", 500

@__app.route('/quick_test_pure_mode.html', methods=['get'])
def quick_test_pure_mode():
    try:
        with open('quick_test_pure_mode.html', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error loading test page: {e}", 500

@__app.route('/simple_chat.html', methods=['get'])
def simple_chat():
    try:
        with open('simple_chat.html', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error loading simple chat page: {e}", 500

@__app.route('/simple-chat', methods=['get'])
def simple_chat_route():
    try:
        with open('simple_chat.html', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error loading simple chat page: {e}", 500


# 输出的音频http
@__app.route('/api/audio/recognize', methods=['POST'])
def api_audio_recognize():
    """
    接收音频文件并进行ASR识别
    支持WebM、WAV等格式
    """
    try:
        import time
        if 'audio' not in request.files:
            return jsonify({'code': 400, 'message': '未提供音频文件'}), 400
        
        audio_file = request.files['audio']
        username = request.form.get('username', 'User')
        
        if audio_file.filename == '':
            return jsonify({'code': 400, 'message': '文件名不能为空'}), 400
        
        # 保存临时音频文件
        temp_dir = os.path.join(os.getcwd(), 'temp_audio')
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_filename = f'audio_{username}_{int(time.time())}.webm'
        temp_path = os.path.join(temp_dir, temp_filename)
        audio_file.save(temp_path)
        
        util.log(1, f"[音频识别] 接收到音频文件: {temp_filename}, 用户: {username}, 大小: {os.path.getsize(temp_path)} bytes")
        
        # 尝试使用ASR进行识别
        # 注意：需要将WebM转换为ASR所需的格式（通常是PCM WAV）
        try:
            # 这里需要根据实际的ASR服务进行调整
            # 可以调用现有的ASR客户端，或者使用FFmpeg转换格式
            
            # 临时方案：返回提示信息，实际需要使用流式识别或格式转换
            # 清理临时文件
            try:
                os.remove(temp_path)
            except:
                pass
            
            # 返回提示：建议使用流式识别或文本输入
            return jsonify({
                'code': 200,
                'message': '音频接收成功，建议使用流式识别或文本输入',
                'text': '',  # 实际应该返回识别结果
                'note': '文件识别功能需要将音频转换为ASR所需格式，建议使用Web Speech API或流式识别'
            }), 200
            
        except Exception as e:
            util.log(1, f"[音频识别] ASR识别失败: {str(e)}")
            # 清理临时文件
            try:
                os.remove(temp_path)
            except:
                pass
            return jsonify({'code': 500, 'message': f'ASR识别失败: {str(e)}'}), 500
            
    except Exception as e:
        util.log(1, f"[音频识别API] 处理失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'处理失败: {str(e)}'}), 500

@__app.route('/audio/<filename>')
def serve_audio(filename):
    audio_file = os.path.join(os.getcwd(), "samples", filename)
    if os.path.exists(audio_file):
        return send_file(audio_file)
    else:
        return jsonify({'error': '文件未找到'}), 404

# 输出的表情gif
@__app.route('/robot/<filename>')
def serve_gif(filename):
    gif_file = os.path.join(os.getcwd(), "gui", "robot", filename)
    if os.path.exists(gif_file):
        return send_file(gif_file)
    else:
        return jsonify({'error': '文件未找到'}), 404

# 输出的3D模型文件
@__app.route('/models/<filename>')
def serve_model(filename):
    """
    提供3D模型文件服务
    支持 .glb, .gltf, .fbx 等格式
    """
    try:
        # 安全检查：防止路径遍历攻击
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': '非法文件名'}), 400
        
        models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'soullink', 'public', 'models')
        model_file = os.path.join(models_dir, filename)
        
        if not os.path.exists(model_file):
            return jsonify({'error': '文件未找到'}), 404
        
        # 根据文件扩展名设置MIME类型
        mime_types = {
            '.glb': 'model/gltf-binary',
            '.gltf': 'model/gltf+json',
            '.fbx': 'application/octet-stream'
        }
        
        ext = os.path.splitext(filename)[1].lower()
        mimetype = mime_types.get(ext, 'application/octet-stream')
        
        return send_file(model_file, mimetype=mimetype)
    except Exception as e:
        util.log(1, f"[模型文件服务] 提供模型文件失败: {str(e)}")
        return jsonify({'error': f'提供文件失败: {str(e)}'}), 500

#打招呼
@__app.route('/to-greet', methods=['POST'])
def to_greet():
    data = request.get_json()
    username = data.get('username', 'User')
    observation = data.get('observation', '')
    interact = Interact("hello", 1, {'user': username, 'msg': '按观测要求打个招呼', 'observation': str(observation)})
    text = fay_booter.feiFei.on_interact(interact)
    return jsonify({'status': 'success', 'data': text, 'msg': '已进行打招呼'}), 200 

#唤醒:在普通唤醒模式，进行大屏交互才有意义
@__app.route('/to-wake', methods=['POST'])
def to_wake():
    data = request.get_json()
    username = data.get('username', 'User')
    observation = data.get('observation', '')
    fay_booter.recorderListener.wakeup_matched = True
    return jsonify({'status': 'success', 'msg': '已唤醒'}), 200 

#打断
@__app.route('/to-stop-talking', methods=['POST'])
def to_stop_talking():
    try:
        data = request.get_json()
        username = data.get('username', 'User')
        stream_manager.new_instance().clear_Stream_with_audio(username)
        
        result = "interrupted"  # 简单的结果标识
        return jsonify({
            'status': 'success',
            'data': str(result) if result is not None else '',
            'msg': f'已停止用户 {username} 的说话'
        }), 200
    except Exception as e:
        username_str = username if 'username' in locals() else 'Unknown'
        util.printInfo(1, username_str, f"打断操作失败: {str(e)}")
        return jsonify({
            'status': 'error',
            'msg': str(e)
        }), 500


#消息透传接口
@__app.route('/transparent-pass', methods=['post'])
def transparent_pass():
    try:
        data = request.form.get('data')
        if data is None:
            data = request.get_json()
        else:
            data = json.loads(data)
        username = data.get('user', 'User')
        response_text = data.get('text', None)
        audio_url = data.get('audio', None)
        if response_text or audio_url:
            # 新消息到达，立即中断该用户之前的所有处理（文本流+音频队列）
            util.printInfo(1, username, f'[API中断] 新消息到达，完整中断用户 {username} 之前的所有处理')
            util.printInfo(1, username, f'[API中断] 用户 {username} 的文本流和音频队列已清空，准备处理新消息')
            interact = Interact('transparent_pass', 2, {'user': username, 'text': response_text, 'audio': audio_url, 'isend':True, 'isfirst':True})
            util.printInfo(1, username, '透传播放：{}，{}'.format(response_text, audio_url), time.time())
            success = fay_booter.feiFei.on_interact(interact)
            if (success == 'success'):
                return jsonify({'code': 200, 'message' : '成功'})
        return jsonify({'code': 500, 'message' : '未知原因出错'})
    except Exception as e:
        return jsonify({'code': 500, 'message': f'出错: {e}'}), 500

# 直接LLM对话API - 完全绕过Fay框架
@__app.route('/api/direct-llm', methods=['POST'])
def api_direct_llm():
    """
    直接LLM对话接口 - 不走任何Fay逻辑，不使用记忆，不使用角色设定
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '未提供数据'}), 400
        
        message = data.get('message', '')
        if not message.strip():
            return jsonify({'error': '消息内容不能为空'}), 400
        
        # 加载基础配置（仅用于LLM连接）
        config_util.load_config()
        
        # 直接使用OpenAI兼容的API
        import openai
        
        # 使用配置中的LLM设置，完全按照配置来
        base_url = config_util.gpt_base_url
        api_key = config_util.key_gpt_api_key
        model_name = config_util.gpt_model_engine or 'gpt-3.5-turbo'
        
        util.log(1, f"[直接LLM] 使用配置: base_url={base_url}, model={model_name}")
        
        client = openai.OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 简单的系统提示 - 不包含任何角色设定
        messages = [
            {"role": "system", "content": "你是一个有用的AI助手。请直接、简洁地回答用户的问题。不要称呼用户为'主人'。"},
            {"role": "user", "content": message}
        ]
        
        # 调用LLM
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )
        
        # 返回结果
        reply = response.choices[0].message.content
        
        return jsonify({
            'success': True,
            'reply': reply,
            'model': model_name
        })
        
    except Exception as e:
        util.log(1, f"[直接LLM] 调用失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'LLM调用失败: {str(e)}'
        }), 500

# 直接LLM流式对话API
@__app.route('/api/direct-llm-stream', methods=['POST'])
def api_direct_llm_stream():
    """
    直接LLM流式对话接口 - 完全绕过Fay框架
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '未提供数据'}), 400
        
        message = data.get('message', '')
        if not message.strip():
            return jsonify({'error': '消息内容不能为空'}), 400
        
        # 加载基础配置
        config_util.load_config()
        
        import openai
        
        client = openai.OpenAI(
            api_key=config_util.key_gpt_api_key,
            base_url=config_util.gpt_base_url
        )
        
        messages = [
            {"role": "system", "content": "你是一个有用的AI助手。请直接、简洁地回答用户的问题。"},
            {"role": "user", "content": message}
        ]
        
        def generate():
            try:
                stream = client.chat.completions.create(
                    model=config_util.gpt_model_engine or 'gpt-3.5-turbo',
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2000,
                    stream=True
                )
                
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                
                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        util.log(1, f"[直接LLM流式] 调用失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'LLM调用失败: {str(e)}'
        }), 500
@__app.route('/api/clear-memory', methods=['POST'])
def api_clear_memory():
    try:
        # 获取memory目录路径
        memory_dir = os.path.join(os.getcwd(), "memory")
        
        # 检查目录是否存在
        if not os.path.exists(memory_dir):
            return jsonify({'success': False, 'message': '记忆目录不存在'}), 400
        
        # 清空memory目录下的所有文件（保留目录结构）
        for root, dirs, files in os.walk(memory_dir):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        util.log(1, f"已删除文件: {file_path}")
                except Exception as e:
                    util.log(1, f"删除文件时出错: {file_path}, 错误: {str(e)}")
        
        # 删除memory_dir下的所有子目录
        import shutil
        for item in os.listdir(memory_dir):
            item_path = os.path.join(memory_dir, item)
            if os.path.isdir(item_path):
                try:
                    shutil.rmtree(item_path)
                    util.log(1, f"已删除目录: {item_path}")
                except Exception as e:
                    util.log(1, f"删除目录时出错: {item_path}, 错误: {str(e)}")
        
        # 创建一个标记文件，表示记忆已被清除，防止退出时重新保存
        with open(os.path.join(memory_dir, ".memory_cleared"), "w") as f:
            f.write("Memory has been cleared. Do not save on exit.")
        
        # 设置记忆清除标记
        try:
            # 导入并修改nlp_cognitive_stream模块中的保存函数
            from llm.nlp_cognitive_stream import set_memory_cleared_flag, clear_agent_memory
            
            # 设置记忆清除标记
            set_memory_cleared_flag(True)
            
            # 清除内存中已加载的记忆
            clear_agent_memory()
            
            util.log(1, "已同时清除文件存储和内存中的记忆")
        except Exception as e:
            util.log(1, f"清除内存中记忆时出错: {str(e)}")
        
        util.log(1, "记忆已清除，需要重启应用才能生效")
        return jsonify({'success': True, 'message': '记忆已清除，请重启应用使更改生效'}), 200
    except Exception as e:
        util.log(1, f"清除记忆时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'清除记忆时出错: {str(e)}'}), 500

# ==================== 模型管理API ====================

@__app.route('/api/models/create', methods=['POST'])
def api_models_create():
    """创建新模型"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'code': 400, 'message': '模型名称不能为空'}), 400
        
        description = data.get('description', '').strip()
        character_description = data.get('character_description', '').strip()
        attribute_json = data.get('attribute_json')
        model3d_url = data.get('model3d_url')  # 获取3D模型URL
        idle_model_url = data.get('idle_model_url')  # 获取待机动画模型URL
        talking_model_url = data.get('talking_model_url')  # 获取说话动画模型URL
        creator_username = data.get('username')
        # 如果没有提供username，默认为全局模型
        if creator_username is None or creator_username == '':
            is_global = 1
            creator_username = None
        else:
            is_global = data.get('is_global', 0)
        
        # 如果提供了character_description，使用通用LLM生成属性
        if character_description:
            try:
                from llm import llm_service
                attributes = llm_service.generate_character_attributes(character_description)
                if attributes:
                    import json
                    attribute_json = json.dumps(attributes, ensure_ascii=False)
                    util.log(1, f"[模型API] 成功生成模型属性")
                else:
                    return jsonify({'code': 500, 'message': '生成模型属性失败'}), 500
            except Exception as e:
                util.log(1, f"[模型API] 生成属性失败: {str(e)}")
                return jsonify({'code': 500, 'message': f'生成属性失败: {str(e)}'}), 500
        
        # 如果没有属性，返回错误
        if not attribute_json:
            return jsonify({'code': 400, 'message': '必须提供属性或人物描述'}), 400
        
        # 如果attribute_json是字典，转换为JSON字符串
        if isinstance(attribute_json, dict):
            import json
            attribute_json = json.dumps(attribute_json, ensure_ascii=False)
        
        # 创建模型
        from core import model_db
        db = model_db.new_instance()
        success, result = db.create_model(name, description, attribute_json, creator_username, is_global, model3d_url, idle_model_url, talking_model_url)
        
        if success:
            model_info = db.get_model_by_id(result)
            
            # 创建模型成功后，自动启动数字人服务（如果未运行）
            util.log(1, f"[模型API] 模型创建成功，检查并启动数字人服务...")
            start_success, start_message, start_details = ensure_fay_service_running(timeout=10)
            if start_success:
                util.log(1, f"[模型API] {start_message}")
            else:
                util.log(1, f"[模型API] 自动启动服务失败: {start_message}，但模型创建成功")
            
            return jsonify({
                'code': 200,
                'message': '创建成功',
                'data': {
                    'model_id': result,
                    'name': model_info['name'],
                    'description': model_info['description'],
                    'is_global': model_info['is_global'],
                    'service_started': start_success,
                    'service_message': start_message,
                    'service_details': start_details
                }
            }), 200
        else:
            return jsonify({'code': 500, 'message': result}), 500
            
    except Exception as e:
        util.log(1, f"[模型API] 创建模型失败: {str(e)}")
        import traceback
        util.log(1, f"[模型API] 错误详情: {traceback.format_exc()}")
        return jsonify({'code': 500, 'message': f'创建模型失败: {str(e)}'}), 500


@__app.route('/api/models/list', methods=['POST'])
def api_models_list():
    """获取模型列表"""
    try:
        data = request.get_json() or {}
        username = data.get('username')
        include_global = data.get('include_global', True)
        
        from core import model_db
        db = model_db.new_instance()
        models = db.get_model_list(username, include_global)
        
        util.log(1, f"[模型API] 查询到 {len(models)} 个模型，username={username}, include_global={include_global}")
        
        # 格式化返回数据
        from datetime import datetime
        result = []
        for model in models:
            try:
                import json
                attributes = json.loads(model['attribute_json']) if isinstance(model['attribute_json'], str) else model['attribute_json']
            except Exception as e:
                util.log(1, f"[模型API] 解析属性JSON失败: {e}")
                attributes = {}
            
            # 格式化时间戳为可读的时间字符串
            created_at_timestamp = model.get('created_at', 0)
            updated_at_timestamp = model.get('updated_at', 0)
            created_at_str = ''
            updated_at_str = ''
            
            if created_at_timestamp:
                try:
                    created_at_str = datetime.fromtimestamp(created_at_timestamp).strftime('%Y-%m-%d %H:%M:%S')
                except:
                    created_at_str = ''
            
            if updated_at_timestamp:
                try:
                    updated_at_str = datetime.fromtimestamp(updated_at_timestamp).strftime('%Y-%m-%d %H:%M:%S')
                except:
                    updated_at_str = ''
            
            result.append({
                'model_id': model['model_id'],
                'name': model['name'],
                'description': model['description'],
                'attributes': attributes,
                'creator_username': model['creator_username'],
                'is_global': model['is_global'],
                'created_at': model['created_at'],  # 保留时间戳
                'created_at_str': created_at_str,  # 添加格式化后的时间字符串
                'updated_at': model['updated_at'],  # 保留时间戳
                'updated_at_str': updated_at_str,  # 添加格式化后的时间字符串
                'is_active': model.get('is_active', True),
                'model3d_url': model.get('model3d_url'),
                'idle_model_url': model.get('idle_model_url'),
                'talking_model_url': model.get('talking_model_url')
            })
        
        util.log(1, f"[模型API] 返回 {len(result)} 个模型")
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': result
        }), 200
        
    except Exception as e:
        util.log(1, f"[模型API] 获取模型列表失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'获取模型列表失败: {str(e)}'}), 500


@__app.route('/api/models/detail', methods=['POST'])
def api_models_detail():
    """获取模型详情"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        model_id = data.get('model_id')
        if not model_id:
            return jsonify({'code': 400, 'message': '模型ID不能为空'}), 400
        
        from core import model_db
        db = model_db.new_instance()
        model = db.get_model_by_id(model_id)
        
        if not model:
            return jsonify({'code': 404, 'message': '模型不存在'}), 404
        
        # 解析属性JSON
        try:
            import json
            attributes = json.loads(model['attribute_json']) if isinstance(model['attribute_json'], str) else model['attribute_json']
        except:
            attributes = {}
        
        # 格式化时间戳为可读的时间字符串
        from datetime import datetime
        created_at_timestamp = model.get('created_at', 0)
        updated_at_timestamp = model.get('updated_at', 0)
        created_at_str = ''
        updated_at_str = ''
        
        if created_at_timestamp:
            try:
                created_at_str = datetime.fromtimestamp(created_at_timestamp).strftime('%Y-%m-%d %H:%M:%S')
            except:
                created_at_str = ''
        
        if updated_at_timestamp:
            try:
                updated_at_str = datetime.fromtimestamp(updated_at_timestamp).strftime('%Y-%m-%d %H:%M:%S')
            except:
                updated_at_str = ''
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'model_id': model['model_id'],
                'name': model['name'],
                'description': model['description'],
                'attributes': attributes,
                'creator_username': model['creator_username'],
                'is_global': model['is_global'],
                'created_at': model.get('created_at', 0),  # 保留时间戳
                'created_at_str': created_at_str,  # 添加格式化后的时间字符串
                'updated_at': model.get('updated_at', 0),  # 保留时间戳
                'updated_at_str': updated_at_str,  # 添加格式化后的时间字符串
                'created_at': model['created_at'],
                'updated_at': model['updated_at'],
                'is_active': model['is_active'],
                'model3d_url': model.get('model3d_url'),
                'idle_model_url': model.get('idle_model_url'),
                'talking_model_url': model.get('talking_model_url')
            }
        }), 200
        
    except Exception as e:
        util.log(1, f"[模型API] 获取模型详情失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'获取模型详情失败: {str(e)}'}), 500


@__app.route('/api/models/upload-model', methods=['POST'])
def api_models_upload_model():
    """上传3D模型文件"""
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'code': 400, 'message': '未提供文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'code': 400, 'message': '文件名不能为空'}), 400
        
        # 验证文件类型
        allowed_extensions = {'.glb', '.gltf', '.fbx'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({'code': 400, 'message': f'不支持的文件格式，仅支持: {", ".join(allowed_extensions)}'}), 400
        
        # 检查文件大小（限制为100MB）
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        max_size = 100 * 1024 * 1024  # 100MB
        if file_size > max_size:
            return jsonify({'code': 400, 'message': f'文件大小超过限制（最大100MB）'}), 400
        
        # 生成唯一文件名
        timestamp = int(time.time() * 1000)
        random_str = str(uuid.uuid4())[:8]
        filename = f"model_{timestamp}_{random_str}{file_ext}"
        
        # 确保models目录存在
        models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'soullink', 'public', 'models')
        os.makedirs(models_dir, exist_ok=True)
        
        # 保存文件
        file_path = os.path.join(models_dir, filename)
        file.save(file_path)
        
        util.log(1, f"[模型上传] 文件上传成功: {filename}, 大小: {file_size} bytes")
        
        # 返回文件URL
        model_url = f"/models/{filename}"
        return jsonify({
            'code': 200,
            'message': '上传成功',
            'data': {
                'model_url': model_url,
                'filename': filename,
                'size': file_size
            }
        }), 200
        
    except Exception as e:
        util.log(1, f"[模型上传] 上传失败: {str(e)}")
        import traceback
        util.log(1, f"[模型上传] 错误详情: {traceback.format_exc()}")
        return jsonify({'code': 500, 'message': f'上传失败: {str(e)}'}), 500


@__app.route('/api/models/update', methods=['POST'])
def api_models_update():
    """更新模型"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        model_id = data.get('model_id')
        if not model_id:
            return jsonify({'code': 400, 'message': '模型ID不能为空'}), 400
        
        name = data.get('name')
        description = data.get('description')
        attribute_json = data.get('attribute_json')
        model3d_url = data.get('model3d_url')  # 获取3D模型URL
        idle_model_url = data.get('idle_model_url')  # 获取待机动画模型URL
        talking_model_url = data.get('talking_model_url')  # 获取说话动画模型URL
        
        # 如果attribute_json是字典，转换为JSON字符串
        if isinstance(attribute_json, dict):
            import json
            attribute_json = json.dumps(attribute_json, ensure_ascii=False)
        
        from core import model_db
        db = model_db.new_instance()
        success, message = db.update_model(model_id, name, description, attribute_json, model3d_url, idle_model_url, talking_model_url)
        
        if success:
            return jsonify({'code': 200, 'message': message}), 200
        else:
            return jsonify({'code': 500, 'message': message}), 500
            
    except Exception as e:
        util.log(1, f"[模型API] 更新模型失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'更新模型失败: {str(e)}'}), 500


@__app.route('/api/models/delete', methods=['POST'])
def api_models_delete():
    """删除模型"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        model_id = data.get('model_id')
        if not model_id:
            return jsonify({'code': 400, 'message': '模型ID不能为空'}), 400
        
        from core import model_db
        db = model_db.new_instance()
        success, message, file_urls = db.delete_model(model_id)
        
        if success:
            # 删除模型对应的文件
            models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'soullink', 'public', 'models')
            deleted_files = []
            
            # 删除model3d_url对应的文件
            if file_urls.get('model3d_url'):
                model_file = extract_filename_from_url(file_urls['model3d_url'])
                if model_file:
                    file_path = os.path.join(models_dir, model_file)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            deleted_files.append(model_file)
                            util.log(1, f"[模型删除] 已删除文件: {model_file}")
                        except Exception as e:
                            util.log(1, f"[模型删除] 删除文件失败: {model_file}, 错误: {str(e)}")
            
            # 删除idle_model_url对应的文件
            if file_urls.get('idle_model_url'):
                idle_file = extract_filename_from_url(file_urls['idle_model_url'])
                if idle_file:
                    file_path = os.path.join(models_dir, idle_file)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            deleted_files.append(idle_file)
                            util.log(1, f"[模型删除] 已删除空闲动画模型文件: {idle_file}")
                        except Exception as e:
                            util.log(1, f"[模型删除] 删除空闲动画模型文件失败: {idle_file}, 错误: {str(e)}")
            
            # 删除talking_model_url对应的文件
            if file_urls.get('talking_model_url'):
                talking_file = extract_filename_from_url(file_urls['talking_model_url'])
                if talking_file:
                    file_path = os.path.join(models_dir, talking_file)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            deleted_files.append(talking_file)
                            util.log(1, f"[模型删除] 已删除说话动画模型文件: {talking_file}")
                        except Exception as e:
                            util.log(1, f"[模型删除] 删除说话动画模型文件失败: {talking_file}, 错误: {str(e)}")
            
            if deleted_files:
                util.log(1, f"[模型删除] 模型删除成功，已删除 {len(deleted_files)} 个文件: {', '.join(deleted_files)}")
            else:
                util.log(1, f"[模型删除] 模型删除成功，但没有找到需要删除的文件")
            
            return jsonify({'code': 200, 'message': message, 'deleted_files': deleted_files}), 200
        else:
            return jsonify({'code': 500, 'message': message}), 500
            
    except Exception as e:
        util.log(1, f"[模型API] 删除模型失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'删除模型失败: {str(e)}'}), 500


@__app.route('/api/models/clear-history', methods=['POST'])
def api_models_clear_history():
    """清除指定模型的历史对话"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        model_id = data.get('model_id')
        if not model_id:
            return jsonify({'code': 400, 'message': '模型ID不能为空'}), 400
        
        # 清除该模型的历史对话记录
        from core import content_db
        db = content_db.new_instance()
        deleted_count = db.clear_model_history(model_id)
        
        util.log(1, f"[模型API] 已清除模型 {model_id} 的 {deleted_count} 条历史对话记录")
        
        return jsonify({
            'code': 200,
            'message': f'已清除 {deleted_count} 条历史对话记录',
            'data': {
                'model_id': model_id,
                'deleted_count': deleted_count
            }
        }), 200
            
    except Exception as e:
        util.log(1, f"[模型API] 清除模型历史对话失败: {str(e)}")
        import traceback
        util.log(1, f"[模型API] 错误详情: {traceback.format_exc()}")
        return jsonify({'code': 500, 'message': f'清除历史对话失败: {str(e)}'}), 500


def extract_filename_from_url(url):
    """
    从URL中提取文件名
    支持格式: /models/filename.glb, /models/model_xxx.glb, http://host/models/filename.glb
    """
    if not url:
        return None
    
    # 如果是完整URL，提取路径部分
    if url.startswith('http://') or url.startswith('https://'):
        url = '/' + '/'.join(url.split('/')[3:])  # 提取路径部分
    
    # 提取文件名
    if url.startswith('/models/'):
        filename = url.replace('/models/', '')
        return filename
    elif url.startswith('models/'):
        filename = url.replace('models/', '')
        return filename
    else:
        # 假设直接是文件名
        return url


@__app.route('/api/models/select', methods=['POST'])
def api_models_select():
    """选择模型"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        username = data.get('username', 'User')
        model_id = data.get('model_id')
        
        if not model_id:
            return jsonify({'code': 400, 'message': '模型ID不能为空'}), 400
        
        # 检查模型是否存在
        from core import model_db
        db = model_db.new_instance()
        if not db.check_model_exists(model_id):
            return jsonify({'code': 404, 'message': '模型不存在'}), 404
        
        # 设置用户当前模型
        from core import member_db
        member_db_instance = member_db.new_instance()
        success, message = member_db_instance.set_current_model(username, model_id)
        
        if success:
            return jsonify({'code': 200, 'message': message}), 200
        else:
            return jsonify({'code': 500, 'message': message}), 500
            
    except Exception as e:
        util.log(1, f"[模型API] 选择模型失败: {str(e)}")
        return jsonify({'code': 500, 'message': f'选择模型失败: {str(e)}'}), 500


@__app.route('/api/models/generate-attributes', methods=['POST'])
def api_models_generate_attributes():
    """
    生成模型属性
    
    此API使用通用LLM，完全独立于数字人服务和当前选中的模型。
    不会受到对话系统的影响。
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'code': 400, 'message': '未提供数据'}), 400
        
        character_description = data.get('character_description', '').strip()
        if not character_description:
            return jsonify({'code': 400, 'message': '人物描述不能为空'}), 400
        
        util.log(1, f"[模型API-生成属性] 开始生成属性，此调用独立于数字人服务")
        util.log(1, f"[模型API-生成属性] 人物描述: {character_description}")
        
        # 使用通用LLM生成属性 - 确保这是完全独立的调用
        # 不涉及任何模型选择或对话路由逻辑
        from llm import llm_service
        attributes = llm_service.generate_character_attributes(character_description)
        
        if attributes:
            util.log(1, f"[模型API-生成属性] 属性生成成功")
            return jsonify({
                'code': 200,
                'message': '生成成功',
                'data': attributes
            }), 200
        else:
            util.log(1, f"[模型API-生成属性] 属性生成失败")
            return jsonify({'code': 500, 'message': '生成属性失败'}), 500
            
    except Exception as e:
        util.log(1, f"[模型API-生成属性] 生成属性失败: {str(e)}")
        import traceback
        util.log(1, f"[模型API-生成属性] 错误详情: {traceback.format_exc()}")
        return jsonify({'code': 500, 'message': f'生成属性失败: {str(e)}'}), 500

# 启动genagents_flask.py的API
@__app.route('/api/start-genagents', methods=['POST'])
def api_start_genagents():
    try:
        # 只有在数字人启动后才能克隆人格
        if not fay_booter.is_running():
            return jsonify({'success': False, 'message': 'Fay未启动，无法启动决策分析'}), 400
        
        # 获取克隆要求
        data = request.get_json()
        if not data or 'instruction' not in data:
            return jsonify({'success': False, 'message': '缺少克隆要求参数'}), 400
        
        instruction = data['instruction']
        
        # 保存指令到临时文件，供genagents_flask.py读取
        instruction_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'genagents', 'instruction.json')
        with open(instruction_file, 'w', encoding='utf-8') as f:
            json.dump({'instruction': instruction}, f, ensure_ascii=False)
        
        # 导入genagents_flask模块
        import sys
        sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
        from genagents.genagents_flask import start_genagents_server, is_shutdown_requested
        from werkzeug.serving import make_server
        
        # 关闭之前的genagents服务器（如果存在）
        global genagents_server, genagents_thread, monitor_thread
        if genagents_server is not None:
            try:
                # 主动关闭之前的服务器
                util.log(1, "关闭之前的决策分析服务...")
                genagents_server.shutdown()
                # 等待线程结束
                if genagents_thread and genagents_thread.is_alive():
                    genagents_thread.join(timeout=2)
                if monitor_thread and monitor_thread.is_alive():
                    monitor_thread.join(timeout=2)
            except Exception as e:
                util.log(1, f"关闭之前的决策分析服务时出错: {str(e)}")
        
        # 清除之前的记忆，确保只保留最新的决策分析
        try:
            from llm.nlp_cognitive_stream import clear_agent_memory
            util.log(1, "已清除之前的决策分析记忆")
        except Exception as e:
            util.log(1, f"清除之前的决策分析记忆时出错: {str(e)}")
        
        # 启动决策分析服务（不启动单独进程，而是返回Flask应用实例）
        genagents_app = start_genagents_server(instruction_text=instruction)
        
        # 创建服务器
        genagents_server = make_server('0.0.0.0', 5001, genagents_app)
        
        # 在后台线程中启动Flask服务
        import threading
        def run_genagents_app():
            try:
                # 使用serve_forever而不是app.run
                genagents_server.serve_forever()
            except Exception as e:
                util.log(1, f"决策分析服务运行出错: {str(e)}")
            finally:
                util.log(1, f"决策分析服务已关闭")
        
        # 启动监控线程，检查是否需要关闭服务器
        def monitor_shutdown():
            try:
                while not is_shutdown_requested():
                    gsleep(1)
                util.log(1, f"检测到关闭请求，正在关闭决策分析服务...")
                genagents_server.shutdown()
            except Exception as e:
                util.log(1, f"监控决策分析服务时出错: {str(e)}")
        
        # 启动服务器线程
        genagents_thread = threading.Thread(target=run_genagents_app)
        genagents_thread.daemon = True
        genagents_thread.start()
        
        # 启动监控线程
        monitor_thread = threading.Thread(target=monitor_shutdown)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        util.log(1, f"已启动决策分析页面，指令: {instruction}")
        
        # 返回决策分析页面的URL
        return jsonify({
            'success': True, 
            'message': '已启动决策分析页面',
            'url': 'http://127.0.0.1:5001/'
        }), 200
    except Exception as e:
        util.log(1, f"启动决策分析页面时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'启动决策分析页面时出错: {str(e)}'}), 500

# Hunyuan3D-2 API 代理端点
@__app.route('/api/hunyuan3d/generate', methods=['POST'])
def api_hunyuan3d_generate():
    """
    Hunyuan3D-2 模型生成API代理端点
    支持图生3D和文字生3D两种模式
    """
    try:
        # 加载配置
        config_util.load_config()
        hunyuan3d_api_url = config_util.hunyuan3d_api_url or 'http://localhost:8081'
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '未提供请求数据'}), 400
        
        # 验证必需参数：必须提供image或text之一
        if not data.get('image') and not data.get('text'):
            return jsonify({'success': False, 'error': '必须提供image（图生3D）或text（文字生3D）参数'}), 400
        
        # 构建请求参数
        request_params = {
            'seed': data.get('seed', 1234),
            'octree_resolution': data.get('octree_resolution', 128),
            'num_inference_steps': data.get('num_inference_steps', 5),
            'guidance_scale': data.get('guidance_scale', 5.0),
            'texture': data.get('texture', False),
            'type': data.get('type', 'glb')
        }
        
        # 添加image或text参数
        if data.get('image'):
            request_params['image'] = data['image']
        if data.get('text'):
            request_params['text'] = data['text']
        if data.get('text_seed'):
            request_params['text_seed'] = data['text_seed']
        if data.get('face_count'):
            request_params['face_count'] = data['face_count']
        
        util.log(1, f"[Hunyuan3D] 开始生成3D模型，模式: {'图生3D' if data.get('image') else '文字生3D'}")
        
        # 调用Hunyuan3D-2 API
        api_url = f"{hunyuan3d_api_url}/generate"
        response = requests.post(
            api_url,
            json=request_params,
            headers={'Content-Type': 'application/json'},
            timeout=600  # 10分钟超时，因为3D生成可能需要较长时间
        )
        
        # 检查响应状态
        if response.status_code != 200:
            error_text = response.text
            try:
                error_json = response.json()
                error_msg = error_json.get('text', error_json.get('error', error_text))
            except:
                error_msg = error_text
            util.log(1, f"[Hunyuan3D] API调用失败: {response.status_code} - {error_msg}")
            return jsonify({'success': False, 'error': f'生成失败: {error_msg}'}), response.status_code
        
        # 获取生成的模型文件（二进制数据）
        model_data = response.content
        
        # 生成文件名（使用时间戳）
        timestamp = int(time.time() * 1000)
        filename = f"model_{timestamp}.glb"
        
        # 确保models目录存在
        models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'soullink', 'public', 'models')
        os.makedirs(models_dir, exist_ok=True)
        
        # 保存文件到服务器
        file_path = os.path.join(models_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(model_data)
        
        util.log(1, f"[Hunyuan3D] 模型生成成功，已保存到: {file_path}")
        
        # 构建返回URL（相对于public目录）
        model_url = f"/models/{filename}"
        
        # 将文件转换为base64（用于前端直接使用）
        import base64
        blob_base64 = base64.b64encode(model_data).decode('utf-8')
        
        return jsonify({
            'success': True,
            'modelUrl': model_url,
            'blobBase64': blob_base64,
            'filename': filename
        }), 200
        
    except requests.exceptions.Timeout:
        util.log(1, "[Hunyuan3D] API调用超时")
        return jsonify({'success': False, 'error': '生成超时，请稍后重试'}), 504
    except requests.exceptions.ConnectionError:
        # 外部服务不可用时，自动降级：从本地 public/models 里挑一个现成 glb 返回
        util.log(1, f"[Hunyuan3D] 无法连接到Hunyuan3D-2 API服务: {hunyuan3d_api_url}，尝试本地降级返回示例模型")
        try:
            import random
            import base64

            repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            models_dir = os.path.join(repo_root, 'soullink', 'public', 'models')
            candidates = []
            if os.path.isdir(models_dir):
                for name in os.listdir(models_dir):
                    if name.lower().endswith('.glb'):
                        candidates.append(name)

            if candidates:
                picked = random.choice(candidates)
                file_path = os.path.join(models_dir, picked)
                with open(file_path, 'rb') as f:
                    model_data = f.read()

                # 生成一个新文件名，避免前端/浏览器缓存同名文件
                timestamp = int(time.time() * 1000)
                filename = f"model_stub_{timestamp}.glb"
                out_path = os.path.join(models_dir, filename)
                with open(out_path, 'wb') as f:
                    f.write(model_data)

                model_url = f"/models/{filename}"
                blob_base64 = base64.b64encode(model_data).decode('utf-8')
                util.log(1, f"[Hunyuan3D] 已降级返回本地模型: {picked} -> {filename}")
                return jsonify({
                    'success': True,
                    'modelUrl': model_url,
                    'blobBase64': blob_base64,
                    'filename': filename,
                    'warning': f'外部3D生成服务不可用，已返回本地示例模型（配置 hunyuan3d_api_url={hunyuan3d_api_url}）'
                }), 200
        except Exception as e:
            util.log(1, f"[Hunyuan3D] 本地降级失败: {str(e)}")

        return jsonify({
            'success': False,
            'error': (
                f'无法连接到3D生成服务（{hunyuan3d_api_url}）。'
                f'你可以：1）启动本地stub：python test/hunyuan3d_stub_server.py '
                f'或 2）在 system.conf 里设置 key.hunyuan3d_api_url 指向真实服务。'
            )
        }), 503
    except Exception as e:
        util.log(1, f"[Hunyuan3D] 生成过程中出错: {str(e)}")
        return jsonify({'success': False, 'error': f'生成失败: {str(e)}'}), 500

def run():
    class NullLogHandler:
        def write(self, *args, **kwargs):
            pass
    server = pywsgi.WSGIServer(
        ('0.0.0.0', 5000), 
        __app,
        log=NullLogHandler()  
    )
    server.serve_forever()

def start():
    MyThread(target=run).start()