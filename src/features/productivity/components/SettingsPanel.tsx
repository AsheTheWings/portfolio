'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/features/shared/components/shadcn';
import { SettingsView } from '../views/SettingsView';

export function SettingsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Configure session behavior.</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingsView />
      </CardContent>
      <CardFooter />
    </Card>
  );
}
