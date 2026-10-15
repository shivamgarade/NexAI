import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Zap, Layers } from 'lucide-react';
import { SchedulesTab } from '@/features/automations/SchedulesTab';
import { SkillsTab } from '@/features/automations/SkillsTab';
import { ConnectedAppsTab } from '@/features/automations/ConnectedAppsTab';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSkillStore } from '@/store/skillStore';
import { useConnectedAppStore } from '@/store/connectedAppStore';
import { cn } from '@/lib/utils/cn';
import styles from './AutomationsPage.module.scss';

export default function AutomationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab') || 'schedules';

  const [activeTab, setActiveTab] = useState(
    ['schedules', 'skills', 'apps'].includes(currentTabParam) ? currentTabParam : 'schedules',
  );

  const { schedules, fetchSchedules } = useScheduleStore();
  const { skills, fetchSkills } = useSkillStore();
  const { apps, fetchConnectedApps } = useConnectedAppStore();

  useEffect(() => {
    fetchSchedules();
    fetchSkills();
    fetchConnectedApps();
  }, [fetchSchedules, fetchSkills, fetchConnectedApps]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['schedules', 'skills', 'apps'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const connectedAppsCount = apps.filter((a) => a.isConnected).length;

  return (
    <div className={styles.pageContainer}>
      {/* Sleek Google-style Segmented Subnav Header */}
      <div className={styles.navHeader}>
        <div className={styles.pillTabsContainer} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'schedules'}
            className={cn(styles.pillTab, activeTab === 'schedules' && styles.pillTabActive)}
            onClick={() => handleTabChange('schedules')}
          >
            <Clock size={15} />
            <span>Schedules</span>
            {schedules.length > 0 && <span className={styles.badge}>{schedules.length}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skills'}
            className={cn(styles.pillTab, activeTab === 'skills' && styles.pillTabActive)}
            onClick={() => handleTabChange('skills')}
          >
            <Zap size={15} />
            <span>Skills</span>
            {skills.length > 0 && <span className={styles.badge}>{skills.length}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'apps'}
            className={cn(styles.pillTab, activeTab === 'apps' && styles.pillTabActive)}
            onClick={() => handleTabChange('apps')}
          >
            <Layers size={15} />
            <span>Connected Apps</span>
            {connectedAppsCount > 0 && (
              <span className={cn(styles.badge, styles.badgeActive)}>
                {connectedAppsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab View */}
      <main className={styles.tabContent}>
        {activeTab === 'schedules' && <SchedulesTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'apps' && <ConnectedAppsTab />}
      </main>
    </div>
  );
}
