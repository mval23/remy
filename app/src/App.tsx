import { Icon } from './components/Icon';
import { Sheets, Toast } from './components/Sheets';
import { Interview } from './screens/Interview';
import { Resume } from './screens/Resume';
import { Summary } from './screens/Summary';
import { Welcome } from './screens/Welcome';
import { RemyProvider, useRemy } from './store';

function CurrentScreen() {
  const { ui } = useRemy();
  switch (ui.screen) {
    case 'interview':
      return <Interview />;
    case 'resume':
      return <Resume />;
    case 'summary':
      return <Summary />;
    default:
      return <Welcome />;
  }
}

const Loading = (
  <div className="app">
    <div className="loading" role="status">
      <span className="w-mark small">
        <Icon name="toque" size={28} />
      </span>
      <span className="hint">Opening your kitchen…</span>
    </div>
  </div>
);

export default function App() {
  return (
    <RemyProvider fallback={Loading}>
      <div className="app">
        <CurrentScreen />
        <Sheets />
        <Toast />
      </div>
    </RemyProvider>
  );
}
