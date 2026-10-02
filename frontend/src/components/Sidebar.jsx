import React, { useState } from 'react';
import {
  LayoutDashboard, Map, Bell, History, User, Users, ClipboardList,
  Sliders, FileWarning, Wrench, HardHat, ShieldCheck, Siren, Settings2,
  ChevronLeft, ChevronRight, Activity, Zap, Droplets, Wind, Thermometer,
  Radio, BarChart3, Download, Shield, BookOpen, PhoneCall, UserCheck,
  Flame, Cpu, Package, Cloud, Megaphone, Stethoscope, MessageSquare,
  FlaskConical, AlertTriangle, Users2, CheckSquare, FileCheck,
  TrendingUp, Pickaxe, Trash2, Award, MapPin, Drill, Fuel, Calendar,
  LogOut,
} from 'lucide-react';
import useMineStore from '../store/useMineStore';
import useAuthStore from '../store/useAuthStore';

const ROLE_META = {
  miner:      { label:'Miner',       Icon:HardHat,    accent:'#f59e0b' },
  supervisor: { label:'Supervisor',  Icon:ShieldCheck, accent:'#38bdf8' },
  rescue:     { label:'Rescue Team', Icon:Siren,       accent:'#f43f5e' },
  admin:      { label:'Admin',       Icon:Settings2,   accent:'#8b5cf6' },
};

// All roles shorthand
const ALL   = ['miner','supervisor','rescue','admin'];
const STAFF = ['supervisor','rescue','admin'];
const MGR   = ['supervisor','admin'];
const ADM   = ['admin'];

