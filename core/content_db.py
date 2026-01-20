import sqlite3
import time
import threading
import functools
from utils import util

def synchronized(func):
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        with self.lock:
            return func(self, *args, **kwargs)
    return wrapper

__content_tb = None
def new_instance():
    global __content_tb
    if __content_tb is None:
        __content_tb = Content_Db()
        __content_tb.init_db()
    return __content_tb

class Content_Db:

    def __init__(self) -> None:
        self.lock = threading.Lock()

    # 初始化数据库
    def init_db(self):
        conn = sqlite3.connect('memory/fay.db')
        conn.text_factory = str
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS T_Msg
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
            type        CHAR(10),
            way         CHAR(10),
            content     TEXT    NOT NULL,
            createtime  INT,
            username    TEXT DEFAULT 'User',
            uid         INT,
            model_id    TEXT);''')
        
        # 检查并添加 model_id 字段（如果不存在）
        try:
            c.execute('ALTER TABLE T_Msg ADD COLUMN model_id TEXT')
        except sqlite3.OperationalError:
            # 字段已存在，忽略错误
            pass
        
        # 创建索引以提高查询性能
        try:
            c.execute('CREATE INDEX IF NOT EXISTS idx_model_id ON T_Msg(model_id)')
            c.execute('CREATE INDEX IF NOT EXISTS idx_username_model ON T_Msg(username, model_id)')
        except:
            pass
        
        # 对话采纳记录表
        c.execute('''CREATE TABLE IF NOT EXISTS T_Adopted
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
            msg_id      INTEGER UNIQUE,
            adopted_time INT,
            FOREIGN KEY(msg_id) REFERENCES T_Msg(id));''')
        conn.commit()
        conn.close()

    # 添加对话
    @synchronized
    def add_content(self, type, way, content, username='User', uid=0, model_id=None):
        """
        添加对话记录
        
        参数:
            type: 消息类型（'member'或'fay'）
            way: 消息方式（'speak'等）
            content: 消息内容
            username: 用户名
            uid: 用户ID
            model_id: 模型ID（可选，用于按模型存储对话记录）
        """
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        try:
            cur.execute("INSERT INTO T_Msg (type, way, content, createtime, username, uid, model_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (type, way, content, int(time.time()), username, uid, model_id))
            conn.commit()
            last_id = cur.lastrowid
        except Exception as e:
            util.log(1, "请检查参数是否有误: {}".format(e))
            conn.close()
            return 0
        conn.close()
        return last_id

    # 更新对话内容
    @synchronized
    def update_content(self, msg_id, content):
        """
        更新指定ID的消息内容
        :param msg_id: 消息ID
        :param content: 新的内容
        :return: 是否更新成功
        """
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        try:
            cur.execute("UPDATE T_Msg SET content = ? WHERE id = ?", (content, msg_id))
            conn.commit()
            affected_rows = cur.rowcount
        except Exception as e:
            util.log(1, f"更新消息内容失败: {e}")
            conn.close()
            return False
        conn.close()
        return affected_rows > 0

    # 根据ID查询对话记录
    @synchronized
    def get_content_by_id(self, msg_id):
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        cur.execute("SELECT * FROM T_Msg WHERE id = ?", (msg_id,))
        record = cur.fetchone()
        conn.close()
        return record

    # 添加对话采纳记录
    @synchronized
    def adopted_message(self, msg_id):
        conn = sqlite3.connect('memory/fay.db')
        conn.text_factory = str
        cur = conn.cursor()
        # 检查消息ID是否存在
        cur.execute("SELECT 1 FROM T_Msg WHERE id = ?", (msg_id,))
        if cur.fetchone() is None:
            util.log(1, "消息ID不存在")
            conn.close()
            return False
        try:
            cur.execute("INSERT INTO T_Adopted (msg_id, adopted_time) VALUES (?, ?)", (msg_id, int(time.time())))
            conn.commit()
        except sqlite3.IntegrityError:
            util.log(1, "该消息已被采纳")
            conn.close()
            return False
        conn.close()
        return True

    # 获取对话内容
    @synchronized
    def get_list(self, way, order, limit, uid=0, model_id=None):
        """
        获取对话记录列表
        
        参数:
            way: 消息方式（'all', 'notappended'或其他）
            order: 排序方式（'asc'或'desc'）
            limit: 限制数量
            uid: 用户ID
            model_id: 模型ID（可选，用于按模型筛选）
        """
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        where_conditions = []
        params = []
        
        if int(uid) != 0:
            where_conditions.append("T_Msg.uid = ?")
            params.append(uid)
        
        if model_id:
            where_conditions.append("T_Msg.model_id = ?")
            params.append(model_id)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1"
        
        base_query = f"""
            SELECT T_Msg.type, T_Msg.way, T_Msg.content, T_Msg.createtime,
                   datetime(T_Msg.createtime, 'unixepoch', 'localtime') AS timetext,
                   T_Msg.username, T_Msg.id,
                   CASE WHEN T_Adopted.msg_id IS NOT NULL THEN 1 ELSE 0 END AS is_adopted
            FROM T_Msg
            LEFT JOIN T_Adopted ON T_Msg.id = T_Adopted.msg_id
            WHERE {where_clause}
        """
        if way == 'all':
            query = base_query + f" ORDER BY T_Msg.id {order} LIMIT ?"
            params.append(limit)
            cur.execute(query, params)
        elif way == 'notappended':
            query = base_query + f" AND T_Msg.way != 'appended' ORDER BY T_Msg.id {order} LIMIT ?"
            params.append(limit)
            cur.execute(query, params)
        else:
            query = base_query + f" AND T_Msg.way = ? ORDER BY T_Msg.id {order} LIMIT ?"
            params.insert(0, way)
            params.append(limit)
            cur.execute(query, params)
        list = cur.fetchall()
        conn.close()
        return list
    

    @synchronized
    def get_recent_messages_by_user(self, username='User', limit=30, model_id=None):
        """
        获取用户最近的对话记录
        
        参数:
            username: 用户名
            limit: 限制数量
            model_id: 模型ID（可选，用于按模型筛选）
        """
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        
        if model_id:
            cur.execute(
                """
                SELECT type, content
                FROM T_Msg
                WHERE username = ? AND model_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (username, model_id, limit),
            )
        else:
            cur.execute(
                """
                SELECT type, content
                FROM T_Msg
                WHERE username = ?
                ORDER BY id DESC
                LIMIT ?
                """,
            (username, limit),
        )
        rows = cur.fetchall()
        conn.close()
        rows.reverse()
        return rows

    @synchronized
    def get_previous_user_message(self, msg_id):
        conn = sqlite3.connect("memory/fay.db")
        cur = conn.cursor()
        cur.execute("""
            SELECT id, type, way, content, createtime, datetime(createtime, 'unixepoch', 'localtime') AS timetext, username
            FROM T_Msg
            WHERE id < ? AND type != 'fay'
            ORDER BY id DESC
            LIMIT 1
        """, (msg_id,))
        record = cur.fetchone()
        conn.close()
        return record

    # 清除特定模型的历史对话
    @synchronized
    def clear_model_history(self, model_id):
        """
        清除指定模型的所有历史对话记录
        
        参数:
            model_id: 模型ID
        返回:
            删除的记录数量
        """
        conn = sqlite3.connect("memory/fay.db")
        conn.text_factory = str
        cur = conn.cursor()
        try:
            # 先查询要删除的记录数
            cur.execute("SELECT COUNT(*) FROM T_Msg WHERE model_id = ?", (model_id,))
            count = cur.fetchone()[0]
            
            # 删除指定模型的所有对话记录
            cur.execute("DELETE FROM T_Msg WHERE model_id = ?", (model_id,))
            conn.commit()
            deleted_count = cur.rowcount
        except Exception as e:
            util.log(1, f"清除模型历史对话失败: {e}")
            conn.close()
            return 0
        conn.close()
        util.log(1, f"已清除模型 {model_id} 的 {deleted_count} 条历史对话记录")
        return deleted_count
