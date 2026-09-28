import { Icon } from './components/Icon';
import { Sheets, Toast } from './components/Sheets';
import { Account } from './screens/Account';
import { Checkin } from './screens/Checkin';
import { Grocery } from './screens/Grocery';
import { Home } from './screens/Home';
import { Interview } from './screens/Interview';
import { Nutrition } from './screens/Nutrition';
import { Planner } from './screens/Planner';
import { Preferences } from './screens/Preferences';
import { Prep } from './screens/Prep';
import { Recipe } from './screens/Recipe';
import { Resume } from './screens/Resume';
import { Summary } from './screens/Summary';
import { Welcome } from './screens/Welcome';
import { RemyProvider, useRemy } from './store';

function CurrentScreen() {
  const { ui, planState } = useRemy();
  // Planning screens need a plan; without one, start from the welcome screen.
  const needsPlan = ['home', 'planner', 'nutrition', 'recipe', 'grocery', 'prep', 'checkin', 'prefs'].includes(ui.screen);
  if (needsPlan && !planState.plan) return <Welcome />;
  switch (ui.screen) {
    case 'interview':
      return <Interview />;
    case 'resume':
      return <Resume />;
    case 'summary':
      return <Summary />;
    case 'home':
      return <Home />;
    case 'planner':
      return <Planner />;
    case 'nutrition':
      return <Nutrition />;
    case 'recipe':
      return <Recipe />;
    case 'grocery':
      return <Grocery />;
    case 'prep':
      return <Prep />;
    case 'account':
      return <Account />;
    case 'checkin':
      return <Checkin />;
    case 'prefs':
      return <Preferences />;
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
