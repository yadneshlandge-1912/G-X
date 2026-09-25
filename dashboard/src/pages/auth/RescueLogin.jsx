import React from 'react';
import LoginBase from './LoginBase';

export default function RescueLogin() {
  return (
    <LoginBase
      role="rescue"
      title="Rescue Team"
      subtitle="Emergency response unit — SEC-A"
      emoji="🦺"
      accent="#f43f5e"
      demo="arjun.rescue / rescue123  ·  sunita.rescue / rescue456"
      hint="Rescue ID"
    />
  );
}
