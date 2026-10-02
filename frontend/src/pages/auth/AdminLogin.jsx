import React from 'react';
import LoginBase from './LoginBase';

export default function AdminLogin() {
  return (
    <LoginBase
      role="admin"
      title="System Admin"
      subtitle="Full access — all actions are audited"
      emoji="🛡️"
      accent="#8b5cf6"
      demo="admin / admin@mine1"
      hint="Admin Username"
    />
  );
}
