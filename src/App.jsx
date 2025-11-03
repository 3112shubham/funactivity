import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LivePoll from './livePoll'
import Admin from './admin'
import Result from './result'
import Questions from './Questions'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LivePoll />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/results" element={<Result />} />
        <Route path="/add" element={<Questions />}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App