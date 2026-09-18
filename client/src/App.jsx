import React from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movie from './pages/Movie.jsx'
import Person from './pages/Person.jsx'
import Queries from './pages/Queries.jsx'
import People from './pages/People.jsx'

export default function App() {
  return (
    <div>
      <header>
        <Link to="/" className="brand">Movie Ratings</Link>
        <nav>
          <NavLink to="/">Movies</NavLink>
          <NavLink to="/people">People</NavLink>
          <NavLink to="/queries">Queries</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/people" element={<People />} />
          <Route path="/person/:id" element={<Person />} />
          <Route path="/queries" element={<Queries />} />
        </Routes>
      </main>
    </div>
  )
}
