import React, { useState } from 'react';
import { User, Sparkles, AlertCircle } from 'lucide-react';

interface CharacterDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  onGenerate?: (description: string) => void;
  isGenerating?: boolean;
}

/**
 * 角色描述输入组件
 * 基于soullink1的实现，在CreatePage中提供人物描述输入功能
 */
export const CharacterDescriptionInput: React.FC<CharacterDescriptionInputProps> = ({
  value,
  onChange,
  placeholder = "请描述你想要创建的人物特征...",
  maxLength = 500,
  disabled = false,
  onGenerate,
  isGenerating = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;

  const handleGenerate = () => {
    if (value.trim() && onGenerate && !isGenerating) {
      onGenerate(value.trim());
    }
  };

  return (
    <div className="space-y-3">
      {/* 标题和说明 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700">角色描述</h3>
          <p className="text-xs text-gray-600/70">描述你想要创建的人物特征，AI将生成详细属性</p>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          className={`
            w-full h-24 bg-white/70 border rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 
            focus:outline-none focus:ring-2 resize-none transition-all duration-200
            ${isFocused ? 'border-purple-500/50 focus:ring-purple-500/20' : 'border-pink-300/40'}
            ${isOverLimit ? 'border-red-500/50 focus:ring-red-500/20' : ''}
            ${disabled || isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {/* 字符计数 */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {isOverLimit && (
            <AlertCircle size={14} className="text-red-400" />
          )}
          <span className={`text-xs ${
            isOverLimit ? 'text-red-600' : 
            isNearLimit ? 'text-yellow-600' : 
            'text-gray-500'
          }`}>
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* 错误提示 */}
      {isOverLimit && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
          <AlertCircle size={14} />
          <span>描述内容超出限制，请精简到{maxLength}字符以内</span>
        </div>
      )}

      {/* 生成按钮 */}
      {onGenerate && (
        <button
          onClick={handleGenerate}
          disabled={!value.trim() || isOverLimit || disabled || isGenerating}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
            transition-all duration-200 
            ${!value.trim() || isOverLimit || disabled || isGenerating
              ? 'bg-white/40 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl'
            }
          `}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>正在生成角色属性...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>生成角色属性</span>
            </>
          )}
        </button>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-gray-600/70 space-y-1">
        <p>💡 描述示例：一个25岁的程序员，来自北京，性格开朗，喜欢编程和阅读</p>
        <p>🎯 AI将根据描述生成：姓名、性别、年龄、职业、爱好、性格等详细属性</p>
      </div>
    </div>
  );
};

export default CharacterDescriptionInput;