const NAV_SECTIONS = [
  {
    section: 'MAIN',
    items: [
      { id:'dashboard',  label:'Dashboard',       Icon:LayoutDashboard, roles:ALL,   badge:false },
      { id:'map',        label:'Live Map',         Icon:Map,             roles:ALL,   badge:false },
      { id:'alerts',     label:'Alerts',           Icon:Bell,            roles:ALL,   badge:true  },
      { id:'noticeboard',label:'Noticeboard',      Icon:Megaphone,       roles:ALL,   badge:false },
      { id:'weather',    label:'Weather',          Icon:Cloud,           roles:ALL,   badge:false },
      { id:'comms',      label:'Communications',   Icon:MessageSquare,   roles:ALL,   badge:false },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { id:'history',    label:'Sensor History',   Icon:History,         roles:STAFF, badge:false },
      { id:'attendance', label:'Attendance',        Icon:UserCheck,       roles:MGR,   badge:false },
      { id:'shiftlog',   label:'Shift Log',         Icon:ClipboardList,   roles:STAFF, badge:false },
      { id:'production', label:'Production',        Icon:TrendingUp,      roles:MGR,   badge:false },
      { id:'inspection', label:'Daily Inspection',  Icon:CheckSquare,     roles:MGR,   badge:false },
      { id:'muster',     label:'Muster / Roll Call',Icon:Users2,          roles:STAFF, badge:false },
    ],
  },
  {
    section: 'SAFETY',
    items: [
      { id:'incidents',  label:'Incidents',         Icon:FileWarning,     roles:STAFF, badge:false },
      { id:'workpermit', label:'Work Permits',       Icon:Shield,          roles:MGR,   badge:false },
      { id:'permitwork', label:'Permit to Work',     Icon:FileCheck,       roles:STAFF, badge:false },
      { id:'checklist',  label:'Safety Checklist',  Icon:BookOpen,        roles:ALL,   badge:false },
      { id:'sop',        label:'SOPs Library',       Icon:BookOpen,        roles:ALL,   badge:false },
      { id:'hazardmap',  label:'Hazard Registry',    Icon:MapPin,          roles:STAFF, badge:false },
      { id:'firedrill',  label:'Fire Drills',        Icon:Flame,           roles:STAFF, badge:false },
      { id:'medical',    label:'Medical Records',    Icon:Stethoscope,     roles:STAFF, badge:false },
      { id:'rewards',    label:'Safety Rewards',     Icon:Award,           roles:ALL,   badge:false },
    ],
  },
  {
    section: 'MONITORING',
    items: [
      { id:'equipment',  label:'Equipment',          Icon:Wrench,          roles:MGR,   badge:false },
      { id:'maintenance',label:'Maintenance',        Icon:Wrench,          roles:MGR,   badge:false },
      { id:'power',      label:'Power Monitor',      Icon:Zap,             roles:MGR,   badge:false },
      { id:'waterpump',  label:'Water Pumps',        Icon:Droplets,        roles:MGR,   badge:false },
      { id:'ventilation',label:'Ventilation',        Icon:Wind,            roles:MGR,   badge:false },
      { id:'seismic',    label:'Seismic',            Icon:Activity,        roles:STAFF, badge:false },
      { id:'co2',        label:'CO₂ Monitor',        Icon:Thermometer,     roles:[...ALL],badge:false},
      { id:'fuel',       label:'Fuel Tracker',       Icon:Fuel,            roles:MGR,   badge:false },
    ],
  },
  {
    section: 'MINING OPS',
    items: [
      { id:'blasting',   label:'Blasting',           Icon:Zap,             roles:MGR,   badge:false },
      { id:'drilling',   label:'Drill Monitoring',   Icon:Pickaxe,         roles:MGR,   badge:false },
      { id:'chemical',   label:'Chemicals / Expl.',  Icon:FlaskConical,    roles:MGR,   badge:false },
      { id:'waste',      label:'Waste Management',   Icon:Trash2,          roles:MGR,   badge:false },
    ],
  },
  {
    section: 'REPORTS',
    items: [
      { id:'analytics',  label:'Analytics',          Icon:BarChart3,       roles:MGR,   badge:false },
      { id:'export',     label:'Export Data',        Icon:Download,        roles:MGR,   badge:false },
      { id:'safetyscore',label:'Safety Score',       Icon:Flame,           roles:MGR,   badge:false },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { id:'users',      label:'Users',              Icon:Users,           roles:ADM,   badge:false },
      { id:'contractor', label:'Contractors',        Icon:HardHat,         roles:MGR,   badge:false },
      { id:'contacts',   label:'Emergency Contacts', Icon:PhoneCall,       roles:STAFF, badge:false },
      { id:'training',   label:'Training',           Icon:Cpu,             roles:ADM,   badge:false },
      { id:'inventory',  label:'Inventory',          Icon:Package,         roles:MGR,   badge:false },
      { id:'settings',   label:'Settings',           Icon:Sliders,         roles:ADM,   badge:false },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const activePage  = useMineStore(s => s.activePage);
  const setPage     = useMineStore(s => s.setActivePage);
  const alertCount  = useMineStore(s => s.alerts?.length || 0);
  const currentUser = useAuthStore(s => s.currentUser);
  const logout      = useAuthStore(s => s.logout);
  const role        = currentUser?.role || 'miner';
  const meta        = ROLE_META[role] || ROLE_META.miner;

  // Filter sections and items by role
  const visibleSections = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(item => item.roles.includes(role)),
  })).filter(sec => sec.items.length > 0);

  const sidebarWidth = collapsed ? '3.75rem' : '14.5rem';

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full relative transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: 'linear-gradient(180deg, #060a14 0%, #04070f 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        zIndex: 10,
      }}
    >
      {/* ── Logo / Brand ─────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-4 flex-shrink-0"
        style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', minHeight:'3.75rem' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs select-none"
          style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', boxShadow:'0 2px 12px rgba(245,158,11,0.4)', minWidth:'2rem' }}>
          MG
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <div className="font-black text-sm leading-none whitespace-nowrap" style={{ color:'#f1f5f9' }}>
              Guardian<span style={{ color:'#f59e0b' }}>X</span>
            </div>
            <div className="text-[9px] font-mono mt-0.5 whitespace-nowrap" style={{ color:'#475569' }}>
              DGMS · SEC-A · 5 Nodes
            </div>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ───────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-[3.2rem] z-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
        style={{ background:'#0e1628', border:'1px solid rgba(255,255,255,0.12)', color:'#64748b', boxShadow:'0 2px 8px rgba(0,0,0,0.4)' }}>
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={{ scrollbarWidth:'none' }}>
        {visibleSections.map(sec => (
          <div key={sec.section} className="mb-1">
            {/* Section label */}
            {!collapsed && (
              <div className="px-3 pt-3 pb-1 text-[9px] font-bold tracking-[0.12em] select-none"
                style={{ color:'#334155' }}>
                {sec.section}
              </div>
            )}
            {/* Items */}
            {sec.items.map(item => {
              const isActive = activePage === item.id;
              const count    = item.badge ? alertCount : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={collapsed ? item.label : undefined}
                  className="relative flex items-center gap-2.5 transition-all duration-150 rounded-lg"
                  style={{
                    width: 'calc(100% - 0.5rem)',
                    margin: '1px 0.25rem',
                    padding: collapsed ? '0.5rem 0' : '0.5rem 0.625rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
                    color: isActive ? '#f59e0b' : '#64748b',
                    fontWeight: isActive ? 700 : 500,
                    boxShadow: isActive ? '0 0 0 1px rgba(245,158,11,0.18) inset' : 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#cbd5e1'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#64748b'; } }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full" style={{ background:'#f59e0b' }} />
                  )}

                  <item.Icon className="w-4 h-4 flex-shrink-0" />

                  {!collapsed && (
                    <span className="text-xs truncate flex-1 text-left">{item.label}</span>
                  )}

                  {/* Alert badge */}
                  {!collapsed && count > 0 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background:'#ef4444', color:'#fff' }}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  {collapsed && count > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User strip + logout ───────────────────────────── */}
      <div className="flex-shrink-0" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        {/* Profile button */}
        <button
          onClick={() => setPage('profile')}
          className="w-full flex items-center gap-2 p-2.5 transition-all duration-150 rounded-lg mx-1"
          style={{ width:'calc(100% - 0.5rem)', color:'#64748b' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#cbd5e1'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#64748b'; }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 select-none"
            style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.2)', minWidth:'1.75rem' }}>
            {currentUser?.avatar || '👤'}
          </div>
          {!collapsed && (
            <div className="min-w-0 text-left overflow-hidden">
              <div className="text-xs font-bold truncate" style={{ color:'#e2e8f0' }}>{currentUser?.name}</div>
              <div className="text-[9px] font-mono truncate" style={{ color: meta.accent }}>{meta.label}</div>
            </div>
          )}
        </button>

        {/* Logout button */}
        <button
          onClick={() => { if (logout) logout(); }}
          className="w-full flex items-center gap-2 p-2.5 transition-all duration-150 rounded-lg mx-1 mb-1"
          style={{ width:'calc(100% - 0.5rem)', color:'#64748b', justifyContent: collapsed ? 'center' : 'flex-start' }}
          title={collapsed ? 'Logout' : undefined}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#64748b'; }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-xs">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
