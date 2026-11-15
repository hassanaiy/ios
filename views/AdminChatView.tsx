import React from 'react';
import { User, UserRole } from '../types';
import { ChatPanel } from '../components/ChatPanel';
import { useLanguage } from '../contexts/LanguageContext';

export default function AdminChatView({ user, onBack }: { user: User, onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <ChatPanel 
      rideId={`admin_chat_${user.id}`}
      currentUserId={user.id}
      otherUserName={t('chat_with_admin')}
      onClose={onBack}
      isPassenger={user.role === UserRole.PASSENGER}
      passengerId={user.id}
      isSupportChat={true}
    />
  );
}
