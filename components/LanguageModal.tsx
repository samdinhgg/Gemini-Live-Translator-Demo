import React from 'react';
import type { Language } from '../languages';
import { CloseIcon } from './CloseIcon';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguage: (languageCode: string) => void;
  languages: Language[];
  title: string;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose, onSelectLanguage, languages, title }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-xl w-11/12 max-w-sm max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close language selection">
            <CloseIcon />
          </button>
        </header>
        <div className="overflow-y-auto p-2">
          <ul className="divide-y divide-gray-700">
            {languages.map(lang => (
              <li key={lang.code}>
                <button
                  onClick={() => onSelectLanguage(lang.code)}
                  className="w-full text-left p-3 text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {lang.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
