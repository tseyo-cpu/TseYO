import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AwardRecord, Category, AwardType, AcademicTerm } from '../types';
import { CategoryLabels, DefaultCategorySubcategories, AwardTypeLabels } from '../types';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AwardRecord | null;
  onSave: (record: AwardRecord) => void;
  subCategories: Record<Category, string[]>;
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen, onClose, record, onSave, subCategories
}) => {
  const [formData, setFormData] = useState<AwardRecord | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setFormData(record);
    }
  }, [isOpen, record]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const currentSubCats = subCategories[formData.category] || DefaultCategorySubcategories[formData.category] || [];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">編輯獎勵紀錄</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">學期</label>
                <select 
                  value={formData.term || '全年'}
                  onChange={(e) => setFormData({...formData, term: e.target.value as AcademicTerm})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="全年">全年</option>
                  <option value="上學期">上學期</option>
                  <option value="下學期">下學期</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">活動類型</label>
                <select 
                  value={formData.category}
                  onChange={(e) => {
                    const newCat = e.target.value as Category;
                    const subs = subCategories[newCat] || DefaultCategorySubcategories[newCat] || [];
                    setFormData({...formData, category: newCat, subCategory: subs[0] || ''});
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {(Object.keys(CategoryLabels) as Category[]).map(cat => (
                    <option key={cat} value={cat}>{CategoryLabels[cat]}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">活動子類別 (可自填)</label>
                <input 
                  type="text"
                  list="editSubcategoryList"
                  value={formData.subCategory || ''}
                  onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="選擇或輸入"
                />
                <datalist id="editSubcategoryList">
                  {currentSubCats.map(sub => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">職位 (選填)</label>
              <input 
                type="text"
                value={formData.position || ''}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="例如: 隊長, 主席"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">獎勵項目</label>
                <select 
                  value={formData.awardType}
                  onChange={(e) => setFormData({...formData, awardType: e.target.value as AwardType})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {(Object.keys(AwardTypeLabels) as AwardType[]).map(type => (
                    <option key={type} value={type}>{AwardTypeLabels[type]}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">數量</label>
                <input 
                  type="number" min="1" required
                  value={formData.count}
                  onChange={(e) => setFormData({...formData, count: parseInt(e.target.value) || 1})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">獲獎理由 / 描述</label>
              <textarea 
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none h-24 resize-none"
                placeholder="輸入具體表現或獲獎原因"
              ></textarea>
            </div>
            
            {formData.status && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">狀態</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as 'pending' | 'approved'})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50"
                >
                  <option value="pending">待確認</option>
                  <option value="approved">已確認</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              儲存變更
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
