import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import trTR from 'antd/locale/tr_TR';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminSidebarLayout from './components/AdminSidebarLayout';
import UserSidebarLayout from './components/UserSidebarLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Vehicles from './pages/Vehicles';
import VehicleRecords from './pages/VehicleRecords';
import AdminVehicleRecords from './pages/AdminVehicleRecords';
import AdminManageVehicles from './pages/AdminManageVehicles';
import AdminVisitorRecords from './pages/AdminVisitorRecords';
import AdminManagerRecords from './pages/AdminManagerRecords';
import AdminIncidentRecords from './pages/AdminIncidentRecords';
import AdminFireAlarmRecords from './pages/AdminFireAlarmRecords';
import AdminManagePersonnel from './pages/AdminManagePersonnel';
import AdminManageManagers from './pages/AdminManageManagers';
import AdminExportData from './pages/AdminExportData';
import AdminStatistics from './pages/AdminStatistics';
import Visitors from './pages/Visitors';
import VisitorRecords from './pages/VisitorRecords';
import Managers from './pages/Managers';
import ManagerRecords from './pages/ManagerRecords';
import Incidents from './pages/Incidents';
import IncidentRecords from './pages/IncidentRecords';
import FireAlarms from './pages/FireAlarms';
import FireAlarmRecords from './pages/FireAlarmRecords';
import Sgk from './pages/Sgk';
import EquipmentCheck from './pages/EquipmentCheck';

function App() {
  return (
    <ConfigProvider locale={trTR}>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Equipment Check - Semi-protected (requires login but before dashboard) */}
            <Route path="/equipment-check" element={
              <ProtectedRoute>
                <EquipmentCheck />
              </ProtectedRoute>
            } />

            {/* Admin Protected Routes */}
            <Route path="/admin" element={
              <AdminProtectedRoute>
                <AdminSidebarLayout />
              </AdminProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="vehicle-records" element={<AdminVehicleRecords />} />
              <Route path="manage-vehicles" element={<AdminManageVehicles />} />
              <Route path="visitor-records" element={<AdminVisitorRecords />} />
              <Route path="manager-records" element={<AdminManagerRecords />} />
              <Route path="incident-records" element={<AdminIncidentRecords />} />
              <Route path="fire-alarm-records" element={<AdminFireAlarmRecords />} />
              <Route path="manage-personnel" element={<AdminManagePersonnel />} />
              <Route path="manage-managers" element={<AdminManageManagers />} />
              <Route path="export-data" element={<AdminExportData />} />
              <Route path="statistics" element={<AdminStatistics />} />
            </Route>

            {/* Protected Routes - Authentication gerekli */}
            <Route path="/" element={
              <ProtectedRoute>
                <UserSidebarLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="vehicle-records" element={<VehicleRecords />} />
              <Route path="visitors" element={<Visitors />} />
              <Route path="visitor-records" element={<VisitorRecords />} />
              <Route path="managers" element={<Managers />} />
              <Route path="manager-records" element={<ManagerRecords />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="incident-records" element={<IncidentRecords />} />
              <Route path="fire-alarms" element={<FireAlarms />} />
              <Route path="fire-alarm-records" element={<FireAlarmRecords />} />
              <Route path="sgk" element={<Sgk />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 404 - Bulunamayan sayfalar */}
            <Route path="*" element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                  <p className="text-gray-400 mb-4">Sayfa bulunamadı</p>
                  <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
                    Ana sayfaya dön
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </Router>
      </ThemeProvider>
    </ConfigProvider>
  );
}

export default App;
