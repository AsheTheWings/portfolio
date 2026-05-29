'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@portfolio/ui/components/shadcn';

interface AgentAvatarProps {
  avatarImage?: string | null;
  agentName?: string;
  agentColor?: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function AgentAvatar({
  avatarImage,
  agentName = 'Agent',
  agentColor = '#E2E8F0',
  className,
  size = 'default',
}: AgentAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {avatarImage && <AvatarImage src={avatarImage} alt={agentName} />}
      <AvatarFallback color={agentColor} className="font-bold select-none">
        A
      </AvatarFallback>
    </Avatar>
  );
}
