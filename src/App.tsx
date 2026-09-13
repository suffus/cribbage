import { ReactNode } from 'react';
import { StdDeck } from './app/entities';
import Cribbage from './Cribbage'
import { Splash } from './screens/Splash'
import { Learn } from './screens/Learn'
import { Stats } from './screens/Stats'
import { FriendPlay } from './screens/FriendPlay'
import './App.css'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.css'

const url_map : Record<string, string> = {
  brooke: 'br1',
  emma1: 'em1t',
  emma2: 'em2',
  vintage: 'vv'
}

export function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <h1>CRIBBAGE</h1>
      {children}
    </>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<Splash />} />
      <Route path='/play' element={<GameLayout><Cribbage deck={new StdDeck('rc')} /></GameLayout>} />
      <Route path='/learn' element={<Learn />} />
      <Route path='/stats' element={<Stats />} />
      <Route path='/friend' element={<FriendPlay />} />
      <Route path='/select' element={<GameLayout><Cribbage /></GameLayout>} />
      {Object.keys(url_map).map((x) => (
        <Route key={x} path={`/${x}`} element={<GameLayout><Cribbage deck={new StdDeck(url_map[x])} /></GameLayout>} />
      ))}
      <Route path='*' element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <div className="App">
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AppRoutes />
    </Router>
    </div>
  );
}

export default App;
