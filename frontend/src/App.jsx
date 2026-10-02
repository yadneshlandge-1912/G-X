import React, { useEffect } from 'react';
import Sidebar               from './components/Sidebar';
import Dashboard             from './pages/Dashboard';
import MapPage               from './pages/MapPage';
import AlertsPage            from './pages/AlertsPage';
import HistoryPage           from './pages/HistoryPage';
import ProfilePage           from './pages/ProfilePage';
import UsersPage             from './pages/UsersPage';
import ShiftLogPage          from './pages/ShiftLogPage';
import SettingsPage          from './pages/SettingsPage';
import IncidentReportPage    from './pages/IncidentReportPage';
import EquipmentPage         from './pages/EquipmentPage';
import AttendancePage        from './pages/AttendancePage';
import WorkPermitPage        from './pages/WorkPermitPage';
import SafetyChecklistPage   from './pages/SafetyChecklistPage';
import PowerMonitorPage      from './pages/PowerMonitorPage';
import WaterPumpPage         from './pages/WaterPumpPage';
import VentilationPage       from './pages/VentilationPage';
import SeismicPage           from './pages/SeismicPage';
import CO2MonitorPage        from './pages/CO2MonitorPage';
import AnalyticsPage         from './pages/AnalyticsPage';
import ExportPage            from './pages/ExportPage';
import SafetyScorePage       from './pages/SafetyScorePage';
import EmergencyContactsPage from './pages/EmergencyContactsPage';
import TrainingPage          from './pages/TrainingPage';
import InventoryPage         from './pages/InventoryPage';
// ── 20 new pages ──────────────────────────────────────────────────────────────
import WeatherPage           from './pages/WeatherPage';
import NoticeboardPage       from './pages/NoticeboardPage';
import SOPPage               from './pages/SOPPage';
import MaintenancePage       from './pages/MaintenancePage';
import FuelPage              from './pages/FuelPage';
import MedicalPage           from './pages/MedicalPage';
import FireDrillPage         from './pages/FireDrillPage';
import CommunicationPage     from './pages/CommunicationPage';
import ProductionPage        from './pages/ProductionPage';
import BlastingPage          from './pages/BlastingPage';
import WasteManagePage       from './pages/WasteManagePage';
import PermitToWorkPage      from './pages/PermitToWorkPage';
import InspectionPage        from './pages/InspectionPage';
import RewardsPage           from './pages/RewardsPage';
import HazardMapPage         from './pages/HazardMapPage';
import MusterPage            from './pages/MusterPage';
import DrillPage             from './pages/DrillPage';
import ChemicalPage          from './pages/ChemicalPage';
import ContractorPage        from './pages/ContractorPage';
// ─────────────────────────────────────────────────────────────────────────────
import AuthRouter            from './pages/auth/AuthRouter';
import useMineStore          from './store/useMineStore';
import useAuthStore          from './store/useAuthStore';

