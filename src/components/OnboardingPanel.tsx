interface OnboardingPanelProps {
  onImportClick: () => void;
  isDemo: boolean;
}

export function OnboardingPanel({ onImportClick, isDemo }: OnboardingPanelProps) {
  if (!isDemo) return null;
  
  return (
    <div className="onboarding-panel">
      <h3 className="onboarding-title">Welcome to Your Wedding Table Planner!</h3>
      <p className="onboarding-text">
        You're viewing sample demo data with fictional guests. 
        Import your own private guest list to get started with your real seating plan.
      </p>
      <button className="toolbar-btn primary" onClick={onImportClick}>
        📥 Import Your Guest List
      </button>
      <div className="privacy-notice" style={{ marginTop: '16px', textAlign: 'left' }}>
        <strong>🔒 Privacy First</strong>
        <p style={{ marginTop: '8px' }}>
          Your guest data stays completely private:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Stored only in your browser's local storage</li>
          <li>Never uploaded to any server</li>
          <li>No analytics or tracking</li>
          <li>Export/backup anytime as JSON or CSV</li>
        </ul>
      </div>
    </div>
  );
}
