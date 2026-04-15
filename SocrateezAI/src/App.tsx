import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { JobSearchPage } from './pages/JobSearchPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { EtlAuditPage } from './pages/EtlAuditPage';
export function App() {
  const [activePage, setActivePage] = useState('dashboard');
  return (
    <div className="min-h-screen w-full bg-background font-heading">
      <Navbar activePage={activePage} onNavigate={setActivePage} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activePage === 'dashboard' && <DashboardPage />}
        {activePage === 'jobs' && <JobSearchPage />}
        {activePage === 'ai' && <AIAssistantPage />}
        {activePage === 'etl-audit' && <EtlAuditPage />}
      </main>
    </div>);

}