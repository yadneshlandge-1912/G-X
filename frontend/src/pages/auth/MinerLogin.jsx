import React from 'react';
import LoginBase from './LoginBase';

export default function MinerLogin() {
  return (
    <LoginBase
      role="miner"
      title="Miner"
      subtitle="Field worker — wearable safety node"
      emoji="⛏"
      accent="#f59e0b"
      demo="rajan.kumar / miner123  ·  deepak.singh / miner456"
      hint="Badge / Username"
    />
  );
}
