
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/Button';

interface DriverInstructionsProps {
  onClose: () => void;
}

export const DriverInstructions: React.FC<DriverInstructionsProps> = ({ onClose }) => {
  const { t, isRTL } = useLanguage();

  const Section = ({ title, body }: { title: string, body: string }) => (
    <div className="mb-6">
      <h3 className="text-lg font-black text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line font-medium">
        {body}
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] flex flex-col max-h-[90vh] shadow-2xl animate-slide-up overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-black text-gray-900">{t('driver_guide_title')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-gray-50/50" dir={isRTL ? 'rtl' : 'ltr'}>
          <Section title={t('guide_s1_title')} body={t('guide_s1_body')} />
          <Section title={t('guide_s2_title')} body={t('guide_s2_body')} />
          <Section title={t('guide_s3_title')} body={t('guide_s3_body')} />
          <Section title={t('guide_s4_title')} body={t('guide_s4_body')} />
          <Section title={t('guide_s5_title')} body={t('guide_s5_body')} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <Button onClick={onClose} className="w-full h-14 bg-[#FFC90E] text-black shadow-lg">
            {t('ok_btn')}
          </Button>
        </div>
      </div>
    </div>
  );
};
