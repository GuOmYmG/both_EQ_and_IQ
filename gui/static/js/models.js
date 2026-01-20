// 模型管理页面JS
document.addEventListener('DOMContentLoaded', function() {
    // 确保Element UI已加载
    if (typeof Vue === 'undefined') {
        console.error('Vue未加载');
        return;
    }
    
    const app = new Vue({
        el: '#app',
        delimiters: ['[[', ']]'],
        data: {
            models: [],
            selectedModelId: null,
            showDialog: false,
            dialogTitle: '添加模型',
            dialogForm: {
                name: '',
                description: '',
                character_description: '',
                attributes: null,
                model3d_url: ''
            },
            editingModelId: null,
            generating: false,
            hostname: window.location.hostname,
            mcpOnlineStatus: false
        },
        mounted() {
            this.loadModels();
            this.loadSelectedModel();
        },
        methods: {
            async loadModels() {
                try {
                    const response = await fetch('/api/models/list', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: 'User',
                            include_global: true
                        })
                    });
                    const result = await response.json();
                    console.log('模型列表响应:', result); // 调试日志
                    if (result.code === 200) {
                        this.models = result.data || [];
                        console.log('加载的模型数量:', this.models.length); // 调试日志
                        if (this.models.length === 0) {
                            console.warn('模型列表为空');
                        }
                    } else {
                        console.error('加载模型列表失败:', result.message);
                        if (this.$message) {
                            this.$message.error(result.message || '加载模型列表失败');
                        } else {
                            alert(result.message || '加载模型列表失败');
                        }
                    }
                } catch (error) {
                    console.error('加载模型列表失败:', error);
                    if (this.$message) {
                        this.$message.error('加载模型列表失败');
                    } else {
                        alert('加载模型列表失败');
                    }
                }
            },
            async loadSelectedModel() {
                try {
                    // 从localStorage获取当前选中的模型
                    const savedModelId = localStorage.getItem('selectedModelId');
                    if (savedModelId) {
                        this.selectedModelId = savedModelId;
                    }
                } catch (error) {
                    console.error('加载选中模型失败:', error);
                }
            },
            async selectModel(modelId) {
                try {
                    const response = await fetch('/api/models/select', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: 'User',
                            model_id: modelId
                        })
                    });
                    const result = await response.json();
                    if (result.code === 200) {
                        this.selectedModelId = modelId;
                        localStorage.setItem('selectedModelId', modelId);
                        if (this.$message) {
                            this.$message.success('模型选择成功，人设页面将自动更新');
                        } else {
                            alert('模型选择成功，人设页面将自动更新');
                        }
                        // 通知人设页面更新
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({ type: 'modelSelected', modelId: modelId }, '*');
                        }
                        // 尝试通过localStorage通知
                        localStorage.setItem('modelSelected', JSON.stringify({ modelId: modelId, timestamp: Date.now() }));
                    } else {
                        if (this.$message) {
                            this.$message.error(result.message || '选择模型失败');
                        } else {
                            alert(result.message || '选择模型失败');
                        }
                    }
                } catch (error) {
                    console.error('选择模型失败:', error);
                    if (this.$message) {
                        this.$message.error('选择模型失败');
                    } else {
                        alert('选择模型失败');
                    }
                }
            },
            showAddDialog() {
                this.dialogTitle = '添加模型';
                this.dialogForm = {
                    name: '',
                    description: '',
                    character_description: '',
                    attributes: null,
                    model3d_url: ''
                };
                this.editingModelId = null;
                this.showDialog = true;
            },
            editModel(model) {
                this.dialogTitle = '编辑模型';
                this.dialogForm = {
                    name: model.name,
                    description: model.description || '',
                    character_description: '',
                    attributes: model.attributes || null,
                    model3d_url: model.model3d_url || ''
                };
                this.editingModelId = model.model_id;
                this.showDialog = true;
            },
            closeDialog() {
                this.showDialog = false;
                this.dialogForm = {
                    name: '',
                    description: '',
                    character_description: '',
                    attributes: null,
                    model3d_url: ''
                };
                this.editingModelId = null;
            },
            async generateAttributes() {
                if (!this.dialogForm.character_description.trim()) {
                    if (this.$message) {
                        this.$message.warning('请先输入人物描述');
                    } else {
                        alert('请先输入人物描述');
                    }
                    return;
                }
                this.generating = true;
                try {
                    const response = await fetch('/api/models/generate-attributes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            character_description: this.dialogForm.character_description
                        })
                    });
                    const result = await response.json();
                    if (result.code === 200) {
                        this.dialogForm.attributes = result.data;
                        if (this.$message) {
                            this.$message.success('属性生成成功');
                        } else {
                            alert('属性生成成功');
                        }
                    } else {
                        if (this.$message) {
                            this.$message.error(result.message || '生成属性失败');
                        } else {
                            alert(result.message || '生成属性失败');
                        }
                    }
                } catch (error) {
                    console.error('生成属性失败:', error);
                    if (this.$message) {
                        this.$message.error('生成属性失败');
                    } else {
                        alert('生成属性失败');
                    }
                } finally {
                    this.generating = false;
                }
            },
            async saveModel() {
                if (!this.dialogForm.name.trim()) {
                    if (this.$message) {
                        this.$message.warning('请输入模型名称');
                    } else {
                        alert('请输入模型名称');
                    }
                    return;
                }
                if (!this.dialogForm.attributes && !this.dialogForm.character_description.trim()) {
                    if (this.$message) {
                        this.$message.warning('请提供人物描述或属性');
                    } else {
                        alert('请提供人物描述或属性');
                    }
                    return;
                }
                try {
                    let attributes = this.dialogForm.attributes;
                    // 如果没有属性但有描述，先生成属性
                    if (!attributes && this.dialogForm.character_description.trim()) {
                        await this.generateAttributes();
                        attributes = this.dialogForm.attributes;
                    }
                    if (!attributes) {
                        if (this.$message) {
                            this.$message.warning('无法生成属性，请检查人物描述');
                        } else {
                            alert('无法生成属性，请检查人物描述');
                        }
                        return;
                    }
                    const requestData = {
                        name: this.dialogForm.name,
                        description: this.dialogForm.description,
                        attribute_json: attributes
                    };
                    // 如果提供了3D模型URL，添加到请求数据中
                    if (this.dialogForm.model3d_url && this.dialogForm.model3d_url.trim()) {
                        requestData.model3d_url = this.dialogForm.model3d_url.trim();
                    }
                    let url = '/api/models/create';
                    if (this.editingModelId) {
                        url = '/api/models/update';
                        requestData.model_id = this.editingModelId;
                    }
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestData)
                    });
                    const result = await response.json();
                    if (result.code === 200) {
                        if (this.$message) {
                            this.$message.success(this.editingModelId ? '更新成功' : '创建成功');
                        } else {
                            alert(this.editingModelId ? '更新成功' : '创建成功');
                        }
                        this.closeDialog();
                        this.loadModels();
                    } else {
                        if (this.$message) {
                            this.$message.error(result.message || '保存失败');
                        } else {
                            alert(result.message || '保存失败');
                        }
                    }
                } catch (error) {
                    console.error('保存模型失败:', error);
                    if (this.$message) {
                        this.$message.error('保存模型失败');
                    } else {
                        alert('保存模型失败');
                    }
                }
            },
            async deleteModel(modelId) {
                if (this.$confirm) {
                    this.$confirm('确定要删除这个模型吗？', '提示', {
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                        type: 'warning'
                    }).then(async () => {
                    try {
                        const response = await fetch('/api/models/delete', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model_id: modelId
                            })
                        });
                        const result = await response.json();
                        if (result.code === 200) {
                            if (this.$message) {
                                this.$message.success('删除成功');
                            } else {
                                alert('删除成功');
                            }
                            if (this.selectedModelId === modelId) {
                                this.selectedModelId = null;
                                localStorage.removeItem('selectedModelId');
                            }
                            this.loadModels();
                        } else {
                            if (this.$message) {
                                this.$message.error(result.message || '删除失败');
                            } else {
                                alert(result.message || '删除失败');
                            }
                        }
                    } catch (error) {
                        console.error('删除模型失败:', error);
                        if (this.$message) {
                            this.$message.error('删除模型失败');
                        } else {
                            alert('删除模型失败');
                        }
                    }
                }).catch(() => {});
                } else {
                    if (confirm('确定要删除这个模型吗？')) {
                        // 直接删除
                        this.performDelete(modelId);
                    }
                }
            },
            async performDelete(modelId) {
                try {
                    const response = await fetch('/api/models/delete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model_id: modelId
                        })
                    });
                    const result = await response.json();
                    if (result.code === 200) {
                        alert('删除成功');
                        if (this.selectedModelId === modelId) {
                            this.selectedModelId = null;
                            localStorage.removeItem('selectedModelId');
                        }
                        this.loadModels();
                    } else {
                        alert(result.message || '删除失败');
                    }
                } catch (error) {
                    console.error('删除模型失败:', error);
                    alert('删除模型失败');
                }
            },
            /**
             * 清除模型历史对话
             * @param {string} modelId 模型ID
             */
            async clearHistory(modelId) {
                // 确认对话框
                const confirmMessage = '确定要清除该模型的所有历史对话吗？此操作不可恢复。';
                if (this.$confirm) {
                    this.$confirm(confirmMessage, '提示', {
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                        type: 'warning'
                    }).then(async () => {
                        await this.performClearHistory(modelId);
                    }).catch(() => {});
                } else {
                    if (confirm(confirmMessage)) {
                        await this.performClearHistory(modelId);
                    }
                }
            },
            /**
             * 执行清除历史对话操作
             * @param {string} modelId 模型ID
             */
            async performClearHistory(modelId) {
                try {
                    const response = await fetch('/api/models/clear-history', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model_id: modelId
                        })
                    });
                    const result = await response.json();
                    if (result.code === 200) {
                        const message = result.message || `已清除 ${result.data?.deleted_count || 0} 条历史对话记录`;
                        if (this.$message) {
                            this.$message.success(message);
                        } else {
                            alert(message);
                        }
                    } else {
                        if (this.$message) {
                            this.$message.error(result.message || '清除历史对话失败');
                        } else {
                            alert(result.message || '清除历史对话失败');
                        }
                    }
                } catch (error) {
                    console.error('清除历史对话失败:', error);
                    if (this.$message) {
                        this.$message.error('清除历史对话失败');
                    } else {
                        alert('清除历史对话失败');
                    }
                }
            }
        }
    });
});

