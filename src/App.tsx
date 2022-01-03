import React from 'react';
import { StdDeck } from './app/entities';
import Cribbage from './Cribbage'
import './App.css'
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.css'

function App( ) {
  const url_map : Record<string, string> = {
    brooke: 'br1',
    emma1: 'em1t',
    emma2: 'em2',
    vintage: 'vv'
  }
  return (
    <div className="App">
    <h1>CRIBBAGE</h1>
    <Router>
    <Routes>
      <Route path='/select' element={<Cribbage />} />
      <Route path='/' element={<Cribbage deck={new StdDeck( 'rc' )}/>} />
      {Object.keys( url_map ).map( (x, idx) => <Route key={idx} path={`/${x}`} element={<Cribbage deck={new StdDeck( url_map[x] )} />} />) }
    </Routes>
    </Router>
    </div>
  );
}

export default App;
