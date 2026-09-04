import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  requireInputText?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen, onClose, onConfirm, title, message, requireInputText
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = requireInputText ? inputValue === requireInputText : true;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="p-6">
          <div className="flex justify-end -mt-2 -mr-2 mb-2">
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-center text-slate-900 mb-2">{title}</h3>
          <div className="text-center text-slate-600 text-sm mb-6 leading-relaxed">
            {message}
          </div>

          {requireInputText && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2 text-center">
                請輸入 <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">{requireInputText}</span> 以確認刪除
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-4 py-2 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-shadow"
                placeholder={requireInputText}
              />
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (isMatch) {
                  onConfirm();
                  onClose();
                }
              }}
              disabled={!isMatch}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
            >
              確認刪除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
