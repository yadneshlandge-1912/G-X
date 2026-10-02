import React from 'react';
import LoginBase from './LoginBase';

export default function SupervisorLogin() {
  return (
    <LoginBase
      role="supervisor"
      title="Supervisor"
      subtitle="Mine operations control centre"
      emoji="📋"
      accent="#38bdf8"
      demo="vikas.sharma / super123  ·  priya.nair / super456"
      hint="Supervisor ID"
    />
  );
}