function PageContent({ activePage }) {
  switch (activePage) {
    // ── Core ────────────────────────────────────────────
    case 'dashboard':    return <Dashboard />;
    case 'map':          return <MapPage />;
    case 'alerts':       return <AlertsPage />;
    case 'noticeboard':  return <NoticeboardPage />;
    case 'weather':      return <WeatherPage />;
    case 'comms':        return <CommunicationPage />;
    // ── Operations ──────────────────────────────────────
    case 'history':      return <HistoryPage />;
    case 'attendance':   return <AttendancePage />;
    case 'shiftlog':     return <ShiftLogPage />;
    case 'production':   return <ProductionPage />;
    case 'inspection':   return <InspectionPage />;
    case 'muster':       return <MusterPage />;
    // ── Safety ──────────────────────────────────────────
    case 'incidents':    return <IncidentReportPage />;
    case 'workpermit':   return <WorkPermitPage />;
    case 'permitwork':   return <PermitToWorkPage />;
    case 'checklist':    return <SafetyChecklistPage />;
    case 'sop':          return <SOPPage />;
    case 'hazardmap':    return <HazardMapPage />;
    case 'firedrill':    return <FireDrillPage />;
    case 'medical':      return <MedicalPage />;
    case 'rewards':      return <RewardsPage />;
    // ── Monitoring ──────────────────────────────────────
    case 'equipment':    return <EquipmentPage />;
    case 'maintenance':  return <MaintenancePage />;
    case 'power':        return <PowerMonitorPage />;
    case 'waterpump':    return <WaterPumpPage />;
    case 'ventilation':  return <VentilationPage />;
    case 'seismic':      return <SeismicPage />;
    case 'co2':          return <CO2MonitorPage />;
    case 'fuel':         return <FuelPage />;
    // ── Mining Ops ──────────────────────────────────────
    case 'blasting':     return <BlastingPage />;
    case 'drilling':     return <DrillPage />;
    case 'chemical':     return <ChemicalPage />;
    case 'waste':        return <WasteManagePage />;
    // ── Reports ─────────────────────────────────────────
    case 'analytics':    return <AnalyticsPage />;
    case 'export':       return <ExportPage />;
    case 'safetyscore':  return <SafetyScorePage />;
    // ── Admin ───────────────────────────────────────────
    case 'users':        return <UsersPage />;
    case 'contacts':     return <EmergencyContactsPage />;
    case 'training':     return <TrainingPage />;
    case 'inventory':    return <InventoryPage />;
    case 'contractor':   return <ContractorPage />;
    case 'settings':     return <SettingsPage />;
    // ── Personal ────────────────────────────────────────
    case 'profile':      return <ProfilePage />;
    default:             return <Dashboard />;
  }
}

function AppShell() {
  const activePage  = useMineStore(s => s.activePage);
  const hasSOS      = useMineStore(s => Object.values(s.sosActive || {}).some(Boolean));
  const theme       = useAuthStore(s => s.theme);
  const currentUser = useAuthStore(s => s.currentUser);
  const connectWS   = useMineStore(s => s.connectWS);
  const wsRef       = useMineStore(s => s.wsRef);
  const pushNotif   = useAuthStore(s => s.pushNotification);

  useEffect(() => { if (!wsRef) connectWS(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', theme === 'light');
    document.documentElement.classList.toggle('dark', theme !== 'light');
  }, [theme]);

  useEffect(() => {
    if (!hasSOS) return;
    pushNotif({ title: '🚨 SOS ALERT', message: 'Emergency signal received from a miner node!', type: 'danger' });
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [hasSOS]);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background:'var(--bg-base, #03050d)', color:'var(--text-primary, #e2e8f0)' }}>

      {/* ── Left sidebar — always visible ── */}
      <Sidebar />

      {/* ── Right side: content stack ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* SOS banner */}
        {hasSOS && (
          <div className="flex items-center justify-center gap-3 py-2.5 text-sm font-bold tracking-widest flex-shrink-0 z-50 animate-pulse"
            style={{ background: 'linear-gradient(90deg, #7f1d1d, #991b1b, #7f1d1d)', color:'#fff' }}>
            <span className="text-2xl">🚨</span>
            <span>SOS SIGNAL ACTIVE — EMERGENCY RESPONSE REQUIRED</span>
            <span className="text-2xl">🚨</span>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <PageContent activePage={activePage} />
        </main>

        {/* Footer */}
        <footer className="flex-shrink-0 px-4 py-2 flex items-center justify-between text-xs flex-wrap gap-2"
          style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(6,10,20,0.95)', color:'#475569' }}>
          <span className="font-mono">GuardianX · CoalMine LoRa+AI v2.0 · SEC-A · 5 Nodes</span>
          <span className="font-mono hidden sm:inline">LoRa 915 MHz · SF12 · DGMS-aligned</span>
          <span className="font-mono">
            <span style={{ color:'#94a3b8' }}>{currentUser?.name}</span>
            {' · '}<span style={{ color:'#f59e0b', fontWeight:700 }}>{currentUser?.role}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthRouter>
      <AppShell />
    </AuthRouter>
  );
}